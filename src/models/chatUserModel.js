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

export function getChatUserModel(connection) {
  return connection.models.ChatUser
    || connection.model("ChatUser", chatUserSchema, "chat_users")
}
