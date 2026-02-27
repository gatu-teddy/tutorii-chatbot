import { MongoClient } from "mongodb"
import { STAGES } from "../constants/stages.js"

const VALID_STAGES = new Set(Object.values(STAGES))
const DEFAULT_HISTORY_LIMIT = 20
const DEFAULT_DB_NAME = "tutorii_chatbot"

function normalizeStage(stage) {
  return VALID_STAGES.has(stage) ? stage : STAGES.INITIAL
}

function toPositiveLimit(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export function resolveDatabaseName(mongoConfig = {}) {
  if (mongoConfig.database) {
    return mongoConfig.database
  }

  if (mongoConfig.uri) {
    try {
      const parsed = new URL(mongoConfig.uri)
      const path = parsed.pathname.replace(/^\//, "")
      if (path) {
        return path
      }
    } catch (error) {
      // Fall through to default database name.
    }
  }

  return DEFAULT_DB_NAME
}

export function buildMongoUri(mongoConfig = {}) {
  if (mongoConfig.uri) {
    return mongoConfig.uri
  }

  const host = mongoConfig.host || "127.0.0.1"
  const port = mongoConfig.port || 27017
  const database = resolveDatabaseName(mongoConfig)
  const user = mongoConfig.user ? encodeURIComponent(mongoConfig.user) : ""
  const password = mongoConfig.password ? encodeURIComponent(mongoConfig.password) : ""
  const authSource = mongoConfig.authSource || ""

  let credentials = ""
  if (user && password) {
    credentials = `${user}:${password}@`
  } else if (user) {
    credentials = `${user}@`
  }

  const params = new URLSearchParams()
  if (authSource) {
    params.set("authSource", authSource)
  }

  const query = params.toString()
  return `mongodb://${credentials}${host}:${port}/${database}${query ? `?${query}` : ""}`
}

export function createMongoStateRepository({
  mongoConfig,
  defaultMaxHistoryMessages = DEFAULT_HISTORY_LIMIT
}) {
  const maxHistoryMessages = toPositiveLimit(
    defaultMaxHistoryMessages,
    DEFAULT_HISTORY_LIMIT
  )
  const uri = buildMongoUri(mongoConfig)
  const databaseName = resolveDatabaseName(mongoConfig)
  const client = new MongoClient(uri)

  let usersCollection = null
  let messagesCollection = null

  function ensureInitialized() {
    if (!usersCollection || !messagesCollection) {
      throw new Error("Mongo repository not initialized")
    }
  }

  async function ensureUserRecord(userNumber) {
    ensureInitialized()

    const now = new Date()
    await usersCollection.updateOne(
      { _id: userNumber },
      {
        $setOnInsert: {
          _id: userNumber,
          stage: STAGES.INITIAL,
          linkSent: false,
          optedOut: false,
          lastOutboundAt: 0,
          lastOutboundFingerprint: "",
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    )
  }

  return {
    async init() {
      await client.connect()

      const db = client.db(databaseName)
      usersCollection = db.collection("chat_users")
      messagesCollection = db.collection("chat_messages")

      await Promise.all([
        usersCollection.createIndex({ updatedAt: -1 }),
        messagesCollection.createIndex({ userNumber: 1, _id: -1 })
      ])
    },

    async loadUserState(userNumber, requestedMaxHistoryMessages) {
      ensureInitialized()

      const historyLimit = toPositiveLimit(
        requestedMaxHistoryMessages,
        maxHistoryMessages
      )

      await ensureUserRecord(userNumber)

      const [userDoc, historyDocs] = await Promise.all([
        usersCollection.findOne({ _id: userNumber }),
        messagesCollection
          .find({ userNumber })
          .sort({ _id: -1 })
          .limit(historyLimit)
          .toArray()
      ])

      const history = historyDocs
        .slice()
        .reverse()
        .map((item) => ({
          role: item.role,
          content: item.content
        }))

      if (!userDoc) {
        return {
          stage: STAGES.INITIAL,
          linkSent: false,
          optedOut: false,
          history,
          lastOutboundAt: 0,
          lastOutboundFingerprint: ""
        }
      }

      return {
        stage: normalizeStage(userDoc.stage),
        linkSent: Boolean(userDoc.linkSent),
        optedOut: Boolean(userDoc.optedOut),
        history,
        lastOutboundAt: Number(userDoc.lastOutboundAt) || 0,
        lastOutboundFingerprint: String(userDoc.lastOutboundFingerprint || "")
      }
    },

    async saveUserState(userNumber, state) {
      ensureInitialized()

      const now = new Date()
      await usersCollection.updateOne(
        { _id: userNumber },
        {
          $set: {
            stage: normalizeStage(state.stage),
            linkSent: Boolean(state.linkSent),
            optedOut: Boolean(state.optedOut),
            lastOutboundAt: Number(state.lastOutboundAt) || 0,
            lastOutboundFingerprint: String(state.lastOutboundFingerprint || ""),
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      )
    },

    async appendHistory(userNumber, role, content, requestedMaxHistoryMessages) {
      ensureInitialized()

      const historyLimit = toPositiveLimit(
        requestedMaxHistoryMessages,
        maxHistoryMessages
      )

      if (!content || !content.trim()) return

      await ensureUserRecord(userNumber)

      await messagesCollection.insertOne({
        userNumber,
        role,
        content: content.trim(),
        createdAt: new Date()
      })

      const overflowDocs = await messagesCollection
        .find({ userNumber })
        .sort({ _id: -1 })
        .skip(historyLimit)
        .project({ _id: 1 })
        .toArray()

      if (overflowDocs.length > 0) {
        await messagesCollection.deleteMany({
          _id: { $in: overflowDocs.map((doc) => doc._id) }
        })
      }
    },

    async close() {
      await client.close()
    }
  }
}
