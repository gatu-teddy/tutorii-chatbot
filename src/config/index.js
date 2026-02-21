import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import { normalizeNumber, toPositiveNumber } from "../utils/index.js"

dotenv.config()

const DEFAULT_TARGET_NUMBERS = [
  "+254796143065",
  "+971567728465",
  "+447826939737",
  "+971501830069",
  "+923045172021"
]

const PROMPTS_DIR = path.join(process.cwd(), "prompts")
const TARGETS_FILE = path.join(process.cwd(), "targets.json")

function loadTargetNumbers() {
  if (!fs.existsSync(TARGETS_FILE)) {
    return new Set(DEFAULT_TARGET_NUMBERS)
  }

  try {
    const raw = fs.readFileSync(TARGETS_FILE, "utf8")
    const parsed = JSON.parse(raw)

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

function getRequired(key, value) {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }

  return value
}

const openAIApiKey = process.env.OPENAI_KEY || process.env.GPT_API_KEY
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || ""
const mongoEnabled = Boolean(mongoUri || process.env.MONGODB_HOST)

export const config = {
  port: toPositiveNumber(process.env.PORT, 3000),
  promptsDir: PROMPTS_DIR,
  targets: loadTargetNumbers(),
  admin: {
    number: normalizeNumber(process.env.ADMIN_NUMBER || "+971567728465"),
    trigger: String(process.env.ADMIN_TRIGGER || "trigger max")
      .trim()
      .toLowerCase()
  },
  twilio: {
    accountSid: getRequired("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID),
    authToken: getRequired("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN),
    from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+971504095079",
    templateSid: process.env.TWILIO_TEMPLATE_SID || "HXfb26e732c302470271e7b20a3aee5032"
  },
  openai: {
    apiKey: getRequired("OPENAI_KEY or GPT_API_KEY", openAIApiKey),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: Number.isFinite(Number(process.env.OPENAI_TEMPERATURE))
      ? Number(process.env.OPENAI_TEMPERATURE)
      : 0.6,
    maxTokens: toPositiveNumber(process.env.OPENAI_MAX_TOKENS, 220),
    frequencyPenalty: Number.isFinite(Number(process.env.OPENAI_FREQUENCY_PENALTY))
      ? Number(process.env.OPENAI_FREQUENCY_PENALTY)
      : 0.3,
    presencePenalty: Number.isFinite(Number(process.env.OPENAI_PRESENCE_PENALTY))
      ? Number(process.env.OPENAI_PRESENCE_PENALTY)
      : 0.15
  },
  campaign: {
    staggerMs: toPositiveNumber(process.env.CAMPAIGN_STAGGER_MS, 1800)
  },
  conversation: {
    inboundDedupeTtlMs: toPositiveNumber(process.env.INBOUND_DEDUPE_TTL_MS, 5 * 60 * 1000),
    inboundDebounceMs: toPositiveNumber(process.env.INBOUND_DEBOUNCE_MS, 2200),
    outboundCooldownMs: toPositiveNumber(process.env.OUTBOUND_COOLDOWN_MS, 2500),
    outboundDuplicateWindowMs: toPositiveNumber(
      process.env.OUTBOUND_DUPLICATE_WINDOW_MS,
      45 * 1000
    ),
    minResponseDelayMs: toPositiveNumber(process.env.MIN_RESPONSE_DELAY_MS, 1200),
    maxResponseDelayMs: toPositiveNumber(process.env.MAX_RESPONSE_DELAY_MS, 7000),
    maxHistoryMessages: toPositiveNumber(process.env.MAX_HISTORY_MESSAGES, 20)
  },
  mongodb: {
    enabled: mongoEnabled,
    uri: mongoUri,
    host: process.env.MONGODB_HOST || "127.0.0.1",
    port: toPositiveNumber(process.env.MONGODB_PORT, 27017),
    user: process.env.MONGODB_USER || "",
    password: process.env.MONGODB_PASSWORD || "",
    database: process.env.MONGODB_DB || "tutorii_chatbot",
    authSource: process.env.MONGODB_AUTH_SOURCE || ""
  },
  links: {
    signup: process.env.TUTORII_SIGNUP_LINK || "https://tutorii.com",
    sponsorCode: process.env.TUTORII_SPONSOR_CODE || "TTRI-business-admin"
  }
}
