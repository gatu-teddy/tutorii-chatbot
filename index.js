import fs from "fs"
import path from "path"
import express from "express"
import bodyParser from "body-parser"
import twilio from "twilio"
import OpenAI from "openai"
//import {OpenRouter} from "@openrouter/sdk"

// --------------------
// ENV VARIABLES
// --------------------
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, OPENAI_KEY } = process.env

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !OPENAI_KEY) {
  console.error("Missing environment variables.")
  process.exit(1)
}

// --------------------
// Twilio client
// --------------------
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

// --------------------
// OpenAI client
// --------------------
//const openrouter = new OpenRouter({ apiKey: GPT_API_KEY })
const openai = new OpenAI({ apiKey: OPENAI_KEY })

// --------------------
// Admin configuration
// --------------------
const ADMIN_NUMBER = "+971567728465" // Replace with your WhatsApp number
const ADMIN_TRIGGER = "Trigger max"     // Replace with your specific admin trigger message

// --------------------
// Target number to send messages to
// --------------------
const TARGET_NUMBER = "+971523534063" // Recipient of template & GPT reply

// --------------------
// Load prompts
// --------------------
const PROMPTS_DIR = path.join(process.cwd(), "Prompts")
function loadPrompt(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf8")
}

const CORE_RULES = loadPrompt("CoreRules.txt")
const STAGE_PLAYBOOK = loadPrompt("StagePlaybook.txt")
const EARNINGS_LOGIC = loadPrompt("EarningsLogic.txt")

const SYSTEM_PROMPT = [
  CORE_RULES,
  STAGE_PLAYBOOK,
  EARNINGS_LOGIC
].join("\n\n")
//const EARNING_EXAMPLES = loadPrompt("earning_examples.txt")
//const OBJECTIONS = loadPrompt("objections.txt")

// --------------------
// Twilio send functions
// --------------------
async function sendTemplate(toNumber) {
  return twilioClient.messages.create({
    from: "whatsapp:+971504095079",  // Replace with your Twilio WhatsApp number
    to: `whatsapp:${toNumber}`,
    contentSid: "HXf5f95d60ca9dc0f4ce743de60376fbb2", // Replace with your approved template SID
    contentVariables: JSON.stringify({ 1: "there" }) // Template variables
  })
}

async function sendWhatsAppMessage(toNumber, text) {
  return twilioClient.messages.create({
    from: "whatsapp:+971504095079",  // Your Twilio WhatsApp number
    to: `whatsapp:${toNumber}`,
    body: text
  })
}

// --------------------
// GPT reply function
// --------------------
async function generateGPTReply(userMessage) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    //model: "mistralai/mistral-7b-instruct",
    max_tokens: 400,
    temperature: 0.6,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      //{ role: "system", content: STAGE_PLAYBOOK },
      //{ role: "system", content: EARNINGS_LOGIC },
      //{ role: "system", content: EARNING_EXAMPLES },
      //{ role: "system", content: OBJECTIONS },
      { role: "user", content: userMessage }
    ]
  })

  return completion.choices[0].message.content
}

// --------------------
// Express webhook server
// --------------------
const app = express()
app.use(bodyParser.urlencoded({ extended: false }))

app.post("/webhook", async (req, res) => {
  const from = req.body.From.replace("whatsapp:", "")
  const body = req.body.Body.trim()

  console.log("Received message from:", from, "body:", body)

  try {
    // --- Admin trigger ---
    if (from === ADMIN_NUMBER && body.toLowerCase() === ADMIN_TRIGGER.toLowerCase()) {
      const templateMsg = await sendTemplate(TARGET_NUMBER)
      console.log("Template sent to target:", templateMsg.sid)
      return res.sendStatus(200)
    }

    // --- User replies ---
    if (from === TARGET_NUMBER) {
      const gptReply = await generateGPTReply(body)
      const gptMsg = await sendWhatsAppMessage(TARGET_NUMBER, gptReply)
      console.log("GPT reply sent to user:", gptMsg.sid)
      return res.sendStatus(200)
    }

    // Ignore other numbers
    console.log("Message ignored")
    return res.sendStatus(200)
  } catch (err) {
    console.error("Error handling message:", err)
    return res.sendStatus(500)
  }
})
// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
