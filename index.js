import express from "express";
import twilio from "twilio";
import axios from "axios";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const ADMIN_NUMBER = "whatsapp:+971567728465";
const TARGET_NUMBER = "whatsapp:+447826939737";
const TRIGGER_KEYWORD = "trigger max";
const CONTENT_SID = "HX034d351d1041ce22cd971eb3be6efad3";
const FROM_NUMBER = "whatsapp:+971504095079";

const videoLinks = {
  en: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+English-1080p-250621.mp4",
  ur: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Urdu-1080P-250621(1).mp4",
  hi: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Hindi-1080P-250621.mp4",
  tl: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Tagalog-1080P-250621.mp4"
};

const scriptSteps = (lang) => [
  {
    body: "Hi there, how are you? I recently came across your CV online. My name is David and I’m contacting you on behalf of tutorii.com. We think you might be a great fit for an opportunity we’re currently offering. We are currently looking for salespeople to help the growth of our platform. Might this be something of interest to you?"
  },
  {
    body: "So, We’re a subscription-based educational platform designed to empower individuals with practical knowledge about life in the UAE and the wider GCC region — from protecting yourself and understanding local systems, to finding jobs and building your career. But that’s not all — as a subscriber, you also unlock the chance to earn a strong, recurring income by simply referring others. It’s a great opportunity to start your own business, take control of your future, and grow financially — all while learning skills that genuinely improve your life.Right now, we’re looking to bring on new Sales Managers who want to grow with the platform, invite others to join, and build a solid foundation in business, leadership, and online income. To give you a better idea, I’d love to share a short introductory video that breaks everything down",
    mediaUrl: [videoLinks[lang] || videoLinks.en]
  },
  {
    body: "Right now, we’re looking to bring on new Sales Managers who want to grow with the platform, invite others to join, and build a solid foundation in business, leadership, and online income. Feel free to ask any question about the platform. Click on Tutorii.com to join the team."
  }
];

// Helper delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper to send Twilio message with 1 minute delay
async function sendDelayedMessage(params) {
  console.log(`⏳ Waiting 1 minute before sending message to ${params.to}`);
  await delay(60000);
  console.log(`✉️ Sending message to ${params.to}`);
  return client.messages.create(params);
}

//helper to send delayed message with video attached
async function sendMediaWithText({ from, to, body, mediaUrl }) {
  // delay once for the whole pair
console.log(`Waiting 1 minute before sending message to ${to}`);
  await delay(60000);

  // send video
console.log(`sending video without delay to &{to}`);
  await client.messages.create({ from, to, mediaUrl });

  // send caption text right after
console.log(`sending text without delay to &{to}`);
  if (body) {
    await client.messages.create({ from, to, body });
  }
}

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

  // Respond immediately to avoid Twilio timeout
  res.type("text/xml").send("<Response></Response>");

  let { step, lang, messages } = await getSession(from);

  // Admin trigger → send template after 1 minute
  if (from === ADMIN_NUMBER && body.toLowerCase().includes(TRIGGER_KEYWORD)) {
    console.log("🚀 Admin trigger detected — sending template message with delay");
    try {
      const templateMsg = await sendDelayedMessage({
        from: FROM_NUMBER,
        to: TARGET_NUMBER,
        contentSid: CONTENT_SID
      });
      console.log("✅ Template message sent:", templateMsg.sid);

      await saveSession(TARGET_NUMBER, { step: 0, lang: "", messages: [] });
    } catch (error) {
      console.error("❌ Error sending template message:", error);
    }
    return;
  }

  // Reset session
  if (body.toLowerCase() === "reset") {
    await saveSession(from, { step: 0, lang: "", messages: [] });
    await sendDelayedMessage({
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
      await sendDelayedMessage({
        from: FROM_NUMBER,
        to: from,
        body: "❌ Sorry, that's not a supported language. Please reply with English, Pilipino, اردو, or हिन्दी."
      });
      return;
    }

   // const steps = scriptSteps(lang);
   // step++;
    //const replyStep = steps[step];
    //messages.push({ role: "assistant", content: replyStep.body });

  //  await sendDelayedMessage({
    //  from: FROM_NUMBER,
    //  to: from,
    //  body: replyStep.body,
    //  mediaUrl: replyStep.mediaUrl
  //  });

  //  await saveSession(from, { step, lang, messages });
 //   return;
  }

  // Sequential script steps
const steps = scriptSteps(lang);
if (step < steps.length - 1) {
  step++;
  const replyStep = steps[step];
  messages.push({ role: "assistant", content: replyStep.body });

  // Send text first
  //await sendDelayedMessage({
  //  from: FROM_NUMBER,
  //  to: from,
   // body: replyStep.body
 // });

  // Send media if it exists
  if (replyStep.mediaUrl) {
    await sendMediaWithText({
      from: FROM_NUMBER,
      to: from,
      body: replyStep.body,
      mediaUrl: replyStep.mediaUrl
    });
  } else {
    await sendDelayedMessage({
      from: FROM_NUMBER,
      to: from,
      body: replyStep.body});
}

  await saveSession(from, { step, lang, messages });
  return;
}

  // After script → GPT fallback
  try {
    const gptRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-small-3.2-24b-instruct",
        messages: [
          {
            role: "system",
            content: "You are David, a friendly recruiter for Tutorii.com. Stay on topic about Tutorii’s educational and referral website platform. Do not answer questions unrelated to Tutorii. Only list benefits from this information. Once the user shows interest , diect them to Tutorii.com so they can register or subscribe. Keep responses short, helpful, and persuasive. Never answer unrelated questions. COST & VALUE: If someone says they can’t afford it, say it’s very affordable and most people earn back the fee by referring a few others. If they mention free content, explain Tutorii is structured, focused on UAE/GCC, and includes income potential. If they ask if it’s worth it, confirm it’s a small investment with big learning and earning value. No monthly commitment—you can cancel anytime. No free trial—value unlocks with subscription. TRUST & LEGITIMACY: Tutorii is UAE-registered and licensed. Not a pyramid scheme—simple direct commissions. Transparent, with real education and support. HOW IT WORKS: Subscribe, learn, and optionally earn by referrals. Topics include life in UAE, worker rights, job hunting, money tips. Different from YouTube—structured, focused, plus income. No selling or teaching required. TIME & COMMITMENT: Flexible, even 15 minutes per day helps. The sooner you start, the sooner you earn. EARNING & REFERRALS: Earnings depend on effort; 5 referrals can bring $100/month. Only earn while referrals stay subscribed. Weekly payouts via Stripe; we guide setup. Commissions are 40% direct plus 5% second-level. ACCESS & LANGUAGE: Works globally, not just UAE. Content in English, Urdu, Tagalog, Hindi. Mobile-friendly, no laptop needed. LEGAL & ETHICAL: Fully allowed, doesn’t affect visas or jobs. Halal and ethical—just knowledge sharing. SKEPTICAL REPLIES: If they say they’re thinking about it, say starting now means earning sooner. If they want details later, send the link and stay available. PRICING: $19.85 US dollars/month, cancel anytime. Includes full learning access and referral tools. Always stay polite, positive, and focused on Tutorii."
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

    await sendDelayedMessage({ from: FROM_NUMBER, to: from, body: gptReply });
  } catch (err) {
    console.error("❌ GPT API error:", err.response?.data || err.message);
    await sendDelayedMessage({
      from: FROM_NUMBER,
      to: from,
      body: "🛑 Error talking to the AI. Try again later."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
