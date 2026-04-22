import mongoose from "mongoose"
import { normalizeNumber } from "../utils/index.js"
import { buildMongoUri, resolveDatabaseName } from "./mongoStateRepository.js"
import { getCampaignTargetModel } from "../models/campaignTargetModel.js"

const DEFAULT_COLLECTION_NAME = "campaign_targets"

function normalizeTargets(rawTargets = []) {
  return [...new Set(rawTargets.map((item) => normalizeNumber(item)).filter(Boolean))]
}

export function createMongoTargetsRepository({
  mongoConfig,
  seedTargets = [],
  collectionName = DEFAULT_COLLECTION_NAME
}) {
  const uri = buildMongoUri(mongoConfig)
  const databaseName = resolveDatabaseName(mongoConfig)
  const normalizedSeedTargets = normalizeTargets(seedTargets)

  let connection = null
  let TargetModel = null

  function ensureInitialized() {
    if (!connection || !TargetModel) {
      throw new Error("Mongo targets repository not initialized")
    }
  }

  async function seedDefaultsIfCollectionEmpty() {
    ensureInitialized()

    if (!normalizedSeedTargets.length) {
      return
    }

    const existingCount = await TargetModel.estimatedDocumentCount()
    if (existingCount > 0) {
      return
    }

    const now = new Date()
    await TargetModel.insertMany(
      normalizedSeedTargets.map((number) => ({
        number,
        createdAt: now,
        updatedAt: now
      })),
      { ordered: false }
    )
  }

  return {
    async init() {
      connection = await mongoose.createConnection(uri, { dbName: databaseName }).asPromise()
      TargetModel = getCampaignTargetModel(connection, collectionName)

      await TargetModel.init()

      await seedDefaultsIfCollectionEmpty()
    },

    async listTargets() {
      ensureInitialized()

      const docs = await TargetModel.find({}, { _id: 0, number: 1 })
        .sort({ number: 1 })
        .lean()

      return docs.map((doc) => doc.number).filter(Boolean)
    },

    async addTarget(rawTarget) {
      ensureInitialized()

      const normalized = normalizeNumber(rawTarget)
      if (!normalized) {
        throw new Error("Target number is required")
      }

      const now = new Date()
      const result = await TargetModel.updateOne(
        { number: normalized },
        {
          $set: { updatedAt: now },
          $setOnInsert: { number: normalized, createdAt: now }
        },
        { upsert: true }
      )

      return {
        target: normalized,
        added: result.upsertedCount > 0
      }
    },

    async deleteTarget(rawTarget) {
      ensureInitialized()

      const normalized = normalizeNumber(rawTarget)
      if (!normalized) {
        throw new Error("Target number is required")
      }

      const result = await TargetModel.deleteOne({ number: normalized })

      return {
        target: normalized,
        deleted: result.deletedCount > 0
      }
    },

    async addManyTargets(rawTargets) {
      ensureInitialized()

      const targets = normalizeTargets(rawTargets)
      if (!targets.length) {
        throw new Error("No valid targets to import")
      }

      const now = new Date()
      const operations = targets.map((number) => ({
        updateOne: {
          filter: { number },
          update: {
            $set: { updatedAt: now },
            $setOnInsert: { number, createdAt: now }
          },
          upsert: true
        }
      }))

      const result = await TargetModel.bulkWrite(operations, { ordered: false })
      const addedCount = result.upsertedCount || 0

      return {
        importedCount: targets.length,
        addedCount,
        duplicateCount: targets.length - addedCount
      }
    },

    async deleteAllTargets() {
      ensureInitialized()

      const result = await TargetModel.deleteMany({})

      return { deletedCount: result.deletedCount || 0 }
    },

    async close() {
      if (connection) {
        await connection.close()
      }
    }
  }
}
