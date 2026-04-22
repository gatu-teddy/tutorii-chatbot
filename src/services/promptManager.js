import { STAGES } from "../constants/stages.js"

const STAGE_DIRECTIVES = {
  [STAGES.INITIAL]:
    "Reply like a normal person in chat, acknowledge what they said, and ask one simple context-aware question only when needed.",
  [STAGES.INTERESTED]:
    "Give a clear, natural explanation of Tutorii that connects directly to their situation without sounding scripted.",
  [STAGES.QUALIFIED]:
    "Use a soft close in plain language: ask permission to share the signup link unless the user already asked for it.",
  [STAGES.LINK_SENT]:
    "Stay helpful and conversational for onboarding, and avoid restarting the full pitch.",
  [STAGES.STALLED]:
    "Re-engage naturally. Reference something from the earlier conversation if possible. Keep it short and low-pressure.",
  [STAGES.WIN_BACK]:
    "This user went cold a while ago. Re-open the conversation warmly, don't reference the gap, and give them one clear reason to take another look."
}

function buildBaseSystemPrompt(productKnowledge) {
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

[PRODUCT KNOWLEDGE — USE THESE FACTS, DO NOT DEVIATE]
${productKnowledge}
`.trim()
}

function buildStageContextPrompt(state, socialProof) {
  const stageDirective = STAGE_DIRECTIVES[state.stage] || STAGE_DIRECTIVES[STAGES.INITIAL]
  const socialProofLine = socialProof
    ? `\n[SOCIAL PROOF — weave this in naturally if it fits the conversation]\n${socialProof}`
    : ""

  return `
[LIVE CONTEXT]
Stage: ${state.stage}
Link sent: ${state.linkSent ? "yes" : "no"}
User opted out: ${state.optedOut ? "yes" : "no"}

[ACTIVE DIRECTION]
${stageDirective}${socialProofLine}
`.trim()
}

function buildObjectionPrompt(objectionPrompt) {
  if (!objectionPrompt) return null

  return `
[OBJECTION DETECTED — handle this before anything else]
${objectionPrompt}
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

function buildRecentContextPrompt(history) {
  const recentTurns = history
    .slice(-8)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || "").trim().replace(/\s+/g, " ")
    }))
    .filter((item) => item.content)

  if (!recentTurns.length) {
    return `
[RECENT CONTEXT]
No previous chat turns yet. Start naturally from the user's current message.
`.trim()
  }

  const transcript = recentTurns
    .map((item, index) => `${index + 1}. ${item.role}: ${item.content.slice(0, 200)}`)
    .join("\n")

  return `
[RECENT CONTEXT]
Use this thread context to stay coherent and avoid repeating questions the user already answered.
${transcript}
`.trim()
}

export function createPromptManager() {
  return {
    buildMessages({ state, history, objectionPrompt = null, socialProof = "", productKnowledge = "" }) {
      const baseSystemPrompt = buildBaseSystemPrompt(productKnowledge)
      const objectionBlock = buildObjectionPrompt(objectionPrompt)

      const systemMessages = [
        { role: "system", content: baseSystemPrompt },
        { role: "system", content: buildStageContextPrompt(state, socialProof) },
        { role: "system", content: buildRecentContextPrompt(history) },
        { role: "system", content: buildAntiRepetitionPrompt(history) }
      ]

      if (objectionBlock) {
        systemMessages.push({ role: "system", content: objectionBlock })
      }

      return [...systemMessages, ...history]
    }
  }
}
