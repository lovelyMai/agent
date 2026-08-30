import { AI_CONFIG } from '@test/config.ts'

export const createClient = async () => {
  const OpenAI = (await import('openai')).default
  return new OpenAI({ baseURL: AI_CONFIG.baseURL, apiKey: AI_CONFIG.key })
}
