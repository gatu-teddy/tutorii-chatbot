# Tutorii WhatsApp Chatbot

A Node.js WhatsApp chatbot for Tutorii outreach that:
- receives inbound WhatsApp messages from Twilio webhooks,
- runs stage-aware conversation logic,
- generates structured AI turn decisions via OpenAI,
- sends throttled outbound replies and optional campaign templates,
- stores user state/history in memory or MongoDB.

---

## 1) What this project does

This service runs a controlled outbound/inbound chat flow for selected phone numbers.

Core behavior:
1. Twilio sends webhook events to `POST /webhook`.
2. The app validates sender + body, deduplicates and debounces inbound messages.
3. Buffered inbound messages are merged into one user turn.
4. Prompt context is assembled from rule files + live state + recent history.
5. OpenAI returns a strict JSON decision:
   - `reply`
   - `next_stage`
   - `send_link_now`
   - `mark_opted_out`
6. The app updates stage/state/history, optionally sends signup link (with consent), and persists state.

---

## 2) High-level architecture

- **Entry point**: `index.js`
- **HTTP layer**: `src/http/server.js`
- **Admin HTTP routes**: `src/http/admin/routes.js`
- **Admin session manager**: `src/http/admin/sessionManager.js`
- **Admin HTML views**: `src/http/admin/views.js`
- **Targets persistence manager**: `src/services/targetsManager.js`
- **Conversation orchestration**: `src/core/conversationEngine.js`
- **State management**: `src/core/stateStore.js`
- **AI API integration**: `src/services/openaiClient.js`
- **Prompt composition**: `src/services/promptManager.js`
- **Mongo persistence adapter**: `src/services/mongoStateRepository.js`
- **Static stages**: `src/constants/stages.js`
- **Config/environment**: `src/config/index.js`
- **Utility helpers**: `src/utils/index.js`
- **Prompt knowledge files**: `prompts/*.txt`
- **Campaign targets list**: `targets.json`

### Runtime components

1. **Twilio client**
   - Sends WhatsApp template messages and normal text messages.

2. **OpenAI client**
   - Calls `/v1/chat/completions`.
   - Prefers strict `json_schema` response format.
   - Falls back to plain completion parsing if schema mode fails.

3. **Prompt manager**
   - Loads prompt knowledge from text files.
   - Adds live state context + anti-repetition + recent context.

4. **Conversation engine**
   - Handles per-user queueing, dedupe, debounce, throttling, fallback replies, stage advancement.

5. **State store + optional Mongo repository**
   - Keeps current user state in memory map.
   - Optionally syncs state/history to MongoDB.

---

## 3) Folder & file documentation

## Root

### `index.js`
Bootstraps the app:
- Builds Twilio client from config.
- Builds OpenAI client with model params.
- Builds prompt manager from prompt directory.
- Initializes Mongo repository if enabled, then injects it into `stateStore`.
- Creates Express server and starts listening.

### `package.json`
- ESM project (`"type": "module"`).
- Start command: `npm start`.
- Runtime dependencies: `axios`, `body-parser`, `dotenv`, `express`, `mongodb`, `twilio`.

### `targets.json`
Array of target numbers for campaign/template sending.
- Accepts numbers with or without `whatsapp:` prefix.
- Config loader normalizes them and converts to `Set`.
- If malformed/missing, fallback defaults are used.

### `prompts/`
Knowledge and behavior guidance merged into system prompt:
- `core-rules.txt`
- `stage-playbook.txt`
- `earnings-logic.txt`

---

## `src/config/index.js`
Central config builder using `dotenv` + defaults.

### Key responsibilities
- Loads `.env`.
- Resolves required env vars with `getRequired`.
- Loads and normalizes target numbers from `targets.json`.
- Defines all runtime tuning knobs.
- Enables Mongo mode automatically if URI/host is present.

### Notable fields
- `config.port`
- `config.promptsDir`
- `config.targetsFile` (`targets.json` absolute path)
- `config.targets` (`Set<string>`)
- `config.adminUi`:
  - `username` (default: `admin`)
  - `password` (default: `change-me`)
  - `sessionTtlMs` (default: `8h`)
  - `secureCookie` (default: `false`)
- `config.twilio`:
  - `accountSid`, `authToken`, `from`, `templateSid`
