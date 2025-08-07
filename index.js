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
  "So, Tutorii.com is a subscription-based educational platform...",
  "Right now, we’re looking to bring on new Sales Managers..."
];

const videoLinks = {
  en: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+English-1080p-250621.mp4",
  ur: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Urdu-1080P-250621(1).mp4",
  hi: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Hindi-1080P-250621.mp4",
  tl: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Tagalog-1080P-250621.mp4"
};

// In-memory session store (replace with DB or Twilio Sync if needed)
const sessions = {};

app.post("/webhook", async (req, res) => {
  console.log("📩 Incoming webhook from Twilio");

  const from = req.body.From?.trim();
  const body = (req.body.Body || "").trim();
  const twiml = new twilio.twiml.MessagingResponse();

  console.log(`📨 From: ${from}`);
  console.log(`💬 Body: ${body}`);

  // Initialize session if not exists
  if (!sessions[from]) {
    sessions[from] = { step: 0, lang: "", messages: [] };
  }
  let { step, lang, messages } = sessions[from];

  // ✅ Admin trigger
  if (from === ADMIN_NUMBER && body.toLowerCase().includes(TRIGGER_KEYWORD)) {
    await client.messages.create({
      from: FROM_NUMBER,
      to: TARGET_NUMBER,
      contentSid: CONTENT_SID,
      contentVariables: JSON.stringify({ name: "David" })
    });
    twiml.message("✅ Template sent to Max.");
    return res.type("text/xml").send(twiml.toString());
  }

  // ✅ Reset session
  if (body.toLowerCase() === "reset") {
    sessions[from] = { step: 0, lang: "", messages: [] };
    twiml.message("✅ Session reset. Say something to start again.");
    return res.type("text/xml").send(twiml.toString());
  }

  messages.push({ role: "user", content: body });

  // ✅ Language selection step
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
    sessions[from] = { step, lang, messages };
    twiml.message(next);
    return res.type("text/xml").send(twiml.toString());
  }

  // ✅ Sequential script steps
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

    sessions[from] = { step, lang, messages };
    return res.type("text/xml").send(twiml.toString());
  }

  // ✅ GPT fallback
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
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const gptReply = gptRes.data.choices[0].message.content;
    messages.push({ role: "assistant", content: gptReply });
    sessions[from] = { step, lang, messages };

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
