import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { completeToolCalls } from '@/modules/utils/tool.ts'
import { createManager } from './services/manager.ts'
import {
  contentChunk,
  createSequenceMockClient,
  toolCallChunk,
  usageChunk,
} from './services/mock.ts'
import { tools } from './services/tool.ts'

const toolCall = (id: string) => ({
  id,
  type: 'function' as const,
  function: { name: 'f', arguments: '{}' },
})

await runTest('未回填的工具调用应补齐', () => {
  const messages: any[] = [
    { role: 'user', content: 'x' },
    { role: 'assistant', tool_calls: [toolCall('c1')] },
  ]

  completeToolCalls(messages)

  assert.deepEqual(messages[2], {
    role: 'tool',
    content: '工具调用已被用户取消',
    tool_call_id: 'c1',
  })
})

await runTest('部分回填时应补欠缺的', () => {
  const messages: any[] = [
    { role: 'user', content: 'x' },
    { role: 'assistant', tool_calls: [toolCall('c1'), toolCall('c2')] },
    { role: 'tool', content: 'r1', tool_call_id: 'c1' },
  ]

  completeToolCalls(messages)

  assert.equal(messages.length, 4)
  assert.equal(messages[3].tool_call_id, 'c2')
})

await runTest('已完整回填时不应改动', () => {
  const messages: any[] = [
    { role: 'user', content: 'x' },
    { role: 'assistant', tool_calls: [toolCall('c1')] },
    { role: 'tool', content: 'r1', tool_call_id: 'c1' },
  ]

  completeToolCalls(messages)

  assert.equal(messages.length, 3)
})

await runTest('tool_calls 为空数组时不应改动', () => {
  const messages: any[] = [
    { role: 'user', content: 'x' },
    { role: 'assistant', tool_calls: [] },
  ]

  completeToolCalls(messages)

  assert.equal(messages.length, 2)
})

await runTest('末尾为 user 时不应改动', () => {
  const messages: any[] = [
    { role: 'user', content: 'x' },
    { role: 'assistant', tool_calls: [toolCall('c1')] },
    { role: 'tool', content: 'r1', tool_call_id: 'c1' },
    { role: 'user', content: 'y' },
  ]

  completeToolCalls(messages)

  assert.equal(messages.length, 4)
})

await runTest('多次调用应幂等', () => {
  const messages: any[] = [
    { role: 'user', content: 'x' },
    { role: 'assistant', tool_calls: [toolCall('c1')] },
  ]

  completeToolCalls(messages)
  completeToolCalls(messages)
  completeToolCalls(messages)

  assert.equal(messages.length, 3)
})

await runTest('多工具执行中途 stop 后重新 start 应能继续', async () => {
  const { client, requests } = createSequenceMockClient([
    [
      toolCallChunk('get_weather', '{"city":"北京"}', 0),
      toolCallChunk('get_weather', '{"city":"上海"}', 1),
      usageChunk(30),
    ],
    [contentChunk('晴'), usageChunk(40)],
  ])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京上海天气' })

  manager.onEvent = (e) => {
    if (e.type === 'tool_end') manager.stop()
  }
  await manager.start()
  manager.onEvent = undefined

  assert.equal(manager.messages.filter((m) => m.role === 'tool').length, 1, '第二个工具应未执行')

  await manager.start()

  const sent = requests[1].messages
  for (const [i, message] of sent.entries()) {
    if (message.role !== 'assistant' || !message.tool_calls?.length) continue
    for (const call of message.tool_calls) {
      assert.ok(
        sent.slice(i + 1).some((m: any) => m.role === 'tool' && m.tool_call_id === call.id),
        `tool_call ${call.id} 应有回填`,
      )
    }
  }
  assert.equal(manager.messages[manager.messages.length - 1].content, '晴')
})
