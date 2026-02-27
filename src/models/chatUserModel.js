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
