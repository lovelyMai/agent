import { randomUUID } from 'node:crypto'
import { AI_CONFIG } from '@test/config.test.ts'
import OpenAI from 'openai'

import { createAgentManager } from '@/index.ts'

const createClient = () =>
  new OpenAI({
    baseURL: AI_CONFIG.baseURL,
    apiKey: AI_CONFIG.key,
    defaultHeaders: { 'x-opencode-session': randomUUID() },
  })

export const createManager = (client: OpenAI = createClient()) => {
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
  manager.config.reasoning_effort = 'none'
  return manager
}
