import { ChatCompletionMessageParam } from 'openai/resources'

type Message = ChatCompletionMessageParam & {
  reasoning_content?: string | null
}

export const completeToolCalls = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role === 'user') return
    if (message.role !== 'assistant' || !message.tool_calls?.length) continue
    const replied = new Set(
      messages
        .slice(i + 1)
        .filter((message) => message.role === 'tool')
        .map((message) => message.tool_call_id),
    )
    for (const toolCall of message.tool_calls) {
      if (!replied.has(toolCall.id)) {
        messages.push({
          role: 'tool',
          content: '工具调用已被取消',
          tool_call_id: toolCall.id,
        })
      }
    }
    return
  }
}
