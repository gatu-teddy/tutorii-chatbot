# Developer Handoff — Tutorii WhatsApp Agent Recruitment Bot

**Last updated:** April 2026
**Audience:** Developer responsible for the Tutorii platform side of this integration

---

## 1. What this bot does (in one paragraph)

The bot recruits **independent sales agents** for Tutorii via WhatsApp. It cold-messages prospects (sourced from GulfTalent CVs), handles the full sales conversation through an LLM (GPT-4o-mini), captures their email when they agree, and hands off to the Tutorii platform for account creation. Agents get a **free** Tutorii account and earn 40% commission for every paying subscriber they bring in. The bot itself does not create the account — that is your job on the platform side.

---

## 2. The full prospect journey (end-to-end)

Read this once and the rest of the doc will make sense.

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — Outbound campaign                                     │
│  Head of sales triggers the campaign in the admin panel.        │
│  Bot sends pre-approved WhatsApp templates to ~1,000 prospects. │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2 — Conversation                                          │
│  Prospect replies. Bot has a multi-stage conversation:          │
│   INITIAL → INTERESTED → QUALIFIED → LINK_SENT                  │
│  Handles 38 different objections automatically.                 │
│  Detects deferrals ("I'll look tonight" → 6h follow-up).        │
│  Detects hard opt-outs ("stop", "wrong number") → silent.       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3 — Email capture                                         │
│  Once prospect agrees, bot asks for their email.                │
│  When email is provided, bot writes to chat_users in MongoDB:   │
│    agentEmail = "sarah@hotmail.com"                             │
│    agentEmailCapturedAt = <timestamp>                           │
│    linkSent = true                                              │
│  Bot sends holding message: "Account ready in a few minutes."   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌═════════════════════════════════════════════════════════════════┐
║  STEP 4 — YOUR JOB (PLATFORM SIDE)                              ║
║  Polling job runs every 60s on Tutorii platform.                ║
║  Finds chat_users where: linkSent=true,                         ║
║                          agentEmail≠"",                          ║
║                          accountProvisioned≠true                ║
║  For each match:                                                ║
║    1. Create the agent account (password = "Password")          ║
║    2. Generate referral code                                    ║
║    3. Mark mustResetPassword: true (forces reset on login)      ║
║    4. Write back to chat_users:                                 ║
║         accountProvisioned = true                               ║
║         provisionedAt = <timestamp>                             ║
║         tutoriiUserId = <new account ID>                        ║
└═════════════════════════════════════════════════════════════════┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5 — Welcome WhatsApp (bot side, polling for your writes)  │
│  Bot polling job spots accountProvisioned: true.                │
│  Sends WhatsApp with credentials + handbook PDF attached.       │
│  Marks welcomeWhatsAppSent: true so it doesn't fire twice.      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       Agent is live ✅
```

---

## 3. What changed recently (the iteration history)

The bot has been heavily refined. Key improvements you should know about:

**Conversation quality**

- 38 dedicated objection handlers covering: trust, visa, employer concerns, "is it halal" (removed — not needed), self-doubt, network size, spam fears, MLM comparisons, leaving UAE, international banking, post-setup confusion, and more
- Hard opt-out detection ("stop", "wrong number") triggers immediate respectful close — no LLM cost, no spam complaints
- Clear agreement detection ("yes I'm in", "sign me up") force-advances stage and asks for email
- Deferral detection ("I'll look tonight", "this weekend") adjusts follow-up timing automatically
- Soft-no detection ("maybe later", "I'll think about it") triggers gentler 5-day follow-up cadence
- **Legal threat killswitch** — if a prospect threatens to report the bot (TDRA, cybercrime, police, lawyers, "this is illegal", etc.), the bot goes permanently silent for that user. No reply, no follow-up, no future campaigns. Threatening message stored verbatim in `chat_users.killswitchMessage` for audit trail.
- **Document non-disclosure rule** — bot will never share trade licence, registration numbers, VAT numbers, MOA/AOA, founder names, office address, bank account details, or photos of any official document over WhatsApp. All such requests are politely redirected to `support@tutorii.com` for verification. Three layers of defence: dedicated `request_company_documents` handler, hardened `trust_verification` handler, and a global rule baked into every system prompt the LLM receives.

**Send timing**

- Outbound only fires in two windows: 10am–1pm and 5pm–8pm Gulf Standard Time
- Weekends (Sat/Sun) skipped entirely
- Auto-defers messages outside windows to next valid weekday slot

**Website framing**

- Bot actively directs prospects to www.tutorii.com as a trust-builder
- Treats the AED 95/month subscription pricing as proof of legitimacy, not confusion
- All prices in AED only — no dollar/USD references anywhere

**Architecture cleanup**

- Removed dead `prompts/` directory (174 lines of unused prompt files)
- Removed obsolete developer-instruction comments at top of conversationEngine.js
- Removed unused `loadKnowledge`, `safeRead`, `promptsDir` infrastructure
- Gated noisy detection logs behind `DEBUG_DETECTION=1` env flag
- Removed an over-engineered `agent_signup_queue` collection (we now use `chat_users` directly)

**Updated promises to prospects**

- Bot now says "account ready in a few minutes" (was "couple of hours")
- Welcome message echoes their email twice to catch typos
- All payment timing now states "1–5 business days from when MamoPay releases funds"

---

## 4. Database schema — what the bot writes, what you write

Both bot and platform read/write the **same `chat_users` collection**. This is the integration surface.

### Fields the BOT writes (you should treat these as read-only)

| Field | Type | Description |
|---|---|---|
| `_id` | String | The prospect's WhatsApp number (e.g. `"whatsapp:+971501234567"`) |
| `agentEmail` | String | The email they want their account set up under |
| `agentEmailCapturedAt` | Number | Unix ms when they provided the email |
| `linkSent` | Boolean | `true` once welcome message is sent (i.e. email captured) |
| `stage` | String | Conversation stage — useful for diagnostics, ignore otherwise |

### Fields YOU write (the bot reads these to know when to send welcome WhatsApp)

| Field | Type | Description |
|---|---|---|
| `accountProvisioned` | Boolean | Set to `true` when you've created the account |
| `provisionedAt` | Number | Unix ms when you provisioned it |
| `tutoriiUserId` | String | The new user's `_id` from the platform's `users` collection |

### Field the BOT writes after sending welcome WhatsApp (you don't touch)

| Field | Type | Description |
|---|---|---|
| `welcomeWhatsAppSent` | Boolean | `true` once the bot has notified the agent |
| `welcomeSentAt` | Number | Unix ms when sent |

### Two indexes are already on the collection for fast polling

```javascript
{ linkSent: 1, accountProvisioned: 1 }              // your polling query
{ accountProvisioned: 1, welcomeWhatsAppSent: 1 }   // bot's polling query
```

---

## 5. What you need to build (action checklist)

### ☐ 5.1 Confirm shared MongoDB

The bot's MongoDB and the Tutorii platform's MongoDB **must be the same database** for this integration to work. Confirm this before doing anything else. If they're separate, the integration needs a different design.

### ☐ 5.2 Build the platform-side polling job

Runs on the Tutorii platform backend, every 60 seconds. Pseudocode:

```javascript
// Run every 60 seconds
async function provisionPendingAgents() {
  const pending = await db.chat_users.find({
    linkSent: true,
    agentEmail: { $ne: "" },
    accountProvisioned: { $ne: true }
  }).limit(20)

  for (const record of pending) {
    try {
      // Idempotency: skip if account already exists for this email
      const existing = await db.users.findOne({ email: record.agentEmail })
      if (existing) {
        await markProvisioned(record._id, existing._id)
        continue
      }

      // Create the agent account
      const newUser = await db.users.insertOne({
        email: record.agentEmail,
        passwordHash: await bcrypt.hash("Password", 12),  // hardcoded default
        role: "agent",
        isFreeAgent: true,
        phoneNumber: record.phoneNumber,
        referralCode: generateReferralCode(),
        mustResetPassword: true,                          // CRITICAL
        createdAt: new Date()
      })

      // Mark provisioned in chat_users so the bot can send the welcome WhatsApp
      await db.chat_users.updateOne(
        { _id: record._id },
        { $set: {
            accountProvisioned: true,
            provisionedAt: Date.now(),
            tutoriiUserId: newUser.insertedId
        }}
      )
    } catch (err) {
      console.error(`Failed to provision ${record.agentEmail}:`, err)
      // Optionally: write provisioningError field for manual review
    }
  }
}

