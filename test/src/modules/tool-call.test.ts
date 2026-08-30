import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import { tools } from './services/tool.ts'

await runTest('工具调用链路', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京今天天气怎么样？请调用工具查询' })

  const eventTypes: string[] = []
  manager.onEvent = (e) => eventTypes.push(e.type)

  await manager.start()
  assert.ok(eventTypes.includes('tool_start'), '预期触发 tool_start')
  assert.ok(eventTypes.includes('tool_end'), '预期触发 tool_end')
})
