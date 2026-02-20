import { STAGES, STAGE_RANK } from "../constants/stages.js"

const userStateByNumber = new Map()

export function getUserState(userNumber) {
  if (!userStateByNumber.has(userNumber)) {
    userStateByNumber.set(userNumber, {
      stage: STAGES.INITIAL,
      linkSent: false,
      optedOut: false,
      history: [],
      lastOutboundAt: 0,
      lastOutboundFingerprint: ""
    })
  }

  return userStateByNumber.get(userNumber)
}

export function advanceStage(state, nextStage) {
  const currentRank = STAGE_RANK[state.stage] ?? 0
  const nextRank = STAGE_RANK[nextStage] ?? 0

  if (nextRank > currentRank) {
    state.stage = nextStage
  }
}

export function appendHistory(state, role, content, maxHistoryMessages) {
  if (!content || !content.trim()) return

  state.history.push({ role, content })

  if (state.history.length > maxHistoryMessages) {
    state.history.splice(0, state.history.length - maxHistoryMessages)
  }
}
