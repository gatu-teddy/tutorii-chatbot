exports.handler = async function (context, event, callback) {
  const axios = require("axios");
  const twiml = new Twilio.twiml.MessagingResponse();
  const client = context.getTwilioClient();

  const ADMIN_NUMBER = "whatsapp:+971567728465";
  const TARGET_NUMBER = "whatsapp:+254796143065";
  const TRIGGER_KEYWORD = "trigger max";
  const CONTENT_SID = "HX9eff360b577f37795e5b78e3b9736375";
  const FROM_NUMBER = "whatsapp:+971504095079";

  const from = event.From;
  const body = (event.Body || "").trim();
  const docName = from;
  const syncServiceSid = context.SYNC_SERVICE_SID;

  if (!syncServiceSid || !context.OPENROUTER_API_KEY) {
    console.error("❌ Missing environment vars");
    twiml.message("❌ Server error. Contact admin.");
    return callback(null, twiml);
  }

  const scriptSteps = [
    "Hi there, how are you? I recently came across your CV online. My name is David and I’m contacting you on behalf of tutorii.com. We think you might be a great fit for an opportunity we’re currently offering. We are currently looking for salespeople to help the growth of our platform. Might this be something of interest to you?",
    "So, Tutorii.com is a subscription-based educational platform designed to empower individuals with practical knowledge about life in the UAE and the wider GCC region — from protecting yourself and understanding local systems, to finding jobs and building your career. But that’s not all — as a subscriber, you also unlock the chance to earn a strong, recurring income by simply referring others. It’s a great opportunity to start your own business, take control of your future, and grow financially — all while learning skills that genuinely improve your life.",
    "Right now, we’re looking to bring on new Sales Managers who want to grow with the platform, invite others to join, and build a solid foundation in business, leadership, and online income. To give you a better idea, I’d love to share a short introductory video that breaks everything down — how Tutorii works, how you learn, and how you earn. How does that sound?"
  ];

  const videoLinks = {
    en: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+English-1080p-250621.mp4",
    ur: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Urdu-1080P-250621(1).mp4",
    hi: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Hindi-1080P-250621.mp4",
    tl: "https://mytutoriitestbucket.s3.eu-north-1.amazonaws.com/Tutorii+Tagalog-1080P-250621.mp4"
  };

  // Admin trigger
  if (from === ADMIN_NUMBER && body.toLowerCase().includes(TRIGGER_KEYWORD)) {
    try {
      await client.messages.create({
        from: FROM_NUMBER,
        to: TARGET_NUMBER,
        contentSid: CONTENT_SID,
        contentVariables: JSON.stringify({ name: "David" })
      });

      try {
        await client.sync.v1.services(syncServiceSid).documents(TARGET_NUMBER).fetch();
      } catch (e) {
        if (e.status === 404) {
          await client.sync.v1.services(syncServiceSid).documents.create({
            uniqueName: TARGET_NUMBER,
            data: {
              step: 0,
              lang: "",
              messages: [{ role: "assistant", content: scriptSteps[0] }]
            }
          });
        }
      }

      twiml.message("✅ Template sent to Max.");
      return callback(null, twiml);
    } catch (err) {
      console.error("❌ Template error:", err);
      twiml.message("❌ Failed to send template.");
      return callback(null, twiml);
    }
  }

  let step = 0;
  let lang = "";
  let messageHistory = [];

  try {
    const doc = await client.sync.v1.services(syncServiceSid).documents(docName).fetch();
    step = doc.data.step || 0;
    lang = doc.data.lang || "";
    messageHistory = doc.data.messages || [];
  } catch (e) {
    if (e.status !== 404) {
      console.error("❌ Sync fetch error:", e);
      twiml.message("⚠️ Could not access your session.");
      return callback(null, twiml);
    }
    // New session
    const welcome = scriptSteps[0];
    messageHistory = [
      { role: "user", content: body },
      { role: "assistant", content: welcome }
    ];
    await client.sync.v1.services(syncServiceSid).documents.create({
      uniqueName: docName,
      data: { step: 0, lang: "", messages: messageHistory }
    });
    twiml.message(welcome);
    return callback(null, twiml);
  }

  if (body.toLowerCase() === "reset") {
    await client.sync.v1.services(syncServiceSid).documents(docName).remove();
    twiml.message("✅ Session reset. Say something to start again.");
    return callback(null, twiml);
  }

  messageHistory.push({ role: "user", content: body });

  // Language selection
  if (step === 0) {
    const lower = body.toLowerCase();
    if (lower.includes("english") || lower.includes("eng") || lower.includes("en")) lang = "en";
    else if (lower.includes("urdu") || lower.includes("اردو")) lang = "ur";
    else if (lower.includes("hindi") || lower.includes("हिन्दी")) lang = "hi";
    else if (lower.includes("filipino") || lower.includes("pilipino") || lower.includes("tagalog")) lang = "tl";
    else {
      const sorry = "❌ Sorry, that's not a supported language. Please reply with English, Pilipino, اردو, or हिन्दी.";
      messageHistory.push({ role: "assistant", content: sorry });
      await client.sync.v1.services(syncServiceSid).documents(docName).update({
        data: { step: 0, lang: "", messages: messageHistory }
      });
      twiml.message(sorry);
      return callback(null, twiml);
    }

    step++;
    const next = scriptSteps[step];
    messageHistory.push({ role: "assistant", content: next });
    await client.sync.v1.services(syncServiceSid).documents(docName).update({
      data: { step, lang, messages: messageHistory }
    });
    twiml.message(next);
    return callback(null, twiml);
  }

  // Sequential script
  if (step < scriptSteps.length) {
    step++;
    const reply = scriptSteps[step];
    if (step === scriptSteps.length) {
      const videoUrl = videoLinks[lang] || videoLinks.en;
      const msg = twiml.message(reply + "\n\nHere’s a quick intro video:");
      msg.media(videoUrl);
    } else {
      twiml.message(reply);
    }

    await client.sync.v1.services(syncServiceSid).documents(docName).update({
      data: { step, lang, messages: messageHistory }
    });

    return callback(null, twiml);
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
            content:
              "You are David, a friendly recruiter for Tutorii.com. Stay on topic..."
          },
          ...messageHistory
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${context.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const gptReply = gptRes.data.choices[0].message.content;
    messageHistory.push({ role: "assistant", content: gptReply });

    await client.sync.v1.services(syncServiceSid).documents(docName).update({
      data: { step, lang, messages: messageHistory }
    });

    twiml.message(gptReply);
    return callback(null, twiml);
  } catch (err) {
    console.error("❌ GPT API error:", err.response?.data || err.message);
    twiml.message("🛑 Error talking to the AI. Try again later.");
    return callback(null, twiml);
  }
};
