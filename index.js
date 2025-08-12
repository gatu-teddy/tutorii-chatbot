import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const ADMIN_NUMBER = process.env.ADMIN_NUMBER || "+1234567890"; // your admin number

// Webhook for incoming messages
app.post("/webhook", async (req, res) => {
  const incomingMsg = req.body.Body?.trim() || "";
  const from = req.body.From;
  const to = req.body.To;

  console.log(`Incoming message from ${from}: ${incomingMsg}`);

  // ✅ Respond immediately to Twilio to avoid 15s timeout
  res.set("Content-Type", "text/xml");
  res.send("<Response></Response>");

  // If admin sends trigger, reply instantly
  if (from === `whatsapp:${ADMIN_NUMBER}`) {
    console.log("Admin message received, sending instant reply...");
    await sendMessage(to, from, "Trigger received ✅");
    return;
  }

  // Otherwise, delay bot reply by 60 seconds
  setTimeout(async () => {
    try {
      const botReply = await getBotResponse(incomingMsg); // Replace with GPT or logic
      await sendMessage(to, from, botReply);
      console.log(`Bot reply sent after delay to ${from}`);
    } catch (err) {
      console.error("Error sending delayed reply:", err);
    }
  }, 60000);
});

// Helper: Send WhatsApp message
async function sendMessage(from, to, body) {
  return client.messages.create({
    from,
    to,
    body,
  });
}

// Mock bot logic (replace with GPT/OpenRouter API call)
async function getBotResponse(userMessage) {
  // For testing, we just echo back
  return `You said: ${userMessage}`;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
