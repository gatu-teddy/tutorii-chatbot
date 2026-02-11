import fs from "fs"
import path from "path"
import express from "express"
import bodyParser from "body-parser"
import twilio from "twilio"
import axios from "axios"

/* =====================
   ENV VARIABLES
===================== */
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
   OPENAI_KEY,
  GPT_API_KEY
} = process.env

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !GPT_API_KEY) {
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

const TARGET_NUMBERS = [
  "+254796143065",
   "+971567728465",
   "+447826939737",
  "+971501830069"
  //"+971523534063"
]

/* =====================
   IN-MEMORY USER STATE
===================== */
const userState = {}

function getUserState(userNumber) {
  if (!userState[userNumber]) {
    userState[userNumber] = {
      stage: "STAGE_1",
      linkSent: false,
      history: []
    }
  }
  return userState[userNumber]
}

function advanceStage(userNumber, nextStage) {
  userState[userNumber].stage = nextStage
}

/* =====================
   DELAY + SEND HELPERS
===================== */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendDelayedMessage({ to, body }) {
  await delay(30000)

  return twilioClient.messages.create({
    from: "whatsapp:+971504095079",
    to: `whatsapp:${to}`,
    body
  })
}

async function sendTemplate(toNumber) {
  return twilioClient.messages.create({
    from: "whatsapp:+971504095079",
    to: `whatsapp:${toNumber}`,
    contentSid: "HXf5f95d60ca9dc0f4ce743de60376fbb2",
    contentVariables: JSON.stringify({ 1: "there" })
  })
}

/* =====================
   PROMPTS
===================== */
const PROMPTS_DIR = path.join(process.cwd(), "Prompts")

function loadPrompt(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf8")
}

const SYSTEM_PROMPT = [
  loadPrompt("CoreRules.txt"),
  loadPrompt("StagePlaybook.txt"),
  loadPrompt("EarningsLogic.txt")
].join("\n\n")

const LENGTH_RULE =
  "Reply in 2–3 short sentences. Maximum 60 words. Ask only one question. No formatting."

/* =====================
   GPT FUNCTION
===================== */
async function generateGPTReply(history, userMessage) {
  const response = await axios.post(
    //"https://openrouter.ai/api/v1/chat/completions",
     "https://api.openai.com/v1/chat/completions",
    {
      //model: "mistralai/mistral-7b-instruct",
       model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 300,
      messages: [
        { role: "system", content: LENGTH_RULE },
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: userMessage }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json"
        //"HTTP-Referer": "https://tutorii.com",
        //"X-Title": "Tutorii WhatsApp Bot"
      }
    }
  )

  return response.data.choices[0].message.content
}

/* =====================
   CONSENT CHECK
===================== */
function userGaveConsent(text) {
  return /^(yes|ok|sure|send|send it|okay)$/i.test(text)
}

/* =====================
   CORE LOGIC (ONLY PLACE THAT SENDS WHATSAPP)
===================== */
async function handleUserMessage(from, message) {
  const state = getUserState(from)

  // Save user message
  state.history.push({ role: "user", content: message })

  let reply = ""

  switch (state.stage) {
    case "STAGE_1":
      reply = await generateGPTReply(state.history, message)
      advanceStage(from, "STAGE_2")
      break

    case "STAGE_2":
      reply = await generateGPTReply(state.history, message)
      advanceStage(from, "STAGE_3")
      break

    case "STAGE_3":
      reply = await generateGPTReply(state.history, message)
      advanceStage(from, "STAGE_10")
      break

    case "STAGE_10":
      if (userGaveConsent(message) && !state.linkSent) {
        await sendDelayedMessage({
          to: from,
          body:
            "Here’s the Tutorii link:\nhttps://tutorii.com\nUse sponsor: TTRI-business-admin"
        })
        state.linkSent = true
        return
      }

      reply = await generateGPTReply(state.history, message)
      break

    default:
      reply = await generateGPTReply(state.history, message)
  }

  // Save assistant reply
  state.history.push({ role: "assistant", content: reply })

  await sendDelayedMessage({
    to: from,
    body: reply
  })
}

/* =====================
   EXPRESS WEBHOOK
   (NO WHATSAPP SENDS HERE)
===================== */
const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

app.post("/webhook", async (req, res) => {
  try {
    const from = req.body.From?.replace("whatsapp:", "")
    const body = req.body.Body?.trim() || ""

    console.log("📩 Incoming:", from, body)

    // Admin trigger
    if (from === ADMIN_NUMBER && body.toLowerCase() === ADMIN_TRIGGER) {
      for (const number of TARGET_NUMBERS) {
        await sendTemplate(number)
      }
      return res.sendStatus(200)
    }

    // Only process target users
    if (TARGET_NUMBERS.includes(from)) {
      await handleUserMessage(from, body)
    }

    // EXACTLY ONE RESPONSE
    return res.sendStatus(200)

  } catch (err) {
    console.error("❌ Webhook error:", err)
    return res.sendStatus(500)
  }
})

/* =====================
   START SERVER
===================== */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
