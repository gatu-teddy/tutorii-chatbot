import fs from "fs"
import path from "path"
import express from "express"
import bodyParser from "body-parser"
import twilio from "twilio"
import axios from "axios"
import dotenv from "dotenv";
dotenv.config();
/* =====================
   ENV VARIABLES
===================== */
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  OPENAI_KEY,
  GPT_API_KEY,
  TWILIO_WHATSAPP_FROM
} = process.env

const OPENAI_API_KEY = OPENAI_KEY || GPT_API_KEY

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !OPENAI_API_KEY) {
  console.error("❌ Missing environment variables")
  process.exit(1)
}

/* =====================
   TWILIO CLIENT
===================== */
const twilioClient = twilio(
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
)

/* =====================
   CONFIG
===================== */
const ADMIN_NUMBER = "+971567728465"
const ADMIN_TRIGGER = "trigger max"
const TWILIO_FROM = TWILIO_WHATSAPP_FROM || "whatsapp:+971504095079"
const CAMPAIGN_STAGGER_MS = Number(process.env.CAMPAIGN_STAGGER_MS || 1800)

const DEFAULT_TARGET_NUMBERS = [
  "+254796143065",
  "+971567728465",
  "+447826939737",
  "+971501830069",
  "+923045172021"
]

const INBOUND_DEDUPE_TTL_MS = Number(process.env.INBOUND_DEDUPE_TTL_MS || 5 * 60 * 1000)
const INBOUND_DEBOUNCE_MS = Number(process.env.INBOUND_DEBOUNCE_MS || 2200)
const OUTBOUND_COOLDOWN_MS = Number(process.env.OUTBOUND_COOLDOWN_MS || 2500)
const OUTBOUND_DUPLICATE_WINDOW_MS = Number(
  process.env.OUTBOUND_DUPLICATE_WINDOW_MS || 45 * 1000
)
const MIN_RESPONSE_DELAY_MS = Number(process.env.MIN_RESPONSE_DELAY_MS || 1200)
const MAX_RESPONSE_DELAY_MS = Number(process.env.MAX_RESPONSE_DELAY_MS || 7000)
const MAX_HISTORY_MESSAGES = Number(process.env.MAX_HISTORY_MESSAGES || 20)

const STAGE_RANK = {
  initial: 0,
  interested: 1,
  qualified: 2,
  link_sent: 3
}

function normalizeNumber(raw) {
  return String(raw || "").replace(/^whatsapp:/i, "").trim()
}

function loadTargetNumbers() {
  const targetsPath = path.join(process.cwd(), "targets.json")

  if (!fs.existsSync(targetsPath)) {
    return new Set(DEFAULT_TARGET_NUMBERS)
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(targetsPath, "utf8"))

    if (!Array.isArray(parsed)) {
      return new Set(DEFAULT_TARGET_NUMBERS)
    }

    const numbers = parsed
      .map(normalizeNumber)
      .filter(Boolean)

    return new Set(numbers.length ? numbers : DEFAULT_TARGET_NUMBERS)
  } catch (error) {
    console.error("⚠️ Could not parse targets.json, using defaults:", error.message)
    return new Set(DEFAULT_TARGET_NUMBERS)
  }
}

const TARGET_NUMBERS = loadTargetNumbers()

/* =====================
   IN-MEMORY USER STATE
===================== */
const userState = {}
const userQueues = new Map()
const processedInbound = new Map()
const pendingInbound = new Map()

function getUserState(userNumber) {
  if (!userState[userNumber]) {
    userState[userNumber] = {
      stage: "initial",
      linkSent: false,
      history: [],
      lastOutboundAt: 0,
      lastOutboundFingerprint: ""
    }
  }
  return userState[userNumber]
}

function advanceStage(userNumber, nextStage) {
  const currentStage = userState[userNumber].stage
  const currentRank = STAGE_RANK[currentStage] ?? 0
  const nextRank = STAGE_RANK[nextStage] ?? 0
  userState[userNumber].stage = nextRank > currentRank ? nextStage : currentStage
}

