import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'

await runTest('简单对话', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  let content = ''
  manager.onEvent = (e) => {
    if (e.type === 'message_update' && 'content' in e.text) {
      content += e.text.content ?? ''
    }
  }

  await manager.start()
  assert.ok(content.length > 0, '预期收到内容')
  assert.ok(manager.messages.length >= 2)
})