setInterval(provisionPendingAgents, 60_000)
```

### ☐ 5.3 Enforce `mustResetPassword: true` server-side

**This is critical security.** Since every account is created with the password "Password", the platform MUST block all functionality (dashboard, referral link, IBAN entry, etc.) until the user resets via Forgot Password. If this isn't enforced, hundreds of accounts have the same password floating around.

The check should look something like:
```javascript
// Middleware on every authenticated request
if (user.mustResetPassword) {
  return res.redirect("/forgot-password?required=true")
}
```

### ☐ 5.4 Host the sales handbook PDF at a stable URL

The bot needs to attach the handbook as a media message in WhatsApp. Twilio fetches it from a public URL. Suggested location:
```
https://www.tutorii.com/static/agent-handbook.pdf
```
The PDF will be supplied (it's the "agent starter pack" document already produced).

### ☐ 5.5 Build the bot-side polling + welcome WhatsApp (if you're also doing bot work)

This is **bot-side** work, not platform-side. If a separate dev owns the bot, this falls to them. Outline:

```javascript
// Run every 60 seconds on the bot
async function sendWelcomeMessages() {
  const ready = await db.chat_users.find({
    accountProvisioned: true,
    welcomeWhatsAppSent: { $ne: true }
  }).limit(20)

  for (const record of ready) {
    try {
      const account = await db.users.findOne({ _id: record.tutoriiUserId })
      if (!account) continue

      // Twilio media message: text + handbook PDF attachment
      await twilioClient.messages.create({
        from: "whatsapp:+14155238886",                  // bot's Twilio number
        to: record.phoneNumber,
        body: buildWelcomeText(record.agentEmail, account.referralCode),
        mediaUrl: ["https://www.tutorii.com/static/agent-handbook.pdf"]
      })

      await db.chat_users.updateOne(
        { _id: record._id },
        { $set: {
            welcomeWhatsAppSent: true,
            welcomeSentAt: Date.now()
        }}
      )
    } catch (err) {
      console.error(`Failed to send welcome to ${record.phoneNumber}:`, err)
    }
  }
}

