import twilio from "twilio"
import { config } from "./src/config/index.js"
import { createOpenAIClient } from "./src/services/openaiClient.js"
import { createPromptManager } from "./src/services/promptManager.js"
import { createMongoStateRepository } from "./src/services/mongoStateRepository.js"
import { createMongoTargetsRepository } from "./src/services/mongoTargetsRepository.js"
import { createConversationEngine } from "./src/core/conversationEngine.js"
import { setStateRepository } from "./src/core/stateStore.js"
import { createServer } from "./src/http/server.js"
import { createTargetsManager } from "./src/services/targetsManager.js"

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
  if (config.adminUi.password === "change-me") {
    console.warn("⚠️ ADMIN_UI_PASSWORD is using the default value. Set a strong password in .env.")
  }

  if (!config.mongodb.enabled) {
    throw new Error(
      "MongoDB is required because campaign targets are stored in the database. Set MONGODB_URI or MONGODB_HOST."
    )
  }

  const stateRepository = createMongoStateRepository({
    mongoConfig: config.mongodb,
    defaultMaxHistoryMessages: config.conversation.maxHistoryMessages
  })
  await stateRepository.init()
  setStateRepository(stateRepository)

  const targetsRepository = createMongoTargetsRepository({
    mongoConfig: config.mongodb,
    seedTargets: config.defaultTargets,
    collectionName: config.mongodb.targetsCollection
  })
  await targetsRepository.init()

  const targetsManager = createTargetsManager({
    targetsSet: config.targets,
    repository: targetsRepository
  })
  await targetsManager.refreshTargetsSet()

  console.log("🗄️ MongoDB chat history enabled")
  console.log("🎯 MongoDB campaign targets enabled")

  const conversationEngine = createConversationEngine({
    twilioClient,
    openAIClient,
    promptManager,
    config,
    stateRepository
  })
  global.__conversationEngine = conversationEngine
  await conversationEngine.init()

  const app = createServer({
    config,
    conversationEngine,
    targetsManager
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

process.on("SIGTERM", () => {
  if (global.__conversationEngine) {
    global.__conversationEngine.destroy()
  }
})