- `config.openai`:
  - `apiKey`, `model`, `temperature`, `maxTokens`, penalties
- `config.campaign.staggerMs`
- `config.conversation` timing + history knobs
- `config.mongodb` connection options
- `config.links.signup` + `config.links.sponsorCode`

---

## `src/constants/stages.js`
Defines conversation stages and monotonic ranking.

### Stages
- `initial`
- `interested`
- `qualified`
- `link_sent`

### Stage rank
Used to prevent regression (only allows forward stage movement).

---

## `src/core/stateStore.js`
In-memory state cache + repository bridge.

### Exposed functions
- `setStateRepository(repository)`
  - Injects persistence adapter (e.g., Mongo).
- `getUserState(userNumber, maxHistoryMessages)`
  - Returns cached state if present.
  - Otherwise loads from repository or default state.
- `persistUserState(userNumber, state)`
  - Persists current state when repo exists.
- `appendHistory(userNumber, state, role, content, maxHistoryMessages)`
  - Updates local history ring buffer.
  - Persists message history if repo exists.
- `advanceStage(state, nextStage)`
  - Advances only when next stage rank is higher.

### Default state shape
```js
{
  stage: "initial",
  linkSent: false,
  optedOut: false,
  history: [],
  lastOutboundAt: 0,
  lastOutboundFingerprint: "",
  lastOutboundContextKey: ""
}
```

---

## `src/core/conversationEngine.js`
The main conversation orchestration layer.

### Internal guards and controls
- **Inbound dedupe**:
  - Primary fingerprint: Twilio `messageSid`.
  - Fallback fingerprint: sender + normalized body + 30s bucket.
  - TTL cleanup via `inboundDedupeTtlMs`.
- **Inbound debounce buffer**:
  - Multiple quick user messages are buffered and merged.
  - Flush occurs after `inboundDebounceMs`.
- **Per-user queue**:
  - Serializes processing to avoid race conditions.
- **Outbound duplicate suppression**:
  - Uses normalized body + context key + time window.
- **Human-like delay**:
  - Delay based on message length/words and cooldown constraints.

### Main flows

#### `processInbound({ from, body, messageSid })`
- Ignores empty body.
- Drops duplicates.
- Buffers message for debounced flush.

#### `handleUserMessage(from, message)`
1. Get user state.
2. Skip if `optedOut`.
3. Append user message to history.
4. Build OpenAI messages via prompt manager.
5. Generate structured turn decision.
6. If `mark_opted_out`:
   - mark state,
   - send stop confirmation,
   - persist and return.
7. Advance stage if appropriate.
8. If link can be sent now:
   - send signup link + sponsor code,
   - set `linkSent=true`,
   - stage -> `link_sent`,
   - persist and return.
9. Otherwise send AI reply (or fallback human reply if low-quality).
10. Persist state.

#### `triggerTemplateCampaign()`
- Runs a full campaign send to completion.
- Sends Twilio template to each target in `config.targets`.
- Waits `campaign.staggerMs` between sends.
- Tracks status counters and run timestamps.

#### `startTemplateCampaign()`
- Starts campaign run in the background (for dashboard UX).
- Prevents overlapping runs if one is already active.

### Low-quality reply fallback
AI replies are replaced when too generic (e.g., `ok`, robotic assist phrases, very short one-word content), using stage-specific fallback lines.

---

## `src/http/server.js`
Express HTTP server composition.

### Endpoint
- `POST /webhook`

### Behavior
- Uses `body-parser` urlencoded middleware.
- Mounts admin routes from `src/http/admin/routes.js` at `/admin`.
- Normalizes `From` number and extracts body + message SID variants.
- Always returns **empty TwiML XML** immediately (`200`) to prevent Twilio echo side effects.
- Regular inbound processing only if sender exists in `config.targets` and body is non-empty.

---

## `src/http/admin/routes.js`
Admin dashboard route handlers.

