export function normalizeNumber(raw = "") {
  return String(raw).replace(/^whatsapp:/i, "").trim()
}

// Node's setTimeout silently overflows above 2^31-1 ms and fires immediately.
// Use this for any delay that might exceed ~24.8 days (e.g. win-back timers).
export function safeSetTimeout(fn, ms) {
  const MAX_MS = 2_000_000_000 // ~23.1 days — safely under the 32-bit limit
  if (ms <= MAX_MS) {
    return setTimeout(fn, ms)
  }
  // Chain into a second setTimeout for the remainder
  return setTimeout(() => safeSetTimeout(fn, ms - MAX_MS), MAX_MS)
}

export function normalizeText(text = "") {
  return String(text).toLowerCase().trim().replace(/\s+/g, " ")
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function toPositiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function createSemaphore(maxConcurrent) {
  let active = 0
  const queue = []

  return {
    async acquire() {
      if (active < maxConcurrent) {
        active++
        return
      }
      await new Promise((resolve) => queue.push(resolve))
    },
    release() {
      if (queue.length > 0) {
        queue.shift()()
      } else {
        active--
      }
    }
  }
}

