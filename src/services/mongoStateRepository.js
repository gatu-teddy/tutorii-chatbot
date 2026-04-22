import mongoose from "mongoose"
import { STAGES } from "../constants/stages.js"
import { getChatUserModel } from "../models/chatUserModel.js"
import { getChatMessageModel } from "../models/chatMessageModel.js"

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
  let connection = null
  let UserModel = null
  let MessageModel = null

  function ensureInitialized() {
    if (!connection || !UserModel || !MessageModel) {
      throw new Error("Mongo repository not initialized")
    }
  }

  async function ensureUserRecord(userNumber) {
    ensureInitialized()

    const now = new Date()
    await UserModel.updateOne(
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
      connection = await mongoose.createConnection(uri, { dbName: databaseName, maxPoolSize: 50 }).asPromise()
      UserModel = getChatUserModel(connection)
      MessageModel = getChatMessageModel(connection)

      await Promise.all([
        UserModel.init(),
        MessageModel.init()
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
        UserModel.findById(userNumber).lean(),
        MessageModel.find({ userNumber })
          .sort({ _id: -1 })
          .limit(historyLimit)
          .lean()
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
          lastOutboundFingerprint: "",
          campaignCount: 0,
          lastCampaignAt: 0,
          lastCampaignStage: "",
          followUpCount: 0,
          lastInboundAt: 0,
          stalledSent: false,
          winBackSent: false,
          optedOutAt: 0,
          killswitchTriggered: false,
          killswitchTriggeredAt: 0,
          killswitchMessage: "",
          agentEmail: "",
          agentEmailCapturedAt: 0
        }
      }

      return {
        stage: normalizeStage(userDoc.stage),
        linkSent: Boolean(userDoc.linkSent),
        optedOut: Boolean(userDoc.optedOut),
        history,
        lastOutboundAt: Number(userDoc.lastOutboundAt) || 0,
        lastOutboundFingerprint: String(userDoc.lastOutboundFingerprint || ""),
        campaignCount: Number(userDoc.campaignCount) || 0,
        lastCampaignAt: Number(userDoc.lastCampaignAt) || 0,
        lastCampaignStage: String(userDoc.lastCampaignStage || ""),
        followUpCount: Number(userDoc.followUpCount) || 0,
        lastInboundAt: Number(userDoc.lastInboundAt) || 0,
        stalledSent: Boolean(userDoc.stalledSent),
        winBackSent: Boolean(userDoc.winBackSent),
        optedOutAt: Number(userDoc.optedOutAt) || 0,
        killswitchTriggered: Boolean(userDoc.killswitchTriggered),
        killswitchTriggeredAt: Number(userDoc.killswitchTriggeredAt) || 0,
        killswitchMessage: String(userDoc.killswitchMessage || ""),
        agentEmail: String(userDoc.agentEmail || ""),
        agentEmailCapturedAt: Number(userDoc.agentEmailCapturedAt) || 0
      }
    },

    async saveUserState(userNumber, state) {
      ensureInitialized()

      const now = new Date()
      await UserModel.updateOne(
        { _id: userNumber },
        {
          $set: {
            stage: normalizeStage(state.stage),
            linkSent: Boolean(state.linkSent),
            optedOut: Boolean(state.optedOut),
            lastOutboundAt: Number(state.lastOutboundAt) || 0,
            lastOutboundFingerprint: String(state.lastOutboundFingerprint || ""),
            campaignCount: Number(state.campaignCount) || 0,
            lastCampaignAt: Number(state.lastCampaignAt) || 0,
            lastCampaignStage: String(state.lastCampaignStage || ""),
            followUpCount: Number(state.followUpCount) || 0,
            lastInboundAt: Number(state.lastInboundAt) || 0,
            stalledSent: Boolean(state.stalledSent),
            winBackSent: Boolean(state.winBackSent),
            optedOutAt: Number(state.optedOutAt) || 0,
            killswitchTriggered: Boolean(state.killswitchTriggered),
            killswitchTriggeredAt: Number(state.killswitchTriggeredAt) || 0,
            killswitchMessage: String(state.killswitchMessage || ""),
            agentEmail: String(state.agentEmail || ""),
            agentEmailCapturedAt: Number(state.agentEmailCapturedAt) || 0,
            updatedAt: now
          },
          $setOnInsert: {
            createdAt: now
          }
        },
        { upsert: true }
      )
    },

    async setTimerSchedule(userNumber, field, scheduledAt) {
      ensureInitialized()
      const allowed = new Set(["followUpScheduledAt", "stalledScheduledAt", "winBackScheduledAt"])
      if (!allowed.has(field)) throw new Error(`Invalid timer field: ${field}`)
      await UserModel.updateOne(
        { _id: userNumber },
        { $set: { [field]: scheduledAt, updatedAt: new Date() } }
      )
    },

    async findUsersWithPendingTimers() {
      ensureInitialized()
      const now = Date.now()
      return UserModel.find({
        $or: [
          { followUpScheduledAt: { $gt: now } },
          { stalledScheduledAt: { $gt: now } },
          { winBackScheduledAt: { $gt: now } }
        ]
      }).select({ _id: 1, followUpScheduledAt: 1, stalledScheduledAt: 1, winBackScheduledAt: 1 }).lean()
    },

    async appendHistory(userNumber, role, content, requestedMaxHistoryMessages) {
      ensureInitialized()

      const historyLimit = toPositiveLimit(
        requestedMaxHistoryMessages,
        maxHistoryMessages
      )

      if (!content || !content.trim()) return

      await ensureUserRecord(userNumber)

      await MessageModel.create({
        userNumber,
        role,
        content: content.trim(),
        createdAt: new Date()
      })

      const overflowDocs = await MessageModel.find({ userNumber })
        .sort({ _id: -1 })
        .skip(historyLimit)
        .select({ _id: 1 })
        .lean()

      if (overflowDocs.length > 0) {
        await MessageModel.deleteMany({
          _id: { $in: overflowDocs.map((doc) => doc._id) }
        })
      }
    },

    async clearAllUserState() {
      ensureInitialized()
      const userResult = await ChatUser.deleteMany({})
      const msgResult = await ChatMessage.deleteMany({})
      return {
        usersDeleted: userResult.deletedCount || 0,
        messagesDeleted: msgResult.deletedCount || 0
      }
    },

    async close() {
      if (connection) {
        await connection.close()
      }
    }
  }
}
