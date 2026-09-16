import assert from 'node:assert/strict'

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

await runTest('工具参数非法 JSON 时应回填错误且不中断', async () => {
  const { client } = createSequenceMockClient([
    [toolCallChunk('calculate', '{非法'), finishChunk('tool_calls'), usageChunk(10)],
    [contentChunk('参数有误'), usageChunk(20)],
  ])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '算一下' })

  const events: string[] = []
  manager.onEvent = (e) => {
    events.push(e.type)
    if (e.type === 'agent_error') throw new Error(`不应触发 agent_error：${e.error.message}`)
  }

  await manager.start()

  assert.equal(events.filter((type) => type === 'tool_end').length, 1, '应触发一次 tool_end')
  const toolMessage = manager.messages.find((m) => m.role === 'tool')
  assert.ok(toolMessage, '应回填 tool 消息')
  assert.match(String(toolMessage.content), /JSON/i, '应回填 JSON 解析错误')
  assert.equal(manager.messages[manager.messages.length - 1].content, '参数有误', '应继续下一轮')
})

await runTest('部分工具参数非法时其余工具应继续执行', async () => {
  const { client } = createSequenceMockClient([
    [
      toolCallChunk('get_weather', '{"city":"北京"}', 0),
      toolCallChunk('calculate', '{非法', 1),
      finishChunk('tool_calls'),
      usageChunk(10),
    ],
    [contentChunk('完成'), usageChunk(20)],
  ])
  const manager = createManager(client)
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '先查天气再计算' })

  let successCount = 0
  manager.onEvent = (e) => {
    if (e.type === 'tool_end' && e.success) successCount++
    if (e.type === 'agent_error') throw new Error(`不应触发 agent_error：${e.error.message}`)
  }

  await manager.start()

  assert.equal(successCount, 1, '正常工具应执行成功')
  const toolMessages = manager.messages.filter((m) => m.role === 'tool')
  assert.equal(toolMessages.length, 2, '两个工具都应回填')
  const failed = toolMessages.find((m) => m.tool_call_id === 'call_1')
  assert.ok(failed, '应为非法参数的 tool_call 回填消息')
  assert.match(String(failed.content), /JSON/i)
})
