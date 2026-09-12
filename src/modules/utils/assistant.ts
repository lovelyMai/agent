import { ChatCompletionMessageParam } from 'openai/resources'

type Message = ChatCompletionMessageParam & {
  reasoning_content?: string | null
}

export const findPrefillIndex = (messages: Message[]) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role === 'assistant') {
      return i
    }
    if (message.role === 'user' || message.role === 'tool') {
      return -1
    }
  }
  return -1
}

export const addAssistant = (messages: Message[], message: Message) => {
  const index = findPrefillIndex(messages)
  if (index === -1) {
    messages.push(message)
  } else {
    messages[index] = message
  }
}
