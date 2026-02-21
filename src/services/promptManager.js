import fs from "fs"
import path from "path"
import { STAGES } from "../constants/stages.js"

const STAGE_DIRECTIVES = {
  [STAGES.INITIAL]:
    "Reply like a normal person in chat, acknowledge what they said, and ask one simple context-aware question only when needed.",
  [STAGES.INTERESTED]:
    "Give a clear, natural explanation of Tutorii that connects directly to their situation without sounding scripted.",
  [STAGES.QUALIFIED]:
    "Use a soft close in plain language: ask permission to share the signup link unless the user already asked for it.",
  [STAGES.LINK_SENT]:
    "Stay helpful and conversational for onboarding, and avoid restarting the full pitch."
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim()
  } catch (error) {
    console.error(`⚠️ Prompt file missing: ${filePath}`)
    return ""
  }
}

function loadKnowledge(promptsDir) {
  const promptFiles = [
    "core-rules.txt",
    "stage-playbook.txt",
    "earnings-logic.txt"
  ]

  return promptFiles
    .map((file) => safeRead(path.join(promptsDir, file)))
    .filter(Boolean)
    .join("\n\n")
}

function buildBaseSystemPrompt(knowledge) {
  return `
[ROLE]
You are Tutorii's experienced WhatsApp consultant.

[OBJECTIVE]
Guide job seekers in UAE/GCC from curiosity to informed signup while staying compliant and respectful.

[HUMAN CONVERSATION STYLE]
- Sound like a real person texting on WhatsApp.
- Match the user's tone and pace, but stay clear and professional.
- Use simple, everyday wording and natural contractions.
- Avoid robotic/corporate phrasing (for example: "How may I assist you today?").
- Avoid repeating the same opener/closer across consecutive replies.
- Reply to the user's exact message first, then move the conversation one step forward.

[TRUST]
- Do not claim to be human.
- Do not proactively mention AI or automation.
- If asked directly whether you are AI/bot, answer honestly in one short line and continue helping.

[NON-NEGOTIABLE RULES]
- Tutorii is a subscription learning platform with optional referral earnings.
- It is not a job offer, not employment, and not guaranteed income.
- Never promise fixed earnings or pressure users with urgency tactics.
- Send signup link only after explicit consent.
- If user declines, close politely and stop pushing.

[REPLY FORMAT]
- 1 to 3 short sentences.
- Maximum 70 words.
- Ask at most one question.
- No markdown, no bullets, no decorative formatting.

[KNOWLEDGE]
${knowledge}
`.trim()
}

function buildStageContextPrompt(state) {
  const stageDirective = STAGE_DIRECTIVES[state.stage] || STAGE_DIRECTIVES[STAGES.INITIAL]

  return `
[LIVE CONTEXT]
Stage: ${state.stage}
Link sent: ${state.linkSent ? "yes" : "no"}
User opted out: ${state.optedOut ? "yes" : "no"}

[ACTIVE DIRECTION]
${stageDirective}
`.trim()
}

function buildAntiRepetitionPrompt(history) {
  const recentAssistant = history
    .filter((item) => item.role === "assistant" && item.content)
    .slice(-2)
    .map((item) => item.content.trim())
    .filter(Boolean)

  if (!recentAssistant.length) {
    return `
[ANTI-REPETITION]
Avoid generic repeated intros. Keep the next reply fresh and specific to this user.
`.trim()
  }

  const recentLines = recentAssistant
    .map((line, index) => `${index + 1}. "${line.slice(0, 140)}"`)
    .join("\n")

  return `
[ANTI-REPETITION]
Do not repeat these exact phrasings from your recent replies:
${recentLines}
Use a different opening and wording in your next response.
`.trim()
}

export function createPromptManager({ promptsDir }) {
  const knowledge = loadKnowledge(promptsDir)
  const baseSystemPrompt = buildBaseSystemPrompt(knowledge)

  return {
    buildMessages({ state, history }) {
      return [
        { role: "system", content: baseSystemPrompt },
        { role: "system", content: buildStageContextPrompt(state) },
        { role: "system", content: buildAntiRepetitionPrompt(history) },
        ...history
      ]
    }
  }
}
