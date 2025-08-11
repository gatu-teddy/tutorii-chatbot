import express from "express";
import twilio from "twilio";
import axios from "axios";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const ADMIN_NUMBER = "whatsapp:+971567728465";
const TARGET_NUMBER = "whatsapp:+971582554362";
const TRIGGER_KEYWORD = "trigger max";
const CONTENT_SID = "HX9eff360b577f37795e5b78e3b9736375";
const FROM_NUMBER = "whatsapp:+971504095079";

const scriptSteps = [
  "Hi there, how are you? I recently came across your CV online. My name is David and I’m contacting you on behalf of tutorii.com...",
  "So, Tutorii.com is a subscription-based educational platform designed to empower individuals...",
  "Right now, we’re looking to bring on new Sales Managers..."
];

const videoLinks = {
  en: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+English-1080p-250621.mp4",
  ur: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Urdu-1080P-250621(1).mp4",
  hi: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Hindi-1080P-250621.mp4",
  tl: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Tagalog-1080P-250621.mp4"
};

async function getSession(id) {
  try {
    const doc = await client.sync.v1.services(process.env.SYNC_SERVICE_SID)
      .documents(id)
      .fetch();
    return doc.data;
  } catch (e) {
    if (e.status === 404) return { step: 0, lang: "", messages: [] };
    throw e;
  }
}

async function saveSession(id, data) {
  try {
    await client.sync.v1.services(process.env.SYNC_SERVICE_SID)
      .documents(id)
      .update({ data });
  } catch (e) {
    if (e.status === 404) {
      await client.sync.v1.services(process.env.SYNC_SERVICE_SID)
        .documents.create({ uniqueName: id, data });
    } else {
      throw e;
    }
  }
}

app.post("/webhook", async (req, res) => {
  console.log("📩 Incoming webhook from Twilio");

  const from = req.body.From?.trim();
  const body = (req.body.Body || "").trim();

  console.log(`📨 From: ${from}`);
  console.log(`💬 Body: ${body}`);

  // Respond instantly to avoid Twilio timeouts
  res.type("text/xml").send("<Response></Response>");

  let { step, lang, messages } = await getSession(from);

  // Admin trigger → send template after 1 minute
  if (from === ADMIN_NUMBER && body.toLowerCase().includes(TRIGGER_KEYWORD)) {
    console.log("🚀 Admin trigger detected — scheduling message after 1 min");

    setTimeout(async () => {
      try {
        const templateMsg = await client.messages.create({
          from: FROM_NUMBER,
          to: TARGET_NUMBER,
          contentSid: CONTENT_SID
        });
        console.log("✅ Template message sent:", templateMsg.sid);

        // Save step progression
        await saveSession(TARGET_NUMBER, { step: 1, lang: "", messages: [] });

      } catch (error) {
        console.error("❌ Error sending template message:", error);
      }
    }, 60000);

    return;
  }

  // Reset session
  if (body.toLowerCase() === "reset") {
    await saveSession(from, { step: 0, lang: "", messages: [] });
    await client.messages.create({
      from: FROM_NUMBER,
      to: from,
      body: "✅ Session reset. Say something to start again."
    });
    return;
  }

  messages.push({ role: "user", content: body });

  // Language selection step
  if (step === 0) {
    const lower = body.toLowerCase();
    if (lower.includes("english") || lower.includes("eng")) lang = "en";
    else if (lower.includes("urdu") || lower.includes("اردو")) lang = "ur";
    else if (lower.includes("hindi") || lower.includes("हिन्दी")) lang = "hi";
    else if (lower.includes("filipino") || lower.includes("pilipino") || lower.includes("tagalog")) lang = "tl";
    else {
      await client.messages.create({
        from: FROM_NUMBER,
        to: from,
        body: "❌ Sorry, that's not a supported language. Please reply with English, Pilipino, اردو, or हिन्दी."
      });
      return;
    }

    step++;
    const next = scriptSteps[step];
    messages.push({ role: "assistant", content: next });
    await saveSession(from, { step, lang, messages });

    await client.messages.create({ from: FROM_NUMBER, to: from, body: next });
    return;
  }

  // Sequential script steps
  if (step < scriptSteps.length) {
    step++;
    const reply = scriptSteps[step];
    messages.push({ role: "assistant", content: reply });

    if (step === scriptSteps.length) {
      const videoUrl = videoLinks[lang] || videoLinks.en;
      await client.messages.create({
        from: FROM_NUMBER,
        to: from,
        body: reply + "\n\nHere’s a quick intro video:",
        mediaUrl: [videoUrl]
      });
    } else {
      await client.messages.create({ from: FROM_NUMBER, to: from, body: reply });
    }

    await saveSession(from, { step, lang, messages });
    return;
  }

  // GPT fallback
  try {
    const gptRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-small-3.2-24b-instruct",
        messages: [
          {
            role: "system",
            content: "You are David, a friendly recruiter for Tutorii.com..."
          },
          ...messages
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GPT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const gptReply = gptRes.data.choices?.[0]?.message?.content || "⚠️ No response from AI.";
    messages.push({ role: "assistant", content: gptReply });
    await saveSession(from, { step, lang, messages });

    await client.messages.create({ from: FROM_NUMBER, to: from, body: gptReply });
  } catch (err) {
    console.error("❌ GPT API error:", err.response?.data || err.message);
    await client.messages.create({
      from: FROM_NUMBER,
      to: from,
      body: "🛑 Error talking to the AI. Try again later."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
