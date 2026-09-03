import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'

await runTest('设置 tip 后模型应在此基础上续写', async () => {
  const manager = createManager()
  const tip = '你好，我是助手'
  manager.tip = tip
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  let content = ''
  manager.onEvent = (e) => {
    if (e.type === 'message_update' && 'content' in e.text) {
      content += e.text.content ?? ''
    }
  }

  await manager.start()
  assert.ok(content.length > 0, '预期收到内容')
  assert.ok(content.startsWith(tip), '累积内容应以 tip 开头')
})

await runTest('设置 tip 后 message_update 必定触发', async () => {
  const manager = createManager()
  manager.tip = '开头文本'
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  let eventCount = 0
  manager.onEvent = (e) => {
    if (e.type === 'message_update') {
      eventCount++
    }
  }

  await manager.start()
  assert.ok(eventCount > 0, 'message_update 必须触发')
})

await runTest('第一个 message_update 的 text 应包含 tip 内容', async () => {
  const manager = createManager()
  const tip = '系统提示：'
  manager.tip = tip
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  let firstText: { content?: string; reasoning_content?: string } | undefined
  manager.onEvent = (e) => {
    if (e.type === 'message_update' && 'content' in e.text && !firstText) {
      firstText = e.text
    }
  }

  await manager.start()
  assert.ok(firstText, '应收到 message_update 事件')
  assert.ok(firstText!.content!.startsWith(tip), '第一个 chunk 的 content 应以 tip 开头')
})

await runTest('未设置 tip 时内容不应有前缀', async () => {
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
  assert.ok(!content.startsWith('你好，我是助手'), '未设置 tip 时不应出现 tip 内容')
})
