import mongoose from "mongoose"

const chatMessageSchema = new mongoose.Schema(
  {
    userNumber: { type: String, required: true },
    role: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, required: true }
  },
  { versionKey: false }
)

chatMessageSchema.index({ userNumber: 1, _id: -1 })

export function getChatMessageModel(connection) {
  return connection.models.ChatMessage
    || connection.model("ChatMessage", chatMessageSchema, "chat_messages")
}
