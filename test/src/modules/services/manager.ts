import { AI_CONFIG } from '@test/config.ts'
import OpenAI from 'openai'

import { createAgentManager } from '@/index.ts'

const createClient = () => new OpenAI({ baseURL: AI_CONFIG.baseURL, apiKey: AI_CONFIG.key })

export const createManager = () => {
  const client = createClient()
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
  return manager
}
