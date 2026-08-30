import { reactive, ref, shallowRef } from '@vue/reactivity'
import type OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

import { streamOut } from './modules/stream.ts'
import { generateTools, type Tool, type ToolDefinition } from './modules/tool.ts'

export type AgentManager = {
  /** 模型配置 */
  config: { model: string; [key: string]: any }
  /** 消息数组 */
  messages: (ChatCompletionMessageParam & { [key: string]: any })[]
  /** 最大迭代次数 */
  maxIteration: number
  /** 环境参数对象 */
  environment: Record<string, any>
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
  | { type: 'message_update'; text: { content?: string; reasoning_content?: string } }
  | { type: 'tool_start'; toolCall: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall }
  | { type: 'tool_end'; toolCall: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall }
  | { type: 'agent_end'; turnCount: number }
  | { type: 'agent_error'; error: unknown }

export const createAgentManager = (client: OpenAI): AgentManager => {
  const config = ref<{ model: string; [key: string]: any }>({ model: '' })
  const messages = ref<(ChatCompletionMessageParam & { [key: string]: any })[]>([])
  const toolDefinitions = ref<ToolDefinition[]>([])
  const toolExecutors = ref<
    Record<string, (args: Record<string, any>, env: Record<string, any>) => any>
  >({})
  const maxIteration = ref<number>(10)
  const environment = shallowRef<Record<string, any>>({})
  const onEvent = ref<(event: Event) => void>()
  const isRunning = ref<boolean>(false)
  const updateTools = (tools: Tool[]) => {
    const newTools = generateTools(tools)
    toolDefinitions.value = newTools.toolDefinitions
    toolExecutors.value = newTools.toolExecutors
  }
  const start = async () => {
    isRunning.value = true
    onEvent.value?.({ type: 'agent_start' })
    try {
      for (let i = 0; i < maxIteration.value; i++) {
        if (!isRunning.value) return
        onEvent.value?.({ type: 'turn_start', turnCount: i })
        const filteredMessages = messages.value.filter((message) =>
          ['system', 'user', 'assistant', 'tool'].includes(message.role),
        )
        const accumulated = await streamOut(
          client,
          {
            ...config.value,
            messages: filteredMessages,
            tools: toolDefinitions.value,
          },
          (text: { content?: string } | { reasoning_content?: string }) => {
            onEvent.value?.({ type: 'message_update', text })
          },
          isRunning,
        )
        messages.value.push(accumulated)

        if (!accumulated.tool_calls) {
          onEvent.value?.({ type: 'agent_end', turnCount: i })
          return
        }
        for (const toolCall of accumulated.tool_calls) {
          if (!isRunning.value) {
            throw new Error('主动停止')
          }
          const executor = toolExecutors.value[toolCall.function.name]
          if (!executor) continue
          onEvent.value?.({ type: 'tool_start', toolCall })
          const args = JSON.parse(toolCall.function.arguments) as Record<string, any>
          let result: any
          try {
            result = await executor(args, environment.value)
          } catch (error) {
            result = error instanceof Error ? error.message : error
          }
          result = typeof result === 'string' ? result : JSON.stringify(result)
          messages.value.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          })
          onEvent.value?.({ type: 'tool_end', toolCall })
        }
      }
      onEvent.value?.({ type: 'agent_end', turnCount: maxIteration.value })
    } catch (error) {
      onEvent.value?.({ type: 'agent_error', error })
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
    updateTools,
    start,
    stop,
  })
}
