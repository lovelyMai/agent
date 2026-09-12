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

export const contentChunk = (text: string): MockChunk => ({
  choices: [{ delta: { content: text } }],
})

export const reasoningChunk = (text: string): MockChunk => ({
  choices: [{ delta: { reasoning_content: text } }],
})

export const createSequenceMockClient = (calls: MockChunk[][]) => {
  const requests: any[] = []
  let index = 0
  const client = {
    chat: {
      completions: {
        create: async (params: any) => {
          requests.push(params)
          const chunks = calls[index++] ?? []
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) yield chunk
            },
          }
        },
      },
    },
  } as unknown as OpenAI
  return { client, requests }
}

export const createFailingMockClient = (error: Error, chunks: MockChunk[] = []) =>
  ({
    chat: {
      completions: {
        create: async () => ({
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk
            throw error
          },
        }),
      },
    },
  }) as unknown as OpenAI

export const createRejectingMockClient = (error: Error) =>
  ({
    chat: {
      completions: {
        create: async () => {
          throw error
        },
      },
    },
  }) as unknown as OpenAI
