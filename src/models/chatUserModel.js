import mongoose from "mongoose"
import { STAGES } from "../constants/stages.js"

const chatUserSchema = new mongoose.Schema(
  {
    _id: { type: String },
    stage: { type: String, default: STAGES.INITIAL },
    linkSent: { type: Boolean, default: false },
    optedOut: { type: Boolean, default: false },
    lastOutboundAt: { type: Number, default: 0 },
    lastOutboundFingerprint: { type: String, default: "" },
    // Re-engagement tracking
    campaignCount: { type: Number, default: 0 },
    lastCampaignAt: { type: Number, default: 0 },
    lastCampaignStage: { type: String, default: "" },
    followUpCount: { type: Number, default: 0 },
    lastInboundAt: { type: Number, default: 0 },
    stalledSent: { type: Boolean, default: false },
    winBackSent: { type: Boolean, default: false },
    optedOutAt: { type: Number, default: 0 },
    // Killswitch — set permanently if user threatens legal/regulatory action.
    // Bot ignores all future inbound and is excluded from all future campaigns.
    killswitchTriggered: { type: Boolean, default: false },
    killswitchTriggeredAt: { type: Number, default: 0 },
    killswitchMessage: { type: String, default: "" },
    // Agent email capture (the email they want their account set up under)
    agentEmail: { type: String, default: "" },
    agentEmailCapturedAt: { type: Number, default: 0 },
    // Provisioning state — written by the Tutorii platform's polling job
    accountProvisioned: { type: Boolean, default: false },
    provisionedAt: { type: Number, default: 0 },
    tutoriiUserId: { type: String, default: "" },
    welcomeWhatsAppSent: { type: Boolean, default: false },
    welcomeSentAt: { type: Number, default: 0 },
    // Credential delivery — platform writes these, bot reads and sends via WhatsApp
    accountCreated: { type: Boolean, default: false },
    loginEmail: { type: String, default: "" },
    loginPassword: { type: String, default: "" },
    loginUrl: { type: String, default: "" },
    notificationSent: { type: Boolean, default: false },
    notificationSentAt: { type: Number, default: 0 },
    // Timer persistence — Unix ms timestamps of when each timer should fire (0 = not scheduled)
    followUpScheduledAt: { type: Number, default: 0 },
    stalledScheduledAt: { type: Number, default: 0 },
    winBackScheduledAt: { type: Number, default: 0 },
    createdAt: { type: Date },
    updatedAt: { type: Date }
  },
  { versionKey: false }
)

chatUserSchema.index({ updatedAt: -1 })
// Indexes for platform & bot polling queries — keeps lookups fast at scale
chatUserSchema.index({ linkSent: 1, accountProvisioned: 1 })
chatUserSchema.index({ accountProvisioned: 1, welcomeWhatsAppSent: 1 })
chatUserSchema.index({ accountCreated: 1, notificationSent: 1 })  // bot: find accounts ready for credential delivery

export function getChatUserModel(connection) {
  return connection.models.ChatUser
    || connection.model("ChatUser", chatUserSchema, "chat_users")
}
