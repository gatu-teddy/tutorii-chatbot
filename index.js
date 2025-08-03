import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import twilio from 'twilio';

dotenv.config();

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.post('/webhook', async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body;

  res.sendStatus(200); // Respond fast to Twilio

  console.log(`Received from ${from}: ${body}`);

  // Optional: your scripted logic first
  let systemMessage = "You are a friendly recruitment bot from Tutorii.com.";
  let messages = [{ role: "system", content: systemMessage }];
  messages.push({ role: "user", content: body });

  // Wait 60 seconds
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Call GPT
  const reply = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: 'mistralai/mistral-small-3.2-24b-instruct',
    messages
  }, {
    headers: {
      Authorization: `Bearer ${process.env.GPT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const answer = reply.data.choices[0].message.content;
  console.log(`Replying to ${from}: ${answer}`);

  // Send via Twilio
  await client.messages.create({
    from: process.env.TWILIO_FROM,
    to: from,
    body: answer
  });
});

app.get('/', (req, res) => res.send('Tutorii bot running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