### Endpoint
- `GET /admin/login`
- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin`
- `POST /admin/campaign/trigger`
- `POST /admin/targets/add`
- `POST /admin/targets/delete`
- `POST /admin/targets/import-json`

### Behavior
- Authenticates with `adminUi` credentials.
- Protects dashboard routes using session middleware.
- Starts campaign in background and shows run status.
- Adds/removes targets and persists changes to `targets.json`.
- Supports bulk target import from a JSON array payload.

---

## `src/http/admin/sessionManager.js`
Cookie session lifecycle + credential verification.

### Behavior
- Parses/sets/clears session cookies.
- Supports sliding expiration with `ADMIN_UI_SESSION_TTL_MS`.
- Uses timing-safe hashed credential comparison.

---

## `src/http/admin/views.js`
HTML render helpers for login and dashboard pages.

---

## `src/services/targetsManager.js`
Runtime target list management + disk persistence.

### Behavior
- Lists current targets from live in-memory set.
- Adds single targets with normalization.
- Deletes single targets.
- Imports multiple targets from JSON array text.
- Persists all target updates to `targets.json`.

---

## `src/services/openaiClient.js`
OpenAI integration with structured output contract.

### Decision contract
The model must output JSON:
```json
{
  "reply": "string",
  "next_stage": "initial|interested|qualified|link_sent",
  "send_link_now": false,
  "mark_opted_out": false
}
```

### Strategy
1. First request uses `response_format: json_schema` with strict schema.
2. If that fails, retries without schema mode.
3. If both fail, returns safe default fallback turn.

### Parsing helpers
- Extracts JSON from raw model text robustly.
- Normalizes stage value against allowed enum.

---

## `src/services/promptManager.js`
Builds multi-layer system context for each turn.

### Prompt layers
1. **Base system prompt**
   - Role, objective, compliance, style, output constraints.
   - Injects merged prompt knowledge from text files.
2. **Live stage context**
   - Stage/linkSent/optedOut + active stage directive.
3. **Recent context**
   - Last up to 8 turns summarized as numbered transcript.
4. **Anti-repetition block**
   - Includes last 2 assistant replies to avoid repeating phrasing.
5. **Chat history**
   - Appended after system blocks.

---

## `src/services/mongoStateRepository.js`
MongoDB-backed persistence adapter for user state/history.

### Collections
- `chat_users`
- `chat_messages`

### Initialization
- Connects client.
- Creates indexes:
  - users: `{ updatedAt: -1 }`
  - messages: `{ userNumber: 1, _id: -1 }`

### Methods
- `init()`
- `loadUserState(userNumber, maxHistory)`
  - Ensures user record exists.
  - Loads latest message history (bounded).
- `saveUserState(userNumber, state)`
  - Persists stage flags + outbound dedupe metadata.
- `appendHistory(userNumber, role, content, maxHistory)`
  - Inserts message.
  - Deletes older overflow messages beyond limit.
- `close()`

### URI behavior
- Uses provided `MONGODB_URI`/`MONGO_URI` when available.
- Otherwise builds `mongodb://` URI from host/port/user/password/db/authSource.

---

## `src/utils/index.js`
Small utility helpers:
- `normalizeNumber(raw)` removes `whatsapp:` prefix.
- `normalizeText(text)` lowercases, trims, squashes whitespace.
- `delay(ms)` async sleep.
- `toPositiveNumber(value, fallback)` safe positive numeric parser.

---

## 4) Conversation state machine

```text
initial -> interested -> qualified -> link_sent
```

Rules:
- Stage only moves forward (`advanceStage` checks rank).
- Link is sent only when all are true:
  - user has not already received link,
  - AI decides `send_link_now = true`,
  - state is `qualified` or `link_sent`.

---

## 5) API and webhook contract

### Incoming (Twilio webhook fields used)
- `From`
- `Body`
- `MessageSid` (or `SmsMessageSid` / `SmsSid` fallback)