setInterval(sendWelcomeMessages, 60_000)
```

The welcome message text should include: login URL, email, temp password ("Password"), forgot-password link, and a brief next-steps checklist.

---

## 6. Open questions to confirm before you start

Please sanity-check these with the founder:

1. **Shared MongoDB?** Is the Tutorii platform's MongoDB the same cluster as the bot's? (If not, this approach needs rework.)

2. **Default password?** Founder has confirmed "Password" as the default. Worth confirming you're comfortable with this given the `mustResetPassword: true` enforcement is genuinely watertight on your side.

3. **Handbook PDF location?** Where will it be hosted? Needs a stable, public URL Twilio can fetch.

4. **Referral link format?** What URL format does the platform use for referral links? (e.g. `tutorii.com/r/<code>` vs `tutorii.com/?ref=<code>`) — the bot needs to know to include in the welcome WhatsApp.

5. **Account creation rate?** If the campaign goes well, you could see 50-100 emails captured per day. Will the polling job + account creation handle that load comfortably?

6. **Is `support@tutorii.com` ready to handle verification requests?** The bot now redirects all sceptical prospects who ask for trade licence / registration documents / company verification to email this address. If the inbox isn't actively monitored — or if there's no SOP for what to send back — that creates a credibility gap. Worth a 5-minute SOP document for whoever monitors the inbox: what verification info can be shared (e.g. company name + DED number from public registry), what response time to commit to, and what should NOT be shared (Emirates IDs, passport copies, etc.).

---

## 7. Codebase structure (for orientation)

```
tutorii-chatbot/
├── index.js                              ← entry point
├── package.json
├── targets.json                          ← seed campaign targets
└── src/
    ├── config/index.js                   ← env config
    ├── constants/stages.js               ← INITIAL, INTERESTED, etc.
    ├── core/
    │   ├── conversationEngine.js         ← main brain (2200 lines)
    │   └── stateStore.js                 ← in-memory state cache
    ├── http/
    │   ├── server.js                     ← Express webhook + admin
    │   └── admin/routes.js               ← campaign trigger endpoints
    ├── models/
    │   └── chatUserModel.js              ← Mongoose schema (the integration surface)
    ├── services/
    │   ├── mongoStateRepository.js       ← MongoDB access for chat state
    │   ├── mongoTargetsRepository.js     ← MongoDB access for campaign targets
    │   ├── targetsManager.js             ← In-memory target set
    │   ├── openaiClient.js               ← GPT-4o-mini wrapper
    │   └── promptManager.js              ← System prompt assembly
    └── utils/index.js                    ← misc helpers
