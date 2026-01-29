import fs from "fs"
import path from "path"
import express from "express"
import bodyParser from "body-parser"
import twilio from "twilio"
import OpenAI from "openai"

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
const openai = new OpenAI({ apiKey: OPENAI_KEY })

// --------------------
// Admin configuration
// --------------------
const ADMIN_NUMBER = "+971567728465" // Replace with your WhatsApp number
const ADMIN_TRIGGER = "Trigger max"     // Replace with your specific admin trigger message

// --------------------
// Target number to send messages to
// --------------------
const TARGET_NUMBER = "+254796143065" // Recipient of template & GPT reply

// --------------------
// Load prompts
// --------------------
const PROMPTS_DIR = path.join(process.cwd(), "prompts")
function loadPrompt(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf8")
}

const CORE_RULES = loadPrompt("CoreRules.txt")
const STAGE_PLAYBOOK = loadPrompt("StagePlaybook.txt")
const EARNINGS_LOGIC = loadPrompt("EarningsLogic.txt")
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
    messages: [
      { role: "system", content: CORE_RULES },
      { role: "system", content: STAGE_PLAYBOOK },
      { role: "system", content: EARNINGS_LOGIC },
      { role: "system", content: EARNING_EXAMPLES },
      { role: "system", content: OBJECTIONS },
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

  console.log("Received message from:", from)
  console.log("Message body:", body)

  // Only respond if from ADMIN and matches trigger
  if (from === ADMIN_NUMBER && body.toLowerCase() === ADMIN_TRIGGER.toLowerCase()) {
    try {
      // Step 1: Send approved template to target number
      const templateMsg = await sendTemplate(TARGET_NUMBER)
      console.log("Template sent:", templateMsg.sid)

      // Step 2: Generate GPT reply based on trigger
      const gptReply = await generateGPTReply(body)

      // Step 3: Send GPT reply to target number
      const gptMsg = await sendWhatsAppMessage(TARGET_NUMBER, gptReply)
      console.log("GPT reply sent:", gptMsg.sid)

      res.sendStatus(200)
    } catch (err) {
      console.error("Error sending messages:", err)
      res.sendStatus(500)
    }
  } else {
    console.log("Message ignored (not admin trigger)")
    res.sendStatus(200)
  }
})

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
