export function normalizeNumber(raw = "") {
  return String(raw).replace(/^whatsapp:/i, "").trim()
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

