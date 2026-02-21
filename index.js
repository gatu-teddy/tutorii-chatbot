import twilio from "twilio"
import { config } from "./src/config/index.js"
import { createOpenAIClient } from "./src/services/openaiClient.js"
import { createPromptManager } from "./src/services/promptManager.js"
import { createPostgresStateRepository } from "./src/services/postgresStateRepository.js"
import { createConversationEngine } from "./src/core/conversationEngine.js"
import { setStateRepository } from "./src/core/stateStore.js"
import { createServer } from "./src/http/server.js"

const twilioClient = twilio(
  config.twilio.accountSid,
  config.twilio.authToken
)

const openAIClient = createOpenAIClient({
  apiKey: config.openai.apiKey,
  model: config.openai.model,
  temperature: config.openai.temperature,
  maxTokens: config.openai.maxTokens,
  frequencyPenalty: config.openai.frequencyPenalty,
  presencePenalty: config.openai.presencePenalty
})

const promptManager = createPromptManager({
  promptsDir: config.promptsDir
})

async function bootstrap() {
  if (config.postgres.enabled) {
    const stateRepository = createPostgresStateRepository({
      postgresConfig: config.postgres,
      defaultMaxHistoryMessages: config.conversation.maxHistoryMessages
    })

    await stateRepository.init()
    setStateRepository(stateRepository)
    console.log("🗄️ PostgreSQL chat history enabled")
  } else {
    console.log("🧠 Using in-memory chat history (PostgreSQL disabled)")
  }

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
}

bootstrap().catch((error) => {
  console.error("❌ Failed to start app:", error.message)
  process.exit(1)
})
