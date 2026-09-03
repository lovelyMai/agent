import type { Ref } from '@vue/reactivity'
import type OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'

import { createError } from '../utils/error.ts'

type Config = {
  /** 模型 */
  model: string
  /** 消息 */
  messages: (ChatCompletionMessageParam & {
    reasoning_content?: string | null
  })[]
  /** 工具定义 */
  tools: ChatCompletionTool[]
}

type Delta = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string | null
}

type Usage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type Accumulated = {
  role: 'assistant'
  content?: string | null
  reasoning_content?: string | null
  tool_calls?: ChatCompletionMessageFunctionToolCall[]
  usage: Usage
}

export const streamOut = async (
  client: OpenAI,
  config: Config,
  onChunk: (text: { content: string } | { reasoning_content: string }) => void,
  isRunning: Ref<boolean>,
): Promise<Accumulated> => {
  const messages = config.messages
  const lastMessage = messages[messages.length - 1]
  const accumulated: Accumulated =
    lastMessage.role === 'assistant'
      ? {
          role: 'assistant',
          content: typeof lastMessage.content === 'string' ? lastMessage.content : '',
          reasoning_content: lastMessage.reasoning_content,
          tool_calls: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }
      : {
          role: 'assistant',
          content: '',
          reasoning_content: '',
          tool_calls: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }
  try {
    const response = await client.chat.completions.create({
      ...config,
      stream: true,
      tool_choice: 'auto',
      stream_options: { include_usage: true },
    })

    for await (const chunk of response) {
      if (!isRunning.value) {
        throw createError('主动停止', 200)
      }

      const delta = chunk.choices[0]?.delta as Delta

      if (delta?.content) {
        accumulated.content += delta.content
        onChunk({ content: delta.content })
      }

      if (delta?.reasoning_content) {
        accumulated.reasoning_content += delta.reasoning_content
        onChunk({ reasoning_content: delta.reasoning_content })
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!accumulated.tool_calls?.[tc.index]) {
            if (!accumulated.tool_calls) {
              accumulated.tool_calls = []
            }
            accumulated.tool_calls[tc.index] = {
              id: tc.id || '',
              type: 'function',
              function: {
                name: tc.function?.name || '',
                arguments: '',
              },
            }
          }
          const target = accumulated.tool_calls[tc.index]
          if (tc.id) target.id = tc.id
          if (tc.function?.name) target.function.name = tc.function.name
          if (tc.function?.arguments) {
            target.function.arguments += tc.function.arguments
          }
        }
      }

      if (chunk.usage) {
        accumulated.usage = chunk.usage
      }
    }

    if (accumulated.tool_calls?.length === 0) {
      delete accumulated.tool_calls
    }

    if (!accumulated.content) {
      delete accumulated.content
    }

    if (!accumulated.reasoning_content) {
      delete accumulated.reasoning_content
    }

    return accumulated
  } catch (error: any) {
    if (accumulated.tool_calls?.length === 0) {
      delete accumulated.tool_calls
    }
    if (!accumulated.content) {
      delete accumulated.content
    }
    if (!accumulated.reasoning_content) {
      delete accumulated.reasoning_content
    }
    throw Object.assign(error, { accumulated })
  }
}
