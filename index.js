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

//---
//user state
//
const userState = {}

function getUserState(userNumber) {
  if (!userState[userNumber]) {
    userState[userNumber] = {
      stage: "STAGE_1", // default starting stage
      linkSent: false,
      history: []
    }
  }
  return userState[userNumber]
}

function advanceStage(userNumber, nextStage) {
  const state = getUserState(userNumber)
  state.stage = nextStage
}

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

function userGaveConsent(text) {
  return /^(yes|yeah|yep|sure|send|send it|okay|cool|great|definitely|ok|fine)$/i.test(text)
}

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
async function generateGPTReply(history, userMessage) {
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
          ...history,
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

async function handleUserMessage(from, message) {
  const state = getUserState(from);

  // 1️⃣ Save user message to history
  state.history.push({ role: "user", content: message });

  let reply = "";

  // 2️⃣ Generate GPT reply based on full history
  if (state.stage === "STAGE_1") {
    reply = await generateGPTReply(state.history, message);
    advanceStage(from, "STAGE_2");
  } else if (state.stage === "STAGE_2") {
    reply = await generateGPTReply(state.history, message);
    advanceStage(from, "STAGE_3");
  } else if (state.stage === "STAGE_3") {
    reply = await generateGPTReply(state.history, message);
    // Decide next stage based on user objection or not
    if (/no|not interested|don't want|never/i.test(message)) {
      advanceStage(from, "STAGE_9"); // user objects → stage 9
    } else {
      advanceStage(from, "STAGE_10"); // normal flow → stage 10
    }
  } else if (state.stage === "STAGE_9") {
    // Stage 9: Objection handling
    reply = await generateGPTReply(state.history, message);

    // Optionally, decide if they come back to stage 10 later
    if (/ok|sure|maybe/i.test(message)) {
      advanceStage(from, "STAGE_10");
    }
  } else if (state.stage === "STAGE_10") {
    if (/yes|sure|ok|send/i.test(message) && !state.linkSent) {
      await sendWhatsAppMessage(from, "Here’s the Tutorii link to get started: https://tutorii.com");
      state.linkSent = true;
      reply = "✅ Link sent. You can explore Tutorii now.";
    } else {
      reply = await generateGPTReply(state.history, message);
    }
  } else {
    reply = await generateGPTReply(state.history, message);
  }

  // 3️⃣ Save assistant reply to history
  state.history.push({ role: "assistant", content: reply });

  return reply;
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
  // User reply
if (from === TARGET_NUMBER) {
  const state = getUserState(from) // unified state

  // 1️⃣ If user consented and stage is closing
  if (userGaveConsent(body) && state.stage === "STAGE_10" && !state.linkSent) {
    await sendWhatsAppMessage(
      from,
      "Here’s the link to explore Tutorii:\nhttps://tutorii.com"
    )
    state.linkSent = true
    console.log("✅ Link sent after user consent")
    return res.sendStatus(200)
  }

  // 2️⃣ If link already sent → do nothing
  if (state.linkSent) {
    console.log("ℹ️ Link already sent, ignoring further messages")
    return res.sendStatus(200)
  }

  // 3️⃣ Otherwise → GPT may respond and advance stage
  const reply = await handleUserMessage(from, body)
  await sendWhatsAppMessage(TARGET_NUMBER, reply)

  console.log("✅ GPT reply sent / action taken")
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
