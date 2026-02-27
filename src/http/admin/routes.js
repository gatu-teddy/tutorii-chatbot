import { Router } from "express"
import { createAdminSessionManager } from "./sessionManager.js"
import { renderDashboardPage, renderLoginPage } from "./views.js"

function readQueryValue(query, key) {
  return typeof query?.[key] === "string" ? query[key] : ""
}

export function createAdminRouter({ config, conversationEngine }) {
  const router = Router()
  const sessions = createAdminSessionManager({
    sessionTtlMs: config.adminUi.sessionTtlMs,
    secureCookie: config.adminUi.secureCookie,
    expectedUsername: config.adminUi.username,
    expectedPassword: config.adminUi.password
  })

  router.get("/login", (req, res) => {
    const existingSession = sessions.getActiveSession(req, res)
    if (existingSession) {
      res.redirect("/admin")
      return
    }

    res.status(200).send(renderLoginPage({
      error: readQueryValue(req.query, "error")
    }))
  })

  router.post("/login", (req, res) => {
    const username = String(req.body.username || "").trim()
    const password = String(req.body.password || "")

    if (!sessions.isValidCredentials(username, password)) {
      res.redirect("/admin/login?error=Invalid%20credentials")
      return
    }

    sessions.createSession(res, username)
    res.redirect("/admin")
  })

  router.post("/logout", (req, res) => {
    sessions.destroySession(req, res)
    res.redirect("/admin/login")
  })

  router.get("/", sessions.requireAdmin, (req, res) => {
    const status = conversationEngine.getCampaignStatus()
    res.status(200).send(renderDashboardPage({
      status,
      targetCount: config.targets.size,
      notice: readQueryValue(req.query, "notice"),
      error: readQueryValue(req.query, "error")
    }))
  })

  router.post("/campaign/trigger", sessions.requireAdmin, (req, res) => {
    try {
      const result = conversationEngine.startTemplateCampaign()

      if (!result.started) {
        res.redirect("/admin?error=Campaign%20is%20already%20running")
        return
      }

      res.redirect("/admin?notice=Campaign%20started")
    } catch (error) {
      console.error("❌ Dashboard campaign trigger failed:", error.message)
      res.redirect("/admin?error=Could%20not%20start%20campaign")
    }
  })

  return router
}
