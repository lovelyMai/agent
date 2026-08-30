import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'

await runTest('usage 统计正确', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  await manager.start()
  assert.ok(typeof manager.usage === 'number', '预期 usage 为 number')
  assert.ok(manager.usage > 0, '预期 usage > 0')
})
