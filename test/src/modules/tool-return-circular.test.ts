import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import { tools } from './services/tool.ts'

await runTest('工具返回循环引用', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 return_circular 工具，不需要任何参数' })

  let errorEvent: any = null
  manager.onEvent = (e) => {
    if (e.type === 'agent_error') errorEvent = e
  }

  await manager.start()
  assert.ok(errorEvent, '预期触发 agent_error 事件')
})
