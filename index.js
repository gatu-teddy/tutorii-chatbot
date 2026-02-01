import fs from "fs"
import path from "path"
import express from "express"
import bodyParser from "body-parser"
import twilio from "twilio"
import axios from "axios"

// --------------------
// ENV VARIABLES
// --------------------
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  GPT_API_KEY
} = process.env

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !GPT_API_KEY) {
  console.error("❌ Missing environment variables.")
  process.exit(1)
}

console.log("✅ GPT_API_KEY loaded:", !!GPT_API_KEY)

// --------------------
// Twilio client
// --------------------
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

// --------------------
// Admin configuration
// --------------------
const ADMIN_NUMBER = "+971567728465"
const ADMIN_TRIGGER = "trigger max"

// --------------------
// Target number
// --------------------
const TARGET_NUMBER = "+254796143065"

// --------------------
// Load prompts
// --------------------
const PROMPTS_DIR = path.join(process.cwd(), "Prompts")

function loadPrompt(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf8")
}

const SYSTEM_PROMPT = [
  loadPrompt("CoreRules.txt"),
  loadPrompt("StagePlaybook.txt"),
  loadPrompt("EarningsLogic.txt")
].join("\n\n")

const LENGTH_RULE = `Reply in 2–3 short sentences. Maximum 60 words. Ask only one question. No formatting.`

// --------------------
// Twilio send functions
// --------------------
async function sendTemplate(toNumber) {
  return twilioClient.messages.create({
    from: "whatsapp:+971504095079",
    to: `whatsapp:${toNumber}`,
    contentSid: "HXf5f95d60ca9dc0f4ce743de60376fbb2",
    contentVariables: JSON.stringify({ 1: "there" })
  })
}

async function sendWhatsAppMessage(toNumber, text) {
  return twilioClient.messages.create({
    from: "whatsapp:+971504095079",
    to: `whatsapp:${toNumber}`,
    body: text
  })
}

// --------------------
// OpenRouter GPT function
// --------------------
async function generateGPTReply(userMessage) {
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        max_tokens: 300,
        temperature: 0.6,
        messages: [
          { role: "system", content: LENGTH_RULE },
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${GPT_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tutorii.com",
          "X-Title": "Tutorii WhatsApp Bot"
        }
      }
    )

    return response.data.choices[0].message.content

  } catch (err) {
    console.error("❌ OpenRouter ERROR")
    console.error("Message:", err.message)
    console.error("Status:", err.response?.status)
    console.error("Headers:", err.response?.headers)
    console.error("Data:", JSON.stringify(err.response?.data, null, 2))
    throw err
  }
}

// --------------------
// Express webhook server
// --------------------
const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

app.post("/webhook", async (req, res) => {
  const from = req.body.From?.replace("whatsapp:", "")
  const body = req.body.Body?.trim()

  console.log("📩 Incoming:", from, body)

  try {
    // Admin trigger
    if (from === ADMIN_NUMBER && body.toLowerCase() === ADMIN_TRIGGER) {
      await sendTemplate(TARGET_NUMBER)
      console.log("✅ Template sent")
      return res.sendStatus(200)
    }

    // User reply
    if (from === TARGET_NUMBER) {
      const reply = await generateGPTReply(body)
      await sendWhatsAppMessage(TARGET_NUMBER, reply)
      console.log("✅ GPT reply sent")
      return res.sendStatus(200)
    }

    return res.sendStatus(200)

  } catch (err) {
    console.error("❌ Webhook error")
    return res.sendStatus(500)
  }
})

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
