import type { Ref } from '@vue/reactivity'
import type OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionToolChoiceOption,
} from 'openai/resources/chat/completions'

import { createError } from '../utils/error.ts'

export type StreamConfig = {
  /** 模型 */
  model: string
  /** 消息 */
  messages: (ChatCompletionMessageParam & {
    reasoning_content?: string | null
  })[]
  /** 工具定义 */
  tools: ChatCompletionTool[]
  /** 工具选择 */
  tool_choice: ChatCompletionToolChoiceOption
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
  config: StreamConfig,
  onChunk: (text: { content: string } | { reasoning_content: string }) => void,
  isRunning: Ref<boolean>,
): Promise<Accumulated> => {
  const accumulated: Accumulated = {
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

    if (config.tool_choice === 'none' && accumulated.tool_calls?.length) {
      throw createError('模型在 tool_choice 为 none 时仍返回了工具调用', 400)
    }
    const forcedToolName =
      typeof config.tool_choice === 'object' && config.tool_choice.type === 'function'
        ? config.tool_choice.function.name
        : undefined
    if (
      forcedToolName &&
      accumulated.tool_calls?.some((tc) => tc.function.name !== forcedToolName)
    ) {
      throw createError('模型调用了非指定的工具', 400)
    }

    return accumulated
  } catch (error: any) {
    throw Object.assign(error, { accumulated })
  } finally {
    if (accumulated.tool_calls?.length === 0) {
      delete accumulated.tool_calls
    }
    if (!accumulated.content) {
      delete accumulated.content
    }
    if (!accumulated.reasoning_content) {
      delete accumulated.reasoning_content
    }
  }
}
