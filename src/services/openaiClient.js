import axios from "axios"
import { STAGES } from "../constants/stages.js"

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"
const VALID_STAGES = new Set(Object.values(STAGES))

const TURN_DECISION_INSTRUCTIONS = `
[DECISION OUTPUT]
Return ONLY a valid JSON object with these keys:
- reply: string
- next_stage: one of "initial", "interested", "qualified", "link_sent"
- send_link_now: boolean
- mark_opted_out: boolean

[DECISION RULES]
- mark_opted_out = true only when the user clearly asks to stop messaging.
- send_link_now = true only when user gave clear permission to receive the signup link now.
- If send_link_now is true, keep reply short and do not include a URL.
- Use the current live context and chat history to decide stage naturally.
- Reply to the latest user message first, using prior turns to maintain continuity.
- Do not ask questions the user has already answered in recent turns.
- Keep stage transitions realistic:
  - initial -> interested -> qualified -> link_sent
  - do not jump to link_sent unless send_link_now is true or link was already sent in context.
`.trim()

const TURN_DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    next_stage: {
      type: "string",
      enum: [STAGES.INITIAL, STAGES.INTERESTED, STAGES.QUALIFIED, STAGES.LINK_SENT]
    },
    send_link_now: { type: "boolean" },
    mark_opted_out: { type: "boolean" }
  },
  required: ["reply", "next_stage", "send_link_now", "mark_opted_out"]
}

function extractJsonString(raw = "") {
  const text = String(raw).trim()
  if (!text) return ""

  if (text.startsWith("{") && text.endsWith("}")) {
    return text
  }

  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }

  return text
}

function normalizeTurnDecision(parsed = {}) {
  const reply = String(parsed.reply || "").trim()
  const nextStage = VALID_STAGES.has(parsed.next_stage)
    ? parsed.next_stage
    : STAGES.INITIAL

  return {
    reply,
    nextStage,
    sendLinkNow: Boolean(parsed.send_link_now),
    markOptedOut: Boolean(parsed.mark_opted_out)
  }
}

function parseTurnDecision(content) {
  const jsonText = extractJsonString(content)
  const parsed = JSON.parse(jsonText)
  return normalizeTurnDecision(parsed)
}

export function createOpenAIClient({
  apiKey,
  model,
  temperature,
  maxTokens,
  frequencyPenalty = 0,
  presencePenalty = 0
}) {
  async function requestChatCompletion(body) {
    const response = await axios.post(
      OPENAI_ENDPOINT,
      body,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    )

    return response.data?.choices?.[0]?.message?.content?.trim()
  }

  return {
    async generateTurn(messages) {
      const decisionMessages = [
        ...messages,
        { role: "system", content: TURN_DECISION_INSTRUCTIONS }
      ]

      const baseRequest = {
        model,
        temperature,
        max_tokens: maxTokens,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        messages: decisionMessages
      }

      try {
        const content = await requestChatCompletion({
          ...baseRequest,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "turn_decision",
              strict: true,
              schema: TURN_DECISION_SCHEMA
            }
          }
        })

        return parseTurnDecision(content)
      } catch (schemaError) {
        try {
          const content = await requestChatCompletion(baseRequest)
          return parseTurnDecision(content)
        } catch (fallbackError) {
          console.error("❌ Failed to generate AI turn decision:", fallbackError.message)
          return {
            reply: "I hear you. Want me to give you a quick summary of how Tutorii works?",
            nextStage: STAGES.INITIAL,
            sendLinkNow: false,
            markOptedOut: false
          }
        }
      }
    }
  }
}