function pushHistory(state, role, content) {
  state.history.push({ role, content })

  if (state.history.length > MAX_HISTORY_MESSAGES) {
    state.history.splice(0, state.history.length - MAX_HISTORY_MESSAGES)
  }
}

function normalizeText(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ")
}

/* =====================
   MESSAGE DEDUPE + QUEUES
===================== */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getInboundFingerprint({ messageSid, from, body }) {
  const normalizedBody = normalizeText(body).slice(0, 200)

  if (messageSid) {
    return `sid:${messageSid}`
  }

  const timeBucket = Math.floor(Date.now() / 30000)
  return `fallback:${from}:${normalizedBody}:${timeBucket}`
}

function isDuplicateInbound(fingerprint) {
  const now = Date.now()

  for (const [key, createdAt] of processedInbound.entries()) {
    if (now - createdAt > INBOUND_DEDUPE_TTL_MS) {
      processedInbound.delete(key)
    }
  }

  if (processedInbound.has(fingerprint)) {
    return true
  }

  processedInbound.set(fingerprint, now)
  return false
}

function enqueueUserTask(userNumber, task) {
  const previous = userQueues.get(userNumber) || Promise.resolve()
  const next = previous
    .then(task)
    .catch((error) => {
      console.error(`❌ User task failed for ${userNumber}:`, error)
    })

  userQueues.set(
    userNumber,
    next.finally(() => {
      if (userQueues.get(userNumber) === next) {
        userQueues.delete(userNumber)
      }
    })
  )

  return next
}

async function flushBufferedMessages(from) {
  const pending = pendingInbound.get(from)
  if (!pending) return

  pendingInbound.delete(from)
  const mergedMessage = pending.messages
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n")

  if (!mergedMessage) return

  await enqueueUserTask(from, () => handleUserMessage(from, mergedMessage))
}

function bufferInboundMessage(from, body) {
  const existing = pendingInbound.get(from) || { messages: [], timer: null }
  existing.messages.push(body)

  if (existing.timer) {
    clearTimeout(existing.timer)
  }

  existing.timer = setTimeout(() => {
    flushBufferedMessages(from).catch((error) => {
      console.error(`❌ Failed to flush buffered messages for ${from}:`, error)
    })
  }, INBOUND_DEBOUNCE_MS)

  pendingInbound.set(from, existing)
}

/* =====================
   DELAY + SEND HELPERS
===================== */
function estimateResponseDelayMs(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  const estimated = (words * 140) + Math.min(body.length * 12, 1800)
  return Math.max(MIN_RESPONSE_DELAY_MS, Math.min(MAX_RESPONSE_DELAY_MS, estimated))
}

function isDuplicateOutbound(state, body) {
  const normalized = normalizeText(body)
  const now = Date.now()

  if (
    normalized &&
    normalized === state.lastOutboundFingerprint &&
    now - state.lastOutboundAt < OUTBOUND_DUPLICATE_WINDOW_MS
  ) {
    return true
  }

  return false
}

async function sendThrottledMessage({ to, body, state }) {
  if (!body || !body.trim()) return

  if (isDuplicateOutbound(state, body)) {
    console.log(`♻️ Skipping duplicate outbound to ${to}`)
    return
  }

  const now = Date.now()
  const byTypingSpeed = estimateResponseDelayMs(body)
  const byCooldown = Math.max(0, (state.lastOutboundAt + OUTBOUND_COOLDOWN_MS) - now)
  const waitMs = Math.max(byTypingSpeed, byCooldown)

  if (waitMs > 0) {
    await delay(waitMs)
  }

  await twilioClient.messages.create({
    from: TWILIO_FROM,
    to: `whatsapp:${to}`,
    body
  })

  state.lastOutboundAt = Date.now()
  state.lastOutboundFingerprint = normalizeText(body)
}

