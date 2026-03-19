import path from "path"
import dotenv from "dotenv"
import { toPositiveNumber } from "../utils/index.js"

dotenv.config()

const DEFAULT_TARGET_NUMBERS = [
  "+254796143065",
  "+971567728465",
  "+447826939737",
  "+971501830069",
  "+923045172021"
]

const PROMPTS_DIR = path.join(process.cwd(), "prompts")

function getRequired(key, value) {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`)
  }

  return value
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  const normalized = String(value).trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return fallback
}

const openAIApiKey = process.env.OPENAI_KEY || process.env.GPT_API_KEY
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || ""
const mongoEnabled = Boolean(mongoUri || process.env.MONGODB_HOST)

export const config = {
  port: toPositiveNumber(process.env.PORT, 3000),
  promptsDir: PROMPTS_DIR,
  targets: new Set(DEFAULT_TARGET_NUMBERS),
  defaultTargets: DEFAULT_TARGET_NUMBERS.slice(),
  adminUi: {
    username: process.env.ADMIN_UI_USERNAME || "admin",
    password: process.env.ADMIN_UI_PASSWORD || "change-me",
    sessionTtlMs: toPositiveNumber(process.env.ADMIN_UI_SESSION_TTL_MS, 8 * 60 * 60 * 1000),
    secureCookie: toBoolean(process.env.ADMIN_UI_SECURE_COOKIE, false)
  },
  twilio: {
    accountSid: getRequired("TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID),
    authToken: getRequired("TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN),
    from: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+971504095079",
    templateSid: process.env.TWILIO_TEMPLATE_SID || "HXfb26e732c302470271e7b20a3aee5032",
    // Win-back re-engagement template — must be a pre-approved WhatsApp template in Twilio.
    // Set TWILIO_WIN_BACK_TEMPLATE_SID in your environment when you have one ready.
    winBackTemplateSid: process.env.TWILIO_WIN_BACK_TEMPLATE_SID || ""
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
    inboundDebounceMs: toPositiveNumber(process.env.INBOUND_DEBOUNCE_MS, 1 * 60 * 1000),
    outboundCooldownMs: toPositiveNumber(process.env.OUTBOUND_COOLDOWN_MS, 2500),
    outboundDuplicateWindowMs: toPositiveNumber(
      process.env.OUTBOUND_DUPLICATE_WINDOW_MS,
      45 * 1000
    ),
    minResponseDelayMs: toPositiveNumber(process.env.MIN_RESPONSE_DELAY_MS, 1200),
    maxResponseDelayMs: toPositiveNumber(process.env.MAX_RESPONSE_DELAY_MS, 7000),
    maxHistoryMessages: toPositiveNumber(process.env.MAX_HISTORY_MESSAGES, 20),
    // Re-engagement delays
    stalledDelayMs: toPositiveNumber(process.env.STALLED_DELAY_MS, 3 * 24 * 60 * 60 * 1000),   // 3 days
    winBackDelayMs: toPositiveNumber(process.env.WIN_BACK_DELAY_MS, 30 * 24 * 60 * 60 * 1000)  // 30 days
  },
  mongodb: {
    enabled: mongoEnabled,
    uri: mongoUri,
    host: process.env.MONGODB_HOST || "127.0.0.1",
    port: toPositiveNumber(process.env.MONGODB_PORT, 27017),
    user: process.env.MONGODB_USER || "",
    password: process.env.MONGODB_PASSWORD || "",
    database: process.env.MONGODB_DB || "tutorii_chatbot",
    authSource: process.env.MONGODB_AUTH_SOURCE || "",
    targetsCollection: process.env.MONGODB_TARGETS_COLLECTION || "campaign_targets"
  },
  links: {
    signup: process.env.TUTORII_SIGNUP_LINK || "https://tutorii.com",
    sponsorCode: process.env.TUTORII_SPONSOR_CODE || "TTRI-business-admin"
  }
}
