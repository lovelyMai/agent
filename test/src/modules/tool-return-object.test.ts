import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import { tools } from './services/tool.ts'

await runTest('工具返回对象', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 return_object 工具，传入 key 为 score' })

  await manager.start()
  const toolMsg = manager.messages.find((m) => m.role === 'tool')
  assert.ok(toolMsg, '预期存在 tool 消息')
  const parsed = JSON.parse(toolMsg.content as string)
  assert.equal(parsed.score, 42)
})
