import assert from 'node:assert/strict'
import type OpenAI from 'openai'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import {
  contentChunk,
  createSequenceMockClient,
  finishChunk,
  toolCallChunk,
  usageChunk,
} from './services/mock.ts'
import { tools } from './services/tool.ts'

const toolCall = (id: string) => ({
  id,
  type: 'function' as const,
  function: { name: 'get_weather', arguments: '{"city":"北京"}' },
})

const createInterruptMockClient = (chunks: any[], stopAfter: number) => {
  let manager: ReturnType<typeof createManager>
  const client = {
    chat: {
      completions: {
        create: async () => ({
          [Symbol.asyncIterator]: async function* () {
            for (const [i, chunk] of chunks.entries()) {
              yield chunk
              if (i === stopAfter) manager.stop()
            }
          },
        }),
      },
    },
  } as unknown as OpenAI
  return {
    client,
    attach: (m: ReturnType<typeof createManager>) => (manager = m),
  }
}

await runTest('残留未回填的工具调用应在 start 时补齐', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('好'), usageChunk(10)]])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })
  manager.messages.push({ role: 'assistant', tool_calls: [toolCall('c1')] })

  await manager.start()

  assert.deepEqual(requests[0].messages[2], {
    role: 'tool',
    content: '工具调用已被取消',
    tool_call_id: 'c1',
  })
})

await runTest('部分回填时应在 start 时补欠缺的', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('好'), usageChunk(10)]])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })
  manager.messages.push({ role: 'assistant', tool_calls: [toolCall('c1'), toolCall('c2')] })
  manager.messages.push({ role: 'tool', content: '旧结果', tool_call_id: 'c1' })

  await manager.start()

  const sent = requests[0].messages
  assert.equal(sent[2].tool_call_id, 'c1')
  assert.equal(sent[2].content, '旧结果', '已回填的应保持原样')
  assert.deepEqual(sent[3], {
    role: 'tool',
    content: '工具调用已被取消',
    tool_call_id: 'c2',
  })
})

await runTest('已完整回填时不应额外补齐', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('好'), usageChunk(10)]])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })
  manager.messages.push({ role: 'assistant', tool_calls: [toolCall('c1')] })
  manager.messages.push({ role: 'tool', content: '旧结果', tool_call_id: 'c1' })

  await manager.start()

  assert.equal(requests[0].messages.filter((m: any) => m.role === 'tool').length, 1, '不应重复补齐')
})

await runTest('多次 start 不应重复补齐', async () => {
  const { client, requests } = createSequenceMockClient([
    [contentChunk('第一次'), usageChunk(10)],
    [contentChunk('第二次'), usageChunk(20)],
  ])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })
  manager.messages.push({ role: 'assistant', tool_calls: [toolCall('c1')] })

  await manager.start()
  await manager.start()

  assert.equal(
    requests[1].messages.filter((m: any) => m.role === 'tool').length,
    1,
    '第二次 start 不应重复补齐',
  )
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

await runTest('tool_calls 未生成完时中断，不应写入 messages', async () => {
  const { client, attach } = createInterruptMockClient(
    [toolCallChunk('get_weather', '{"city":"北'), usageChunk(10)],
    0,
  )
  const manager = createManager(client)
  attach(manager)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })

  await manager.start()

  assert.equal(manager.messages.length, 1, '半截 tool_calls 不应写入')
})

await runTest('tool_calls 生成完但未执行时中断，重启应补齐', async () => {
  const { client, attach } = createInterruptMockClient(
    [toolCallChunk('get_weather', '{"city":"北京"}'), finishChunk('tool_calls'), usageChunk(10)],
    2,
  )
  const manager = createManager(client)
  attach(manager)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })

  await manager.start()

  assert.equal(manager.messages.length, 2, '完整 tool_calls 应写入')
  assert.ok(manager.messages[1].tool_calls)
  assert.equal(manager.messages.filter((m) => m.role === 'tool').length, 0, '工具应未执行')

  await manager.start()

  assert.equal(manager.messages.filter((m) => m.role === 'tool').length, 1, '重启时应补齐工具调用')
})

await runTest('半截 tool_calls 且有文本时，应保留文本并丢弃 tool_calls', async () => {
  const { client, attach } = createInterruptMockClient(
    [contentChunk('我来查'), toolCallChunk('get_weather', '{"city":"北'), usageChunk(10)],
    1,
  )
  const manager = createManager(client)
  attach(manager)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京天气' })

  await manager.start()

  assert.equal(manager.messages.length, 2, '应只写入文本')
  assert.equal(manager.messages[1].content, '我来查')
  assert.ok(!manager.messages[1].tool_calls, '半截 tool_calls 应丢弃')
})
