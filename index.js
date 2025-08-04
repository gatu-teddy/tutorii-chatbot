import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import fs from 'fs';
import axios from 'axios';
import twilio from 'twilio';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Load target numbers once at startup
let targets = [];
try {
  targets = JSON.parse(fs.readFileSync('./targets.json', 'utf-8'));
} catch (err) {
  console.error('❌ Failed to load targets.json:', err.message);
}

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim();

  res.sendStatus(200); // Fast response to Twilio

  // Check admin trigger first
 app.post('/webhook', async (req, res) => {
  const from = req.body.From?.trim();
  const body = (req.body.Body || '').trim().toLowerCase();

  // 1. ADMIN TRIGGER PATH
  if (from === process.env.ADMIN_NUMBER && body === 'trigger max') {
    console.log('✅ Admin trigger received');

    // Respond to admin
    try {
      await client.messages.create({
        from: process.env.TWILIO_FROM,
        to: from,
        body: 'Template sent to max ✅'
      });
    } catch (err) {
      console.error('❌ Failed to respond to admin:', err.message);
    }

    // Send template to each target (no placeholders)
    for (const number of targets) {
      try {
        await client.messages.create({
          from: process.env.TWILIO_FROM,
          to: number,
          contentSid: process.env.TEMPLATE_SID
        });
        console.log(`📤 Template sent to ${number}`);
      } catch (err) {
        console.error(`❌ Failed to send to ${number}:`, err.message);
      }
    }

    return res.sendStatus(200);
  }

  // Normal user message — prepare GPT messages
  const systemMessage = "You are a friendly recruitment bot from Tutorii.com.";
  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: body }
  ];

  // Wait 60 seconds to simulate delay before replying
  await new Promise(resolve => setTimeout(resolve, 60000));

  try {
    const reply = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-small-3.2-24b-instruct',
        messages
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GPT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const answer = reply.data.choices[0].message.content;
    console.log(`Replying to ${from}: ${answer}`);

    await client.messages.create({
      from: process.env.TWILIO_FROM,
      to: from,
      body: answer
    });
  } catch (error) {
    console.error('Error with GPT or Twilio:', error.message);
  }
});

app.get('/', (req, res) => res.send('Tutorii bot running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
