import express from "express"
import bodyParser from "body-parser"
import { normalizeNumber } from "../utils/index.js"

export function createServer({ config, conversationEngine }) {
  const app = express()
  app.use(bodyParser.urlencoded({ extended: false }))

  app.post("/webhook", (req, res) => {
    try {
      const from = normalizeNumber(req.body.From)
      const body = req.body.Body?.trim() || ""
      const messageSid =
        req.body.MessageSid ||
        req.body.SmsMessageSid ||
        req.body.SmsSid

      console.log("📩 Incoming:", from, body)
      res.sendStatus(200)

      if (from === config.admin.number && body.toLowerCase() === config.admin.trigger) {
        conversationEngine.triggerTemplateCampaign().catch((error) => {
          console.error("❌ Campaign trigger failed:", error.message)
        })
        return
      }

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
