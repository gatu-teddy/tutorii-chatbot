import express from "express"
import bodyParser from "body-parser"
import { normalizeNumber } from "../utils/index.js"
import { createAdminRouter } from "./admin/routes.js"
import { createTargetsManager } from "../services/targetsManager.js"

export function createServer({ config, conversationEngine }) {
  const app = express()
  app.use(bodyParser.urlencoded({ extended: false }))
  const targetsManager = createTargetsManager({
    targetsSet: config.targets,
    targetsFile: config.targetsFile
  })
  app.use("/admin", createAdminRouter({ config, conversationEngine, targetsManager }))

  const emptyTwimlResponse = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>"

  app.post("/webhook", (req, res) => {
    try {
      const from = normalizeNumber(req.body.From)
      const body = req.body.Body?.trim() || ""
      const messageSid =
        req.body.MessageSid ||
        req.body.SmsMessageSid ||
        req.body.SmsSid

      console.log("📩 Incoming:", from, body)
      // Twilio webhooks should receive empty TwiML. sendStatus(200) returns body "OK",
      // which can appear as an unwanted outbound message.
      res.status(200).type("text/xml").send(emptyTwimlResponse)

      if (!config.targets.has(from) || !body) {
        return
      }

      conversationEngine.processInbound({
        from,
        body,
        messageSid
      })
    } catch (error) {
      console.error("❌ Webhook error:", error.message)
      if (!res.headersSent) {
        res.sendStatus(500)
      }
    }
  })

  return app
}
