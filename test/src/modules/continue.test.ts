import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'

await runTest('续写 assistant 消息应替换而非追加', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'assistant', content: '你好' })

  let content = ''
  manager.onEvent = (e) => {
    if (e.type === 'message_update' && 'content' in e.text) {
      content += e.text.content ?? ''
    }
  }

  await manager.start()

  assert.equal(manager.messages.length, 1, '不应新增 assistant 消息')
  assert.equal(manager.messages[0].role, 'assistant')
  assert.ok((manager.messages[0].content as string).includes('你好'), '续写后应保留旧内容')
  assert.ok(content.length > 0, '预期收到新内容')
})

await runTest('续写后 assistant 消息应包含旧内容与新内容', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'assistant', content: '上一轮内容：' })

  await manager.start()

  const msg = manager.messages[0] as any
  assert.ok(msg.content.startsWith('上一轮内容：'), '内容应以旧内容开头')
  assert.ok(msg.content.length > '上一轮内容：'.length, '内容应比旧内容更长')
})

await runTest('续写时 tool_calls 应重置', async () => {
  const manager = createManager()
  manager.messages.push({
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: 'old_call',
        type: 'function',
        function: { name: 'old_tool', arguments: '{}' },
      },
    ],
  })

  await manager.start()

  const msg = manager.messages[0] as any
  assert.ok(!msg.tool_calls, '旧 tool_calls 应被清除')
})

await runTest('续写后 usage 应为本次统计', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'assistant', content: '继续' })

  await manager.start()

  assert.ok(manager.usage > 0, 'usage 应为本次生成的 token 统计')
})
