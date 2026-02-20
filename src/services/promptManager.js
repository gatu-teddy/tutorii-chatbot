import fs from "fs"
import path from "path"
import { STAGES } from "../constants/stages.js"

const STAGE_DIRECTIVES = {
  [STAGES.INITIAL]:
    "Acknowledge the user's situation and ask one short qualifying question. Avoid a heavy pitch.",
  [STAGES.INTERESTED]:
    "Explain Tutorii clearly in one compact explanation and connect it to their real situation.",
  [STAGES.QUALIFIED]:
    "Ask a consent-based question for sharing the signup link unless consent is already explicit.",
  [STAGES.LINK_SENT]:
    "Support onboarding questions, keep replies concise, and avoid repeating the full pitch."
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
You are Tutorii's senior outbound WhatsApp sales consultant.

[OBJECTIVE]
Guide job seekers in UAE/GCC from curiosity to informed signup while staying compliant and respectful.

[NON-NEGOTIABLE RULES]
- Tutorii is a subscription learning platform with optional referral earnings.
- It is not a job offer, not employment, and not guaranteed income.
- Never promise fixed earnings or pressure users with urgency tactics.
- Send signup link only after explicit consent.
- If user declines, close politely and stop pushing.

[REPLY FORMAT]
- 2 to 3 short sentences.
- Maximum 60 words.
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

export function createPromptManager({ promptsDir }) {
  const knowledge = loadKnowledge(promptsDir)
  const baseSystemPrompt = buildBaseSystemPrompt(knowledge)

  return {
    buildMessages({ state, history }) {
      return [
        { role: "system", content: baseSystemPrompt },
        { role: "system", content: buildStageContextPrompt(state) },
        ...history
      ]
    }
  }
}
