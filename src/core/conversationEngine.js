import { delay, normalizeText } from "../utils/index.js"
import { STAGES } from "../constants/stages.js"
import { appendHistory, advanceStage, getUserState } from "./stateStore.js"
import { detectNextStage, userGaveConsent, userOptedOut } from "./stageEngine.js"

export function createConversationEngine({
  twilioClient,
  openAIClient,
  promptManager,
  config
}) {
  const userQueues = new Map()
  const processedInbound = new Map()
  const pendingInbound = new Map()

  function getInboundFingerprint({ messageSid, from, body }) {
    const normalizedBody = normalizeText(body).slice(0, 200)

    if (messageSid) {
      return `sid:${messageSid}`
    }

    // Fallback to short time buckets when provider does not supply a stable SID.
    const timeBucket = Math.floor(Date.now() / 30000)
    return `fallback:${from}:${normalizedBody}:${timeBucket}`
  }

  function isDuplicateInbound(fingerprint) {
    const now = Date.now()

    for (const [key, createdAt] of processedInbound.entries()) {
      if (now - createdAt > config.conversation.inboundDedupeTtlMs) {
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
        console.error(`❌ User task failed for ${userNumber}:`, error.message)
      })

    userQueues.set(
      userNumber,
      next.finally(() => {
        if (userQueues.get(userNumber) === next) {
          userQueues.delete(userNumber)
        }
      })
    )
  }

  function estimateResponseDelayMs(body) {
    const words = body.trim().split(/\s+/).filter(Boolean).length
    const estimated = (words * 140) + Math.min(body.length * 12, 1800)
    const minDelay = config.conversation.minResponseDelayMs
    const maxDelay = Math.max(minDelay, config.conversation.maxResponseDelayMs)

    return Math.max(minDelay, Math.min(maxDelay, estimated))
  }

  function isDuplicateOutbound(state, body) {
    const normalized = normalizeText(body)
    const now = Date.now()

    return (
      normalized &&
      normalized === state.lastOutboundFingerprint &&
      now - state.lastOutboundAt < config.conversation.outboundDuplicateWindowMs
    )
  }

  async function sendThrottledMessage({ to, body, state }) {
    if (!body || !body.trim()) return

    if (isDuplicateOutbound(state, body)) {
      console.log(`♻️ Skipping duplicate outbound to ${to}`)
      return
    }

    const now = Date.now()
    const byTypingSpeed = estimateResponseDelayMs(body)
    const byCooldown = Math.max(
      0,
      (state.lastOutboundAt + config.conversation.outboundCooldownMs) - now
    )
    const waitMs = Math.max(byTypingSpeed, byCooldown)

    if (waitMs > 0) {
      await delay(waitMs)
    }

    await twilioClient.messages.create({
      from: config.twilio.from,
      to: `whatsapp:${to}`,
      body
    })

    state.lastOutboundAt = Date.now()
    state.lastOutboundFingerprint = normalizeText(body)
  }

  async function sendTemplate(toNumber) {
    return twilioClient.messages.create({
      from: config.twilio.from,
      to: `whatsapp:${toNumber}`,
      contentSid: config.twilio.templateSid,
      contentVariables: JSON.stringify({ 1: "there" })
    })
  }

  async function handleUserMessage(from, message) {
    const state = getUserState(from)

    if (state.optedOut) {
      return
    }

    appendHistory(state, "user", message, config.conversation.maxHistoryMessages)

    if (userOptedOut(message)) {
      state.optedOut = true
      const closeMessage =
        "Understood. I will not send more messages. If you need details later, message anytime."

      appendHistory(state, "assistant", closeMessage, config.conversation.maxHistoryMessages)
      await sendThrottledMessage({ to: from, body: closeMessage, state })
      return
    }

    const nextStage = detectNextStage(state, message)
    advanceStage(state, nextStage)

    if (!state.linkSent && state.stage === STAGES.QUALIFIED && userGaveConsent(message)) {
      const linkMessage = `Here is the Tutorii link: ${config.links.signup}. Use sponsor: ${config.links.sponsorCode}.`

      await sendThrottledMessage({
        to: from,
        body: linkMessage,
        state
      })

      state.linkSent = true
      advanceStage(state, STAGES.LINK_SENT)
      appendHistory(state, "assistant", linkMessage, config.conversation.maxHistoryMessages)
      return
    }

    const messages = promptManager.buildMessages({
      state,
      history: state.history
    })

    const reply = await openAIClient.generateReply(messages)
    appendHistory(state, "assistant", reply, config.conversation.maxHistoryMessages)

    await sendThrottledMessage({
      to: from,
      body: reply,
      state
    })
  }

  async function flushBufferedMessages(from) {
    const pending = pendingInbound.get(from)
    if (!pending) return

    if (pending.timer) {
      clearTimeout(pending.timer)
    }

    pendingInbound.delete(from)
    const mergedMessage = pending.messages
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n")

    if (!mergedMessage) return

    enqueueUserTask(from, () => handleUserMessage(from, mergedMessage))
  }

  function bufferInboundMessage(from, body) {
    const existing = pendingInbound.get(from) || { messages: [], timer: null }
    existing.messages.push(body)

    if (existing.timer) {
      clearTimeout(existing.timer)
    }

    existing.timer = setTimeout(() => {
      flushBufferedMessages(from).catch((error) => {
        console.error(`❌ Failed to flush buffered messages for ${from}:`, error.message)
      })
    }, config.conversation.inboundDebounceMs)

    pendingInbound.set(from, existing)
  }

  function processInbound({ from, body, messageSid }) {
    if (!body || !body.trim()) {
      return
    }

    const inboundFingerprint = getInboundFingerprint({ messageSid, from, body })
    if (isDuplicateInbound(inboundFingerprint)) {
      console.log(`♻️ Duplicate inbound skipped for ${from}`)
      return
    }

    bufferInboundMessage(from, body)
  }

  async function triggerTemplateCampaign() {
    for (const number of config.targets) {
      try {
        await sendTemplate(number)
        await delay(config.campaign.staggerMs)
      } catch (error) {
        console.error(`❌ Failed to send template to ${number}:`, error.message)
      }
    }
  }

  return {
    processInbound,
    triggerTemplateCampaign
  }
}
