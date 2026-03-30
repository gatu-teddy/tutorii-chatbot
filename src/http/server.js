import express from "express"
import bodyParser from "body-parser"
import twilio from "twilio"
import { normalizeNumber } from "../utils/index.js"
import { createAdminRouter } from "./admin/routes.js"

export function createServer({ config, conversationEngine, targetsManager }) {
  const app = express()
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use("/admin", createAdminRouter({ config, conversationEngine, targetsManager }))

  const emptyTwimlResponse = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>"

  app.post("/webhook", (req, res) => {
    try {
      // Validate Twilio signature when BASE_URL is configured.
      // Skip in local dev (no BASE_URL) so you can test with ngrok without extra setup.
      if (config.baseUrl) {
        const twilioSignature = req.headers["x-twilio-signature"] || ""
        const webhookUrl = `${config.baseUrl}/webhook`
        const isValid = twilio.validateRequest(
          config.twilio.authToken,
          twilioSignature,
          webhookUrl,
          req.body
        )
        if (!isValid) {
          console.warn("⚠️ Rejected webhook — invalid Twilio signature")
          return res.sendStatus(403)
        }
      }

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
