import { MongoClient } from "mongodb"
import { normalizeNumber } from "../utils/index.js"
import { buildMongoUri, resolveDatabaseName } from "./mongoStateRepository.js"

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
  const client = new MongoClient(uri)
  const normalizedSeedTargets = normalizeTargets(seedTargets)

  let targetsCollection = null

  function ensureInitialized() {
    if (!targetsCollection) {
      throw new Error("Mongo targets repository not initialized")
    }
  }

  async function seedDefaultsIfCollectionEmpty() {
    ensureInitialized()

    if (!normalizedSeedTargets.length) {
      return
    }

    const existingCount = await targetsCollection.estimatedDocumentCount()
    if (existingCount > 0) {
      return
    }

    const now = new Date()
    await targetsCollection.insertMany(
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
      await client.connect()

      const db = client.db(databaseName)
      targetsCollection = db.collection(collectionName)

      await Promise.all([
        targetsCollection.createIndex({ number: 1 }, { unique: true }),
        targetsCollection.createIndex({ updatedAt: -1 })
      ])

      await seedDefaultsIfCollectionEmpty()
    },

    async listTargets() {
      ensureInitialized()

      const docs = await targetsCollection
        .find({}, { projection: { _id: 0, number: 1 } })
        .sort({ number: 1 })
        .toArray()

      return docs.map((doc) => doc.number).filter(Boolean)
    },

    async addTarget(rawTarget) {
      ensureInitialized()

      const normalized = normalizeNumber(rawTarget)
      if (!normalized) {
        throw new Error("Target number is required")
      }

      const now = new Date()
      const result = await targetsCollection.updateOne(
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

      const result = await targetsCollection.deleteOne({ number: normalized })

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

      const result = await targetsCollection.bulkWrite(operations, { ordered: false })
      const addedCount = result.upsertedCount || 0

      return {
        importedCount: targets.length,
        addedCount,
        duplicateCount: targets.length - addedCount
      }
    },

    async close() {
      await client.close()
    }
  }
}
