import { STAGES } from "../constants/stages.js"
import { normalizeText } from "../utils/index.js"

const INTEREST_PATTERNS = [
  /\b(interested|tell me more|what is|what's this|how does it work|details|explain)\b/i,
  /\b(price|cost|how much|subscription|commission|earning|referral)\b/i,
  /\b(tutorii|platform)\b/i
]

const QUALIFIED_PATTERNS = [
  /\b(send (me )?(the )?link|share (me )?(the )?link)\b/i,
  /\b(sign me up|register me|i want to join|how do i join|get started|start now)\b/i
]

const PROGRESSION_PATTERNS = [
  /\b(sounds good|makes sense|go ahead|let's do it|okay|ok|sure|yes)\b/i
]

const CONSENT_PATTERNS = [
  /\b(yes|yep|yeah|sure|okay|ok)\b/i,
  /\b(send (it|me|the)? ?link|share (it|the link)?)\b/i,
  /\b(i('| a)?m in|go ahead|let's do it|start now|sign me up|get started)\b/i
]

const OPT_OUT_PATTERNS = [
  /\b(stop|unsubscribe|remove me|do not message|don't message|not interested|leave me alone)\b/i
]

const NEGATIVE_CONSENT_PATTERNS = [
  /\b(no|not now|later|don't|do not)\b/i
]

function hasMatch(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

function userAskedQuestion(text) {
  return text.includes("?")
}

export function userOptedOut(message) {
  return hasMatch(normalizeText(message), OPT_OUT_PATTERNS)
}

export function userGaveConsent(message) {
  const text = normalizeText(message)
  if (!text) return false

  if (hasMatch(text, NEGATIVE_CONSENT_PATTERNS)) {
    return false
  }

  return hasMatch(text, CONSENT_PATTERNS)
}

export function detectNextStage(state, message) {
  if (state.linkSent) return STAGES.LINK_SENT

  const text = normalizeText(message)
  if (!text) return state.stage
  if (userOptedOut(text)) return state.stage

  if (hasMatch(text, QUALIFIED_PATTERNS)) {
    return STAGES.QUALIFIED
  }

  if (state.stage === STAGES.INITIAL) {
    const userTurns = state.history.filter((item) => item.role === "user").length

    if (hasMatch(text, INTEREST_PATTERNS) || userAskedQuestion(text) || userTurns >= 2) {
      return STAGES.INTERESTED
    }
  }

  if (state.stage === STAGES.INTERESTED && hasMatch(text, PROGRESSION_PATTERNS)) {
    return STAGES.QUALIFIED
  }

  return state.stage
}
