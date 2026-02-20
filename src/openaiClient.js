import axios from "axios"

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions"

export function createOpenAIClient({ apiKey, model, temperature, maxTokens }) {
  return {
    async generateReply(messages) {
      const response = await axios.post(
        OPENAI_ENDPOINT,
        {
          model,
          temperature,
          max_tokens: maxTokens,
          messages
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      )

      const reply = response.data?.choices?.[0]?.message?.content?.trim()
      if (reply) {
        return reply
      }

      return "Happy to help. Would you like a quick summary of how Tutorii works?"
    }
  }
}

