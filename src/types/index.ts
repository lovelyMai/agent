import { ChatCompletionMessageFunctionToolCall } from 'openai/resources'

export type SystemMessage = {
  role: 'system'
  content: string
  name?: string
  [key: string]: unknown
}

type ContentPartText = {
  type: 'text'
  text: string
}
type ContentPartImage = {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}
export type UserMessage = {
  role: 'user'
  content: string | (ContentPartText | ContentPartImage)[]
  [key: string]: unknown
}

export type AssistantMessage = {
  role: 'assistant'
  content?: string
  reasoning_content?: string
  tool_calls?: ChatCompletionMessageFunctionToolCall[]
  [key: string]: unknown
}

export type ToolMessage = {
  role: 'tool'
  name: string
  content: string
  tool_call_id: string
  [key: string]: unknown
}

export type KnownMessage = SystemMessage | UserMessage | AssistantMessage | ToolMessage

export type Message = KnownMessage | { [key: string]: unknown }
