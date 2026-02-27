import { Router } from "express"
import { createAdminSessionManager } from "./sessionManager.js"
import { renderDashboardPage, renderLoginPage } from "./views.js"

function readQueryValue(query, key) {
  return typeof query?.[key] === "string" ? query[key] : ""
}

function redirectWithMessage(res, type, message) {
  const encoded = encodeURIComponent(message)
  res.redirect(`/admin?${type}=${encoded}`)
}

export function createAdminRouter({ config, conversationEngine, targetsManager }) {
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
    const targets = targetsManager.listTargets()
    res.status(200).send(renderDashboardPage({
      status,
      targets,
      targetCount: targets.length,
      notice: readQueryValue(req.query, "notice"),
      error: readQueryValue(req.query, "error")
    }))
  })

  router.post("/campaign/trigger", sessions.requireAdmin, (req, res) => {
    try {
      const result = conversationEngine.startTemplateCampaign()

      if (!result.started) {
        redirectWithMessage(res, "error", "Campaign is already running")
        return
      }

      redirectWithMessage(res, "notice", "Campaign started")
    } catch (error) {
      console.error("❌ Dashboard campaign trigger failed:", error.message)
      redirectWithMessage(res, "error", "Could not start campaign")
    }
  })

  router.post("/targets/add", sessions.requireAdmin, (req, res) => {
    try {
      const result = targetsManager.addTarget(req.body.target)
      if (result.added) {
        redirectWithMessage(res, "notice", `Target added: ${result.target}`)
        return
      }

      redirectWithMessage(res, "notice", `Target already exists: ${result.target}`)
    } catch (error) {
      redirectWithMessage(res, "error", error.message)
    }
  })

  router.post("/targets/delete", sessions.requireAdmin, (req, res) => {
    try {
      const result = targetsManager.deleteTarget(req.body.target)
      if (result.deleted) {
        redirectWithMessage(res, "notice", `Target deleted: ${result.target}`)
        return
      }

      redirectWithMessage(res, "error", `Target not found: ${result.target}`)
    } catch (error) {
      redirectWithMessage(res, "error", error.message)
    }
  })

  router.post("/targets/import-json", sessions.requireAdmin, (req, res) => {
    try {
      const result = targetsManager.importTargetsFromJson(req.body.targetsJson)
      redirectWithMessage(
        res,
        "notice",
        `JSON imported: ${result.addedCount} added, ${result.duplicateCount} duplicates`
      )
    } catch (error) {
      redirectWithMessage(res, "error", error.message)
    }
  })

  return router
}
