import { STAGES, STAGE_RANK } from "../constants/stages.js"

const userStateByNumber = new Map()
let stateRepository = null

function createDefaultState() {
  return {
    stage: STAGES.INITIAL,
    linkSent: false,
    optedOut: false,
    history: [],
    lastOutboundAt: 0,
    lastOutboundFingerprint: "",
    lastOutboundContextKey: ""
  }
}

export function setStateRepository(repository) {
  stateRepository = repository || null
}

export async function getUserState(userNumber, maxHistoryMessages) {
  if (userStateByNumber.has(userNumber)) {
    return userStateByNumber.get(userNumber)
  }

  let state = createDefaultState()

  if (stateRepository) {
    try {
      const loadedState = await stateRepository.loadUserState(
        userNumber,
        maxHistoryMessages
      )
      if (loadedState) {
        state = loadedState
      }
    } catch (error) {
      console.error(`❌ Failed to load state for ${userNumber}:`, error.message)
    }
  }

  state.lastOutboundContextKey = String(state.lastOutboundContextKey || "")
  userStateByNumber.set(userNumber, state)
  return state
}

export async function persistUserState(userNumber, state) {
  if (!stateRepository) return

  try {
    await stateRepository.saveUserState(userNumber, state)
  } catch (error) {
    console.error(`❌ Failed to persist state for ${userNumber}:`, error.message)
  }
}

export async function appendHistory(userNumber, state, role, content, maxHistoryMessages) {
  if (!content || !content.trim()) return

  state.history.push({ role, content })

  if (state.history.length > maxHistoryMessages) {
    state.history.splice(0, state.history.length - maxHistoryMessages)
  }

  if (!stateRepository) return

  try {
    await stateRepository.appendHistory(
      userNumber,
      role,
      content,
      maxHistoryMessages
    )
  } catch (error) {
    console.error(`❌ Failed to persist history for ${userNumber}:`, error.message)
  }
}

export function advanceStage(state, nextStage) {
  const currentRank = STAGE_RANK[state.stage] ?? 0
  const nextRank = STAGE_RANK[nextStage] ?? 0

  if (nextRank > currentRank) {
    state.stage = nextStage
  }
}
