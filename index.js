import express from "express";
import twilio from "twilio";
import axios from "axios";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const ADMIN_NUMBER = "whatsapp:+971567728465";
const TARGET_NUMBER = "whatsapp:+254796143065";
const TRIGGER_KEYWORD = "trigger max";
const CONTENT_SID = "HX9eff360b577f37795e5b78e3b9736375";
const FROM_NUMBER = "whatsapp:+971504095079";

const scriptSteps = [
  "Hi there, how are you? I recently came across your CV online. My name is David and I’m contacting you on behalf of tutorii.com...",
  "So, Tutorii.com is a subscription-based educational platform designed to empower individuals with practical knowledge about life in the UAE and the wider GCC region — from protecting yourself and understanding local systems, to finding jobs and building your career. But that’s not all — as a subscriber, you also unlock the chance to earn a strong, recurring income by simply referring others. It’s a great opportunity to start your own business, take control of your future, and grow financially — all while learning skills that genuinely improve your life.",
  "Right now, we’re looking to bring on new Sales Managers who want to grow with the platform, invite others to join, and build a solid foundation in business, leadership, and online income. To give you a better idea, I’d love to share a short introductory video that breaks everything down — how Tutorii works, how you learn, and how you earn. How does that sound?"
];

const videoLinks = {
  en: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+English-1080p-250621.mp4",
  ur: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Urdu-1080P-250621(1).mp4",
  hi: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Hindi-1080P-250621.mp4",
  tl: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Tagalog-1080P-250621.mp4"
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  const twiml = new twilio.twiml.MessagingResponse();

  console.log(`📨 From: ${from}`);
  console.log(`💬 Body: ${body}`);

  let { step, lang, messages } = await getSession(from);

  // Admin trigger - send immediately with error logging
  if (from === ADMIN_NUMBER && body.toLowerCase().includes(TRIGGER_KEYWORD)) {
    console.log("🚀 Admin trigger detected — sending template + first script");

    try {
      const templateMsg = await client.messages.create({
        from: FROM_NUMBER,
        to: TARGET_NUMBER,
        contentSid: CONTENT_SID,
        //contentVariables: JSON.stringify({ name: "David" })
      });
      console.log("✅ Template message sent:", templateMsg.sid);
    } catch (error) {
      console.error("❌ Error sending template message:", error);
    }

    twiml.message("✅ Template + script started for target.");
    return res.type("text/xml").send(twiml.toString());
  }

  // Delay all other bot replies by 1 minute
  await delay(60000);

  // Reset session
  if (body.toLowerCase() === "reset") {
    await saveSession(from, { step: 0, lang: "", messages: [] });
    twiml.message("✅ Session reset. Say something to start again.");
    return res.type("text/xml").send(twiml.toString());
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
      twiml.message("❌ Sorry, that's not a supported language. Please reply with English, Pilipino, اردو, or हिन्दी.");
      return res.type("text/xml").send(twiml.toString());
    }

    step++;
    const next = scriptSteps[step];
    messages.push({ role: "assistant", content: next });
    await saveSession(from, { step, lang, messages });
    twiml.message(next);
    return res.type("text/xml").send(twiml.toString());
  }

  // Sequential script steps
  if (step < scriptSteps.length) {
    step++;
    const reply = scriptSteps[step];
    messages.push({ role: "assistant", content: reply });

    if (step === scriptSteps.length) {
      const videoUrl = videoLinks[lang] || videoLinks.en;
      const msg = twiml.message(reply + "\n\nHere’s a quick intro video:");
      msg.media(videoUrl);
    } else {
      twiml.message(reply);
    }

    await saveSession(from, { step, lang, messages });
    return res.type("text/xml").send(twiml.toString());
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
            content: "You are David, a friendly recruiter for Tutorii.com. Stay on topic..."
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

    twiml.message(gptReply);
    return res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("❌ GPT API error:", err.response?.data || err.message);
    twiml.message("🛑 Error talking to the AI. Try again later.");
    return res.type("text/xml").send(twiml.toString());
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