async function sendTemplate(toNumber) {
  return twilioClient.messages.create({
    from: TWILIO_FROM,
    to: `whatsapp:${toNumber}`,
    contentSid: "HXfb26e732c302470271e7b20a3aee5032",
    contentVariables: JSON.stringify({ 1: "there" })
  })
}

async function triggerTemplateCampaign() {
  for (const number of TARGET_NUMBERS) {
    try {
      await sendTemplate(number)
      await delay(CAMPAIGN_STAGGER_MS)
    } catch (error) {
      console.error(`❌ Failed to send template to ${number}:`, error.message)
    }
  }
}

/* =====================
   PROMPTS
===================== */
const PROMPTS_DIR = path.join(process.cwd(), "Prompts")

function loadPrompt(filename) {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf8")
  } catch (error) {
    console.error(`⚠️ Prompt file missing: ${filename}`)
    return ""
  }
}

const PRODUCT_KNOWLEDGE = [
  loadPrompt("CoreRules.txt"),
  loadPrompt("StagePlaybook.txt"),
  loadPrompt("EarningsLogic.txt")
]
  .filter(Boolean)
  .join("\n\n")

const STRUCTURED_SYSTEM_PROMPT = `
[ROLE]
You are Tutorii's senior outbound WhatsApp sales consultant.

[PRIMARY OBJECTIVE]
Convert qualified interest into signups by guiding users logically and respectfully.

[STAGE MODEL]
1) initial: understand context and financial pressure, ask one simple question maximum.
2) interested: explain Tutorii clearly and position it as learning + optional referral earnings.
3) qualified: user is ready for next step; ask permission to share the signup link.
4) link_sent: link already shared; handle final support questions.

[NON-NEGOTIABLE RULES]
- Tutorii is not a job offer and not employment.
- Never guarantee income or fixed returns.
- No pressure tactics, urgency tricks, or hype claims.
- Do not send the signup link without clear user consent.
- If user declines, close politely and stop pushing.

[STYLE]
- Reply in 2-3 short sentences.
- Maximum 60 words.
- Ask at most one question.
- No bullet points, no markdown, no formatting.

[PRODUCT KNOWLEDGE]
${PRODUCT_KNOWLEDGE}
`.trim()

function buildStagePrompt(state) {
  return `
[LIVE CONTEXT]
Current stage: ${state.stage}
Link already sent: ${state.linkSent ? "yes" : "no"}

[STAGE-SPECIFIC INSTRUCTION]
${state.stage === "initial"
    ? "Acknowledge their situation and ask one short qualifying question. Do not pitch heavily."
    : ""}
${state.stage === "interested"
    ? "Give one concise explanation of Tutorii and connect value to their situation."
    : ""}
${state.stage === "qualified"
    ? "Ask for consent to send the link, unless consent is already explicit in the latest user message."
    : ""}
${state.stage === "link_sent"
    ? "Confirm next step briefly and answer remaining questions without re-selling."
    : ""}
`.trim()
}

