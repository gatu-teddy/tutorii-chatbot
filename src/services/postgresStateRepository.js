import pg from "pg"
import { STAGES } from "../constants/stages.js"

const { Pool } = pg
const VALID_STAGES = new Set(Object.values(STAGES))
const DEFAULT_HISTORY_LIMIT = 20

function normalizeStage(stage) {
  return VALID_STAGES.has(stage) ? stage : STAGES.INITIAL
}

function toPositiveLimit(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function buildPoolConfig(postgresConfig = {}) {
  const ssl = postgresConfig.ssl ? { rejectUnauthorized: false } : undefined

  if (postgresConfig.connectionString) {
    return {
      connectionString: postgresConfig.connectionString,
      ssl
    }
  }

  return {
    host: postgresConfig.host,
    port: postgresConfig.port,
    user: postgresConfig.user,
    password: postgresConfig.password,
    database: postgresConfig.database,
    ssl
  }
}

export function createPostgresStateRepository({
  postgresConfig,
  defaultMaxHistoryMessages = DEFAULT_HISTORY_LIMIT
}) {
  const maxHistoryMessages = toPositiveLimit(
    defaultMaxHistoryMessages,
    DEFAULT_HISTORY_LIMIT
  )
  const pool = new Pool(buildPoolConfig(postgresConfig))

  async function ensureUserRecord(userNumber) {
    await pool.query(
      `
      INSERT INTO chat_users (user_number)
      VALUES ($1)
      ON CONFLICT (user_number) DO NOTHING
      `,
      [userNumber]
    )
  }

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_users (
          user_number TEXT PRIMARY KEY,
          stage TEXT NOT NULL DEFAULT '${STAGES.INITIAL}',
          link_sent BOOLEAN NOT NULL DEFAULT FALSE,
          opted_out BOOLEAN NOT NULL DEFAULT FALSE,
          last_outbound_at BIGINT NOT NULL DEFAULT 0,
          last_outbound_fingerprint TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGSERIAL PRIMARY KEY,
          user_number TEXT NOT NULL REFERENCES chat_users(user_number) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_user_number_id
        ON chat_messages (user_number, id DESC);
      `)
    },

    async loadUserState(userNumber, requestedMaxHistoryMessages) {
      const historyLimit = toPositiveLimit(
        requestedMaxHistoryMessages,
        maxHistoryMessages
      )

      await ensureUserRecord(userNumber)

      const [userResult, historyResult] = await Promise.all([
        pool.query(
          `
          SELECT
            stage,
            link_sent,
            opted_out,
            last_outbound_at,
            last_outbound_fingerprint
          FROM chat_users
          WHERE user_number = $1
          `,
          [userNumber]
        ),
        pool.query(
          `
          SELECT role, content
          FROM chat_messages
          WHERE user_number = $1
          ORDER BY id DESC
          LIMIT $2
          `,
          [userNumber, historyLimit]
        )
      ])

      const userRow = userResult.rows[0]
      const history = historyResult.rows
        .slice()
        .reverse()
        .map((row) => ({
          role: row.role,
          content: row.content
        }))

      if (!userRow) {
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
        stage: normalizeStage(userRow.stage),
        linkSent: Boolean(userRow.link_sent),
        optedOut: Boolean(userRow.opted_out),
        history,
        lastOutboundAt: Number(userRow.last_outbound_at) || 0,
        lastOutboundFingerprint: String(userRow.last_outbound_fingerprint || "")
      }
    },

    async saveUserState(userNumber, state) {
      await pool.query(
        `
        INSERT INTO chat_users (
          user_number,
          stage,
          link_sent,
          opted_out,
          last_outbound_at,
          last_outbound_fingerprint,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_number)
        DO UPDATE SET
          stage = EXCLUDED.stage,
          link_sent = EXCLUDED.link_sent,
          opted_out = EXCLUDED.opted_out,
          last_outbound_at = EXCLUDED.last_outbound_at,
          last_outbound_fingerprint = EXCLUDED.last_outbound_fingerprint,
          updated_at = NOW()
        `,
        [
          userNumber,
          normalizeStage(state.stage),
          Boolean(state.linkSent),
          Boolean(state.optedOut),
          Number(state.lastOutboundAt) || 0,
          String(state.lastOutboundFingerprint || "")
        ]
      )
    },

    async appendHistory(userNumber, role, content, requestedMaxHistoryMessages) {
      const historyLimit = toPositiveLimit(
        requestedMaxHistoryMessages,
        maxHistoryMessages
      )

      if (!content || !content.trim()) return

      await ensureUserRecord(userNumber)

      await pool.query(
        `
        INSERT INTO chat_messages (user_number, role, content)
        VALUES ($1, $2, $3)
        `,
        [userNumber, role, content.trim()]
      )

      await pool.query(
        `
        DELETE FROM chat_messages
        WHERE user_number = $1
          AND id NOT IN (
            SELECT id
            FROM chat_messages
            WHERE user_number = $1
            ORDER BY id DESC
            LIMIT $2
          )
        `,
        [userNumber, historyLimit]
      )
    },

    async close() {
      await pool.end()
    }
  }
}
