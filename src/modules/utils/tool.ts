import type { AssistantMessage, Message } from '@/types/index.ts'

export const completeToolCalls = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role === 'user') return
    if (message.role !== 'assistant') continue
    const assistantMessage = message as AssistantMessage
    if (!assistantMessage.tool_calls?.length) continue
    const replied = new Set(
      messages
        .slice(i + 1)
        .filter((message) => message.role === 'tool')
        .map((message) => message.tool_call_id),
    )
    for (const toolCall of assistantMessage.tool_calls!) {
      if (!replied.has(toolCall.id)) {
        messages.push({
          role: 'tool',
          name: toolCall.function.name,
          content: '工具调用已被取消',
          tool_call_id: toolCall.id,
        })
      }
    }
    return
  }
}
