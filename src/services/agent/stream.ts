import type { Ref } from '@vue/reactivity'
import type OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'

export type Config = {
  /** 模型 */
  model: string
  /** 消息 */
  messages: ChatCompletionMessageParam[]
  /** 工具定义 */
  tools: ChatCompletionTool[]
  [key: string]: any
}

type Delta = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string | null
}

type Accumulated = {
  role: 'assistant'
  content?: string
  reasoning_content?: string
  tool_calls?: ChatCompletionMessageFunctionToolCall[]
}

export const streamOut = async (
  client: OpenAI,
  config: Config,
  onChunk: (text: { content?: string; reasoning_content?: string }) => void,
  isRunning: Ref<boolean>,
): Promise<Accumulated> => {
  const response = await client.chat.completions.create({
    ...config,
    stream: true,
    tool_choice: 'auto',
  })

  const accumulated: Accumulated = {
    role: 'assistant',
    content: '',
    reasoning_content: '',
    tool_calls: [],
  }

  for await (const chunk of response) {
    if (!isRunning.value) {
      throw new Error('主动停止')
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
}
