import type OpenAI from 'openai'

type MockChunk = { choices: any[]; usage?: any }

export const createMockClient = (chunks: MockChunk[]) =>
  ({
    chat: {
      completions: {
        create: async () => ({
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk
          },
        }),
      },
    },
  }) as unknown as OpenAI

export const toolCallChunk = (name: string, args: string, index = 0): MockChunk => ({
  choices: [
    {
      delta: {
        tool_calls: [
          {
            index,
            id: `call_${index}`,
            type: 'function',
            function: { name, arguments: args },
          },
        ],
      },
    },
  ],
})

export const usageChunk = (totalTokens: number): MockChunk => ({
  choices: [],
  usage: {
    prompt_tokens: totalTokens,
    completion_tokens: 0,
    total_tokens: totalTokens,
  },
})