/* =====================
   STAGE DETECTION
===================== */
const INTEREST_PATTERNS = [
  /\b(interested|tell me more|what is|what's this|how does it work|details|explain|price|cost|how much)\b/i,
  /\b(tutorii|subscription|commission|earning|referral|platform)\b/i
]

const QUALIFIED_PATTERNS = [
  /\b(send (me )?(the )?link|share (me )?(the )?link)\b/i,
  /\b(sign me up|register me|i want to join|how do i join|get started|start now)\b/i
]

const PROGRESSION_PATTERNS = [
  /\b(sounds good|makes sense|let's do it|go ahead|okay|ok|sure|yes)\b/i
]

const DECLINE_PATTERNS = [
  /\b(not interested|stop|no thanks|don't message|do not message|leave me)\b/i
]

function detectNextStage(state, message) {
  if (state.linkSent) return "link_sent"

  const text = normalizeText(message)
  if (!text) return state.stage

  if (DECLINE_PATTERNS.some((pattern) => pattern.test(text))) {
    return state.stage
  }

  if (QUALIFIED_PATTERNS.some((pattern) => pattern.test(text))) {
    return "qualified"
  }

  if (state.stage === "initial") {
    if (INTEREST_PATTERNS.some((pattern) => pattern.test(text))) {
      return "interested"
    }

    const userTurns = state.history.filter((item) => item.role === "user").length
    if (userTurns >= 2) {
      return "interested"
    }
  }

  if (state.stage === "interested") {
    if (PROGRESSION_PATTERNS.some((pattern) => pattern.test(text))) {
      return "qualified"
    }
  }

  return state.stage
}

/* =====================
   GPT FUNCTION
===================== */
async function generateGPTReply(history, state) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      temperature: 0.45,
      max_tokens: 220,
      messages: [
        { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
        { role: "system", content: buildStagePrompt(state) },
        ...history
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  )

  return response.data.choices?.[0]?.message?.content?.trim() || "Could you share a bit more so I can guide you correctly?"
}

/* =====================
   CONSENT CHECK
===================== */
function userGaveConsent(text) {
  const normalized = normalizeText(text)
  if (!normalized) return false

  if (/\b(no|not now|later|don't|do not)\b/i.test(normalized)) {
    return false
  }

  return [
    /\b(yes|yep|yeah|sure|okay|ok)\b/i,
    /\b(send (it|me|the)? ?link|share (it|the link)?)\b/i,
    /\b(i('| a)?m in|go ahead|let's do it|start now|sign me up|get started)\b/i
  ].some((pattern) => pattern.test(normalized))
}

/* =====================
   CORE LOGIC (ONLY PLACE THAT SENDS WHATSAPP)
===================== */
async function handleUserMessage(from, message) {
  const state = getUserState(from)

  pushHistory(state, "user", message)
  const nextStage = detectNextStage(state, message)
  advanceStage(from, nextStage)

  if (!state.linkSent && state.stage === "qualified" && userGaveConsent(message)) {
    const linkMessage =
      "Here’s the Tutorii link: https://tutorii.com. Use sponsor: TTRI-business-admin."

    await sendThrottledMessage({
      to: from,
      body: linkMessage,
      state
    })

    state.linkSent = true
    advanceStage(from, "link_sent")
    pushHistory(state, "assistant", linkMessage)
    return
  }

  const reply = await generateGPTReply(state.history, state)
  pushHistory(state, "assistant", reply)

  await sendThrottledMessage({
    to: from,
    body: reply,
    state
  })
}

/* =====================
   EXPRESS WEBHOOK
   (NO WHATSAPP SENDS HERE)
===================== */
const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

app.post("/webhook", (req, res) => {
  try {
    const from = normalizeNumber(req.body.From)
    const body = req.body.Body?.trim() || ""
    const messageSid =
      req.body.MessageSid ||
      req.body.SmsMessageSid ||
      req.body.SmsSid

    console.log("📩 Incoming:", from, body)
    res.sendStatus(200)

    // Admin trigger
    if (from === ADMIN_NUMBER && body.toLowerCase() === ADMIN_TRIGGER) {
      triggerTemplateCampaign().catch((error) => {
        console.error("❌ Campaign trigger failed:", error)
      })
      return
    }

    // Only process target users
    if (!TARGET_NUMBERS.has(from) || !body) {
      return
    }

    const inboundFingerprint = getInboundFingerprint({ messageSid, from, body })
    if (isDuplicateInbound(inboundFingerprint)) {
      console.log(`♻️ Duplicate inbound skipped for ${from}`)
      return
    }

    bufferInboundMessage(from, body)
  } catch (err) {
    console.error("❌ Webhook error:", err)
    if (!res.headersSent) {
      return res.sendStatus(500)
    }
  }
})

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
