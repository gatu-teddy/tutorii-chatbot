import { delay, normalizeText } from "../utils/index.js"
import { STAGES } from "../constants/stages.js"
import {
  appendHistory,
  advanceStage,
  getUserState,
  persistUserState
} from "./stateStore.js"

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

  function isDuplicateOutbound(state, body, dedupeContextKey) {
    const normalized = normalizeText(body)
    const now = Date.now()

    return (
      normalized &&
      dedupeContextKey &&
      dedupeContextKey === state.lastOutboundContextKey &&
      normalized === state.lastOutboundFingerprint &&
      now - state.lastOutboundAt < config.conversation.outboundDuplicateWindowMs
    )
  }

  function isLowQualityAssistantReply(reply) {
    const normalized = normalizeText(reply)
    if (!normalized) return true

    if (["ok", "okay", "k", "alright", "noted", "fine"].includes(normalized)) {
      return true
    }

    const genericRoboticPatterns = [
      /\bhow can i assist you today\b/i,
      /\bhow may i assist you today\b/i,
      /\bhow can i help you today\b/i
    ]
    if (genericRoboticPatterns.some((pattern) => pattern.test(normalized))) {
      return true
    }

    const words = normalized.split(/\s+/).filter(Boolean)
    return words.length === 1 && words[0].length <= 3
  }

  function buildFallbackReply(stage) {
    switch (stage) {
      case STAGES.INITIAL:
        return "Hey, good to hear from you. How is your job search going these days?"
      case STAGES.INTERESTED:
        return "Quick one: Tutorii is a learning platform with optional referral earnings, not a job. Want a short breakdown?"
      case STAGES.QUALIFIED:
        return "If you want, I can send the signup link now."
      case STAGES.LINK_SENT:
        return "Nice, once you open it I can guide you step by step."
      default:
        return "Got you. What would you like to know first?"
    }
  }

  async function sendThrottledMessage({ to, body, state, dedupeContextKey = "" }) {
    if (!body || !body.trim()) return

    if (isDuplicateOutbound(state, body, dedupeContextKey)) {
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
    state.lastOutboundContextKey = dedupeContextKey
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
    const state = await getUserState(from, config.conversation.maxHistoryMessages)
    const outboundContextKey = normalizeText(message).slice(0, 200)

    if (state.optedOut) {
      return
    }

    await appendHistory(
      from,
      state,
      "user",
      message,
      config.conversation.maxHistoryMessages
    )

    const messages = promptManager.buildMessages({
      state,
      history: state.history
    })

    const turn = await openAIClient.generateTurn(messages)

    if (turn.markOptedOut) {
      state.optedOut = true
      const closeMessage =
        "Understood. I will not send more messages. If you need details later, message anytime."

      await appendHistory(
        from,
        state,
        "assistant",
        closeMessage,
        config.conversation.maxHistoryMessages
      )
      await sendThrottledMessage({
        to: from,
        body: closeMessage,
        state,
        dedupeContextKey: outboundContextKey
      })
      await persistUserState(from, state)
      return
    }

    advanceStage(state, turn.nextStage)
    const canSendLinkNow =
      !state.linkSent &&
      turn.sendLinkNow &&
      (state.stage === STAGES.QUALIFIED || state.stage === STAGES.LINK_SENT)

    if (canSendLinkNow) {
      const linkMessage = `Here is the Tutorii link: ${config.links.signup}. Use sponsor: ${config.links.sponsorCode}.`

      await sendThrottledMessage({
        to: from,
        body: linkMessage,
        state,
        dedupeContextKey: outboundContextKey
      })

      state.linkSent = true
      advanceStage(state, STAGES.LINK_SENT)
      await appendHistory(
        from,
        state,
        "assistant",
        linkMessage,
        config.conversation.maxHistoryMessages
      )
      await persistUserState(from, state)
      return
    }

    let reply = turn.reply
    if (isLowQualityAssistantReply(reply)) {
      reply = buildFallbackReply(state.stage)
    }

    await appendHistory(
      from,
      state,
      "assistant",
      reply,
      config.conversation.maxHistoryMessages
    )

    await sendThrottledMessage({
      to: from,
      body: reply,
      state,
      dedupeContextKey: outboundContextKey
    })
    await persistUserState(from, state)
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
