import assert from 'node:assert/strict'

import { createClient } from './modules/client.ts'
import { tools } from './modules/tool.ts'

import { AI_CONFIG } from '../config.ts'
import { createAgentManager } from '@/index.ts'

let passed = 0
let failed = 0

const runTest = async (name: string, fn: () => void | Promise<void>) => {
  try {
    const result = fn()
    if (result instanceof Promise) await result
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e: any) {
    console.log(`  ❌ ${name}`)
    console.error(`     ${e.message}`)
    failed++
  }
}

console.log('\n🤖 createAgentManager\n')

await runTest('简单对话', async () => {
  const client = await createClient()
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
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

await runTest('工具调用链路', async () => {
  const client = await createClient()
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '北京今天天气怎么样？请调用工具查询' })

  const eventTypes: string[] = []
  manager.onEvent = (e) => eventTypes.push(e.type)

  await manager.start()
  assert.ok(eventTypes.includes('tool_start'), '预期触发 tool_start')
  assert.ok(eventTypes.includes('tool_end'), '预期触发 tool_end')
})

console.log('\n🔧 工具返回值类型测试\n')

await runTest('工具返回字符串 → content 为原始字符串', async () => {
  const client = await createClient()
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 return_string 工具，传入 value 为 hello' })

  await manager.start()
  const toolMsg = manager.messages.find((m) => m.role === 'tool')
  assert.ok(toolMsg, '预期存在 tool 消息')
  assert.equal(toolMsg.content, 'hello')
})

await runTest('工具返回对象 → content 为 JSON 序列化字符串', async () => {
  const client = await createClient()
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 return_object 工具，传入 key 为 score' })

  await manager.start()
  const toolMsg = manager.messages.find((m) => m.role === 'tool')
  assert.ok(toolMsg, '预期存在 tool 消息')
  const parsed = JSON.parse(toolMsg.content)
  assert.equal(parsed.score, 42)
})

await runTest('工具返回循环引用 → 触发 agent_error', async () => {
  const client = await createClient()
  const manager = createAgentManager(client)
  manager.config.model = AI_CONFIG.model
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 return_circular 工具，不需要任何参数' })

  let errorEvent: any = null
  manager.onEvent = (e) => {
    if (e.type === 'agent_error') errorEvent = e
  }

  await manager.start()
  assert.ok(errorEvent, '预期触发 agent_error 事件')
})

console.log(`\n🎉 测试完成：${passed} 通过，${failed} 失败\n`)
if (failed > 0) process.exit(1)
