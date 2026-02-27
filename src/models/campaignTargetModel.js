import mongoose from "mongoose"

const campaignTargetSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true }
  },
  { versionKey: false }
)

campaignTargetSchema.index({ number: 1 }, { unique: true })
campaignTargetSchema.index({ updatedAt: -1 })

function toModelName(collectionName) {
  return `CampaignTarget_${String(collectionName).replace(/[^A-Za-z0-9]/g, "_")}`
}

export function getCampaignTargetModel(connection, collectionName) {
  const modelName = toModelName(collectionName)

  return connection.models[modelName]
    || connection.model(modelName, campaignTargetSchema, collectionName)
}
