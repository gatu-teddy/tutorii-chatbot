import crypto from "crypto"

const ADMIN_SESSION_COOKIE = "admin_session"

function safeDecode(value = "") {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function parseCookies(rawCookieHeader = "") {
  return String(rawCookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=")
      if (separatorIndex <= 0) {
        return acc
      }

      const key = part.slice(0, separatorIndex).trim()
      const value = part.slice(separatorIndex + 1).trim()
      acc[key] = safeDecode(value)
      return acc
    }, {})
}

function secureEquals(left = "", right = "") {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest()
  const rightHash = crypto.createHash("sha256").update(String(right)).digest()
  return crypto.timingSafeEqual(leftHash, rightHash)
}

export function createAdminSessionManager({
  sessionTtlMs,
  secureCookie,
  expectedUsername,
  expectedPassword
}) {
  const sessions = new Map()

  function purgeExpiredSessions() {
    const now = Date.now()

    for (const [sessionId, session] of sessions.entries()) {
      if (session.expiresAt <= now) {
        sessions.delete(sessionId)
      }
    }
  }

  function setSessionCookie(res, sessionId) {
    const maxAgeSeconds = Math.max(1, Math.floor(sessionTtlMs / 1000))
    const parts = [
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      `Max-Age=${maxAgeSeconds}`
    ]

    if (secureCookie) {
      parts.push("Secure")
    }

    res.setHeader("Set-Cookie", parts.join("; "))
  }

  function clearSessionCookie(res) {
    const parts = [
      `${ADMIN_SESSION_COOKIE}=`,
      "HttpOnly",
      "Path=/",
      "SameSite=Lax",
      "Max-Age=0"
    ]

    if (secureCookie) {
      parts.push("Secure")
    }

    res.setHeader("Set-Cookie", parts.join("; "))
  }

  function getSessionId(req) {
    const cookies = parseCookies(req.headers.cookie || "")
    return cookies[ADMIN_SESSION_COOKIE] || ""
  }

  function getActiveSession(req, res) {
    purgeExpiredSessions()

    const sessionId = getSessionId(req)
    if (!sessionId) {
      return null
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return null
    }

    if (session.expiresAt <= Date.now()) {
      sessions.delete(sessionId)
      return null
    }

    session.expiresAt = Date.now() + sessionTtlMs
    sessions.set(sessionId, session)
    setSessionCookie(res, sessionId)

    return {
      sessionId,
      ...session
    }
  }

  function requireAdmin(req, res, next) {
    const session = getActiveSession(req, res)
    if (!session) {
      res.redirect("/admin/login")
      return
    }

    req.adminSession = session
    next()
  }

  function isValidCredentials(username, password) {
    return (
      secureEquals(username, expectedUsername) &&
      secureEquals(password, expectedPassword)
    )
  }

  function createSession(res, username) {
    const sessionId = crypto.randomBytes(24).toString("hex")

    sessions.set(sessionId, {
      username,
      expiresAt: Date.now() + sessionTtlMs
    })
    setSessionCookie(res, sessionId)

    return sessionId
  }

  function destroySession(req, res) {
    const sessionId = getSessionId(req)
    if (sessionId) {
      sessions.delete(sessionId)
    }

    clearSessionCookie(res)
  }

  return {
    getActiveSession,
    requireAdmin,
    isValidCredentials,
    createSession,
    destroySession
  }
}
