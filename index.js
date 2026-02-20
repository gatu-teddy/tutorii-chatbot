import twilio from "twilio"
import { config } from "./src/config.js"
import { createOpenAIClient } from "./src/openaiClient.js"
import { createPromptManager } from "./src/promptManager.js"
import { createConversationEngine } from "./src/conversationEngine.js"
import { createServer } from "./src/server.js"

const twilioClient = twilio(
  config.twilio.accountSid,
  config.twilio.authToken
)

const openAIClient = createOpenAIClient({
  apiKey: config.openai.apiKey,
  model: config.openai.model,
  temperature: config.openai.temperature,
  maxTokens: config.openai.maxTokens
})

const promptManager = createPromptManager({
  promptsDir: config.promptsDir
})

const conversationEngine = createConversationEngine({
  twilioClient,
  openAIClient,
  promptManager,
  config
})

const app = createServer({
  config,
  conversationEngine
})

app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`)
  console.log(`🎯 Target numbers loaded: ${config.targets.size}`)
})