```

The single file you'll spend the most time understanding is `src/models/chatUserModel.js` — that's the schema your polling job interacts with.

---

## 8. Environment variables

The bot expects these in `.env`:

```
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx
TWILIO_FROM=whatsapp:+14155238886
TWILIO_TEMPLATE_SID=HXxxxxxxxxxxxxx        # Initial campaign template
TWILIO_WIN_BACK_TEMPLATE_SID=HXxxxxxxxxxxxxx  # 30-day win-back template

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# MongoDB (must be shared with the Tutorii platform)
MONGODB_URI=mongodb+srv://...

# Admin UI
ADMIN_UI_USERNAME=admin
ADMIN_UI_PASSWORD=<strong-password>

# Optional: verbose detection logging (off in production)
DEBUG_DETECTION=0

# Optional: send window tuning
STALLED_DELAY_MS=259200000   # 3 days
WIN_BACK_DELAY_MS=2592000000 # 30 days
```

---

## 9. Quick test you can run right now

Once you've built the platform-side polling job and pointed it at the shared MongoDB:

1. Have a teammate trigger the campaign to a test phone number
2. Reply "yes I'm in" → "your-real-email@gmail.com"
3. Watch MongoDB: `db.chat_users.findOne({_id: "whatsapp:+<your number>"})` should show `agentEmail` populated within seconds
4. Wait up to 60 seconds for your polling job to run
5. Verify a record appears in `db.users` with `email: "your-real-email@gmail.com"`, `password: "Password"` (hashed), `mustResetPassword: true`
6. Verify the same `chat_users` record now shows `accountProvisioned: true`
7. Try logging in — you should be force-redirected to the password reset page

If all 7 steps work, the integration is solid.

---

## 10. Who to ask for what

| Question | Ask |
|---|---|
| Anything about the chat conversation logic | Bot dev |
| Welcome WhatsApp message content | Bot dev |
| Handbook content | Founder |
| Brand voice / messaging tone | Founder |
| Account schema / users collection structure | Platform dev (you) |
| Hosting the handbook PDF | Platform dev (you) |
| Pricing / commission rules | Founder |

---

**That's it. The integration surface is small (two collections, three writes from each side), the contract is clear, and the bot is ready to start handing off accounts to you the moment your polling job is live.**

Any questions, message the founder.