### Outgoing responses to Twilio
- Immediate XML response body:
  - `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

### Outbound WhatsApp sends
- Normal messages via `twilioClient.messages.create({ from, to, body })`
- Template campaign via `contentSid` + `contentVariables`

---

## 6) Environment variables

### Required
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `OPENAI_KEY` or `GPT_API_KEY`

### Common optional
- `PORT` (default `3000`)
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `OPENAI_TEMPERATURE` (default `0.6`)
- `OPENAI_MAX_TOKENS` (default `220`)
- `OPENAI_FREQUENCY_PENALTY` (default `0.3`)
- `OPENAI_PRESENCE_PENALTY` (default `0.15`)

### Admin UI controls
- `ADMIN_UI_USERNAME` (default `admin`)
- `ADMIN_UI_PASSWORD` (default `change-me`)
- `ADMIN_UI_SESSION_TTL_MS` (default `28800000`)
- `ADMIN_UI_SECURE_COOKIE` (default `false`)

### Twilio defaults
- `TWILIO_WHATSAPP_FROM` (default `whatsapp:+971504095079`)
- `TWILIO_TEMPLATE_SID` (default `HXfb26e732c302470271e7b20a3aee5032`)

### Campaign / behavior tuning
- `CAMPAIGN_STAGGER_MS` (default `1800`)
- `INBOUND_DEDUPE_TTL_MS` (default `300000`)
- `INBOUND_DEBOUNCE_MS` (default `1 min`)
- `OUTBOUND_COOLDOWN_MS` (default `2500`)
- `OUTBOUND_DUPLICATE_WINDOW_MS` (default `45000`)
- `MIN_RESPONSE_DELAY_MS` (default `1200`)
- `MAX_RESPONSE_DELAY_MS` (default `7000`)
- `MAX_HISTORY_MESSAGES` (default `20`)

### Mongo settings
- `MONGODB_URI` or `MONGO_URI`
- `MONGODB_HOST` (default `127.0.0.1`)
- `MONGODB_PORT` (default `27017`)
- `MONGODB_USER`
- `MONGODB_PASSWORD`
- `MONGODB_DB` (default `tutorii_chatbot`)
- `MONGODB_AUTH_SOURCE`

### Link payload
- `TUTORII_SIGNUP_LINK` (default `https://tutorii.com`)
- `TUTORII_SPONSOR_CODE` (default `TTRI-business-admin`)

---

## 7) Setup and run

1. Install dependencies:
```bash
npm install
```

2. Create `.env` with required values.

3. (Optional) Edit target recipients in `targets.json` or manage them from the admin dashboard.

4. Start server:
```bash
npm start
```

5. Configure Twilio WhatsApp webhook URL to:
- `POST https://<your-domain>/webhook`

6. Open admin dashboard:
- `GET http://localhost:<PORT>/admin/login`
- Login with `ADMIN_UI_USERNAME` / `ADMIN_UI_PASSWORD`.

---

## 8) Campaign trigger behavior

To trigger outbound template campaign:
- login to the admin dashboard
- click `Trigger Campaign`

The service will:
- iterate through all target numbers,
- send template message,
- wait `CAMPAIGN_STAGGER_MS` between sends.

---

## 9) Operational notes

- Only numbers in `targets.json` (or defaults) are processed for inbound conversation.
- Campaign trigger is protected behind admin login routes.
- Target edits in admin dashboard update runtime memory and `targets.json` immediately.
- The app intentionally returns empty TwiML to avoid unintended Twilio echo messages.
- If Mongo is disabled, all state is in memory and resets on process restart.
- With Mongo enabled, history is capped to `MAX_HISTORY_MESSAGES` per user.

---

## 10) Security notes

- Keep `.env` out of version control.
- Rotate API keys/tokens immediately if they are ever exposed.
- Set a strong `ADMIN_UI_PASSWORD` and enable `ADMIN_UI_SECURE_COOKIE=true` behind HTTPS.
- Restrict webhook endpoint to trusted Twilio traffic where possible.

---

## 11) Extension points

1. Add custom stages in `src/constants/stages.js` and update directives in `promptManager`.
2. Add richer user profiling fields in `stateStore` + Mongo repository.
3. Add observability/metrics around inbound queue size, turn latency, and send errors.
4. Add signature validation middleware for Twilio webhook authentication.

---

## 12) Troubleshooting quick checks

- **Server fails at startup**
  - Check required env vars and credentials.
- **No outbound messages**
  - Verify `TWILIO_WHATSAPP_FROM`, sandbox/approved sender status, and recipient eligibility.
- **Webhook receives but bot does not reply**
  - Ensure sender number is inside `config.targets`.
- **Repeated responses**
  - Tune `INBOUND_DEBOUNCE_MS` and dedupe windows.
- **State resets unexpectedly**
  - Enable Mongo persistence and verify connectivity.

---

If you want, the next step can be generating a separate `docs/DEVELOPER_GUIDE.md` with sequence diagrams and request/response examples for each module API.
