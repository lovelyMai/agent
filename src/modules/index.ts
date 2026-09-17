import { computed, reactive, ref, shallowRef } from '@vue/reactivity'
import type OpenAI from 'openai'

import type { Message } from '@/types/index.ts'
import { addAssistant } from './utils/assistant.ts'
import { completeToolCalls } from './utils/tool.ts'

import { streamOut, type StreamConfig } from './modules/stream.ts'
import { generateTools, type Tool, type ToolDefinition } from './modules/tool.ts'

type Config = {
  model: string
  tool_choice: 'auto' | 'none' | 'required' | string
  [key: string]: any
}
export type AgentManager = {
  /** 模型配置 */
  config: Config
  /** 消息数组 */
  messages: Message[]
  /** 最大迭代次数 */
  maxIteration: number
  /** 环境参数对象，赋值给工具函数的第二个参数 */
  environment: Record<string, any>
  /** token 总量 */
  readonly usage: number
  /** 事件回调 */
  onEvent: ((event: Event) => void) | undefined
  /** 更新工具 */
  readonly updateTools: (tools: Tool[]) => void
  /** 开始 */
  readonly start: () => Promise<void>
  /** 结束 */
  readonly stop: () => void
}
export type { Tool }
export type Event =
  | { type: 'agent_start' }
  | { type: 'turn_start'; turnCount: number }
  | {
      type: 'message_update'
      text: { content?: string; reasoning_content?: string }
      turnCount: number
    }
  | {
      type: 'tool_start'
      toolCall: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall
      turnCount: number
    }
  | {
      type: 'tool_end'
      toolCall: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall
      success: boolean
      turnCount: number
    }
  | { type: 'turn_end'; turnCount: number }
  | { type: 'agent_end'; turnCount: number }
  | { type: 'agent_error'; error: any; turnCount: number }

export const createAgentManager = (client: OpenAI): AgentManager => {
  const config = ref<Config>({ model: '', tool_choice: 'auto' })
  const transformedConfig = computed(() => {
    if (['auto', 'none', 'required'].includes(config.value.tool_choice)) {
      return config.value
    } else {
      return {
        ...config.value,
        tool_choice: {
          type: 'function',
          function: { name: config.value.tool_choice },
        },
      }
    }
  })
  const messages = ref<Message[]>([])

  // 工具
  const toolDefinitions = ref<ToolDefinition[]>([])
  const toolExecutors = ref<
    Record<string, (args: Record<string, any>, env: Record<string, any>) => any>
  >({})
  const updateTools = (tools: Tool[]) => {
    const newTools = generateTools(tools)
    toolDefinitions.value = newTools.toolDefinitions
    toolExecutors.value = newTools.toolExecutors
  }

  const maxIteration = ref<number>(10)
  const environment = shallowRef<Record<string, any>>({})
  const onEvent = ref<(event: Event) => void>()
  const isRunning = ref<boolean>(false)
  const usage = ref<number>(0)

  const start = async () => {
    completeToolCalls(messages.value)
    isRunning.value = true
    onEvent.value?.({ type: 'agent_start' })
    let turnCount: number = 1
    try {
      for (let i = 1; i <= maxIteration.value; i++) {
        if (!isRunning.value) return
        turnCount = i
        onEvent.value?.({ type: 'turn_start', turnCount })
        const filteredMessages = messages.value.filter((message) =>
          ['system', 'user', 'assistant', 'tool'].includes(message.role as string),
        )
        const accumulated = await streamOut(
          client,
          {
            ...transformedConfig.value,
            messages: filteredMessages,
            tools: toolDefinitions.value,
          } as StreamConfig,
          (text: { content?: string } | { reasoning_content?: string }) => {
            onEvent.value?.({ type: 'message_update', text, turnCount })
          },
          () => isRunning.value,
        )
        const {
          usage: { total_tokens },
          ...message
        } = accumulated
        usage.value = total_tokens
        addAssistant(messages.value, message)

        if (!accumulated.tool_calls) return
        if (!isRunning.value) return
        await Promise.all(
          accumulated.tool_calls.map(async (toolCall) => {
            const executor = toolExecutors.value[toolCall.function.name]
            if (!executor) {
              messages.value.push({
                role: 'tool',
                name: toolCall.function.name,
                content: '工具不存在',
                tool_call_id: toolCall.id,
              })
              return
            }
            onEvent.value?.({ type: 'tool_start', toolCall, turnCount })
            let result: any
            let success: boolean
            try {
              const args = JSON.parse(toolCall.function.arguments) as Record<string, any>
              result = await executor(args, environment.value)
              success = true
            } catch (error: any) {
              result = error instanceof Error ? error.message : error
              success = false
            }
            result = typeof result === 'string' ? result : JSON.stringify(result)
            messages.value.push({
              role: 'tool',
              name: toolCall.function.name,
              content: result,
              tool_call_id: toolCall.id,
            })
            onEvent.value?.({ type: 'tool_end', toolCall, success, turnCount })
          }),
        )
        onEvent.value?.({ type: 'turn_end', turnCount })
      }
    } catch (error: any) {
      if (error.accumulated) {
        const {
          usage: { total_tokens },
          ...message
        } = error.accumulated
        usage.value = total_tokens
        addAssistant(messages.value, message)
      }
      if (error.code === 200) return
      onEvent.value?.({ type: 'agent_error', error, turnCount })
    } finally {
      onEvent.value?.({ type: 'agent_end', turnCount })
    }
  }
  const stop = () => {
    isRunning.value = false
  }

  return reactive({
    config,
    messages,
    maxIteration,
    environment,
    onEvent,
    usage,
    updateTools,
    start,
    stop,
  })
}
