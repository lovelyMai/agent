import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import {
  contentChunk,
  createFailingMockClient,
  createRejectingMockClient,
  createSequenceMockClient,
  reasoningChunk,
  usageChunk,
} from './services/mock.ts'

const collectContent = (manager: ReturnType<typeof createManager>) => {
  const chunks: string[] = []
  manager.onEvent = (e) => {
    if (e.type === 'message_update' && 'content' in e.text) chunks.push(e.text.content ?? '')
  }
  return chunks
}

await runTest('prefill：末尾 assistant 应作为提示词前一条', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })

  await manager.start()

  const sent = requests[0].messages
  assert.deepEqual(sent[sent.length - 2], { role: 'assistant', content: '答案是 1+1=' })
})

await runTest('prefill：续写提示词应追加在 assistant 之后', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })

  await manager.start()

  const sent = requests[0].messages
  assert.equal(sent[sent.length - 1].role, 'system', '提示词应在 assistant 之后')
  assert.match(sent[sent.length - 1].content, /续写/)
  assert.equal(sent[sent.length - 2].role, 'assistant')
})

await runTest('prefill：生成后应替换而非追加', async () => {
  const { client } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })

  await manager.start()

  assert.equal(manager.messages.length, 2, '不应追加新消息')
  assert.equal(manager.messages[1].content, '答案是 1+1=2', '应拼接前缀')
})

await runTest('prefill：message_update 只发增量', async () => {
  const { client } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })
  const chunks = collectContent(manager)

  await manager.start()

  assert.deepEqual(chunks, ['2'])
})

await runTest('末尾为 user 时不应插提示词且正常追加', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('好'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '回复一个字' })

  await manager.start()

  assert.ok(!requests[0].messages.some((m: any) => m.role === 'system'), '非 prefill 不应插提示词')
  assert.equal(manager.messages.length, 2)
  assert.equal(manager.messages[1].content, '好')
})

await runTest('工具消息之后不应判为 prefill', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('好'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: 'x' })
  manager.messages.push({
    role: 'assistant',
    content: 'a',
    tool_calls: [{ id: 'c', type: 'function', function: { name: 'f', arguments: '{}' } }],
  })
  manager.messages.push({ role: 'tool', name: 'get_weather', content: 'r', tool_call_id: 'c' })

  await manager.start()

  assert.ok(!requests[0].messages.some((m: any) => m.role === 'system'), '工具轮不应插提示词')
  assert.equal(manager.messages.length, 4, '应追加新消息')
  assert.equal(manager.messages[3].content, '好')
})

await runTest('prefill：不应污染 messages', async () => {
  const { client } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })

  await manager.start()

  assert.ok(!manager.messages.some((m) => m.role === 'system'), '提示词不应写入 messages')
})

await runTest('末尾为 system 时仍应判为 prefill', async () => {
  const { client, requests } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })
  manager.messages.push({ role: 'system', content: '你是一个助手' })

  await manager.start()

  const sent = requests[0].messages
  assert.equal(sent[sent.length - 3].content, '答案是 1+1=', 'assistant 应保留前缀')
  assert.equal(sent[sent.length - 2].content, '你是一个助手', 'system 应保持在原位')
  assert.equal(sent[sent.length - 1].role, 'system', '提示词应在末尾')
  assert.match(sent[sent.length - 1].content, /续写/)
  assert.equal(manager.messages[1].content, '答案是 1+1=2', '应替换而非追加')
})

await runTest('末尾为未知 role 时仍应判为 prefill', async () => {
  const { client } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })
  manager.messages.push({ role: 'custom', content: 'c' } as any)

  await manager.start()

  assert.equal(manager.messages[1].content, '答案是 1+1=2', '应替换而非追加')
})

await runTest('仅 assistant 时也应判为 prefill', async () => {
  const { client } = createSequenceMockClient([[contentChunk('2'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })

  await manager.start()

  assert.equal(manager.messages.length, 1, '不应追加')
  assert.equal(manager.messages[0].content, '答案是 1+1=2')
})

await runTest('content 为空时不应拼出 undefined', async () => {
  const { client } = createSequenceMockClient([[contentChunk('续'), usageChunk(20)]])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: 'x' })
  manager.messages.push({ role: 'assistant' })

  await manager.start()

  assert.equal(manager.messages[1].content, '续')
})

await runTest('reasoning 先于 content 时应正常输出', async () => {
  const { client } = createSequenceMockClient([
    [reasoningChunk('嗯…'), contentChunk('2'), usageChunk(20)],
  ])
  const manager = createManager(client)
  manager.messages.push({ role: 'user', content: '1+1=' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })
  const chunks = collectContent(manager)

  await manager.start()

  assert.deepEqual(chunks, ['2'])
  assert.equal(manager.messages[1].content, '答案是 1+1=2')
})

await runTest('零 chunk 断流时不应追加空消息', async () => {
  const manager = createManager(createFailingMockClient(new Error('连接中断')))
  manager.messages.push({ role: 'user', content: 'x' })

  await manager.start()

  assert.equal(manager.messages.length, 1, '未收到内容时不应追加')
})

await runTest('create 失败时不应追加消息', async () => {
  const manager = createManager(createRejectingMockClient(new Error('网络错误')))
  manager.messages.push({ role: 'user', content: 'x' })

  await manager.start()

  assert.equal(manager.messages.length, 1)
})

await runTest('prefill 应触发模型续写而非回显', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '请计算 1+1' })
  manager.messages.push({ role: 'assistant', content: '答案是 1+1=' })

  await manager.start()

  const content = String(manager.messages[manager.messages.length - 1].content)
  assert.ok(content.startsWith('答案是 1+1='), `应保留前缀，实际：${content}`)
  assert.equal(content.indexOf('答案是 1+1=', 1), -1, `前缀不应重复出现，实际：${content}`)
})
