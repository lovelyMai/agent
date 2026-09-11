import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import { tools } from './services/tool.ts'

await runTest('tool_choice 默认值应为 auto', async () => {
  const manager = createManager()
  assert.equal(manager.config.tool_choice, 'auto', 'tool_choice 默认值应为 auto')
})

await runTest('tool_choice: required 应强制工具调用', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.config.tool_choice = 'required'
  manager.messages.push({ role: 'user', content: '北京今天天气怎么样？' })

  let toolStarted = false
  manager.onEvent = (e) => {
    if (e.type === 'tool_start') toolStarted = true
  }

  await manager.start()
  assert.ok(toolStarted, 'tool_choice 为 required 时必须触发工具调用')
})

await runTest('tool_choice: auto 应由模型自主决定', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.config.tool_choice = 'auto'
  manager.messages.push({ role: 'user', content: '调用 get_weather 工具查询北京天气' })

  let toolStarted = false
  manager.onEvent = (e) => {
    if (e.type === 'tool_start') toolStarted = true
  }

  await manager.start()
  assert.ok(toolStarted, 'tool_choice 为 auto 时模型应自主决定调用工具')
})

await runTest('tool_choice 为工具名应强制调用指定工具', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.config.tool_choice = 'get_weather'
  manager.messages.push({ role: 'user', content: '北京今天天气怎么样' })

  let toolName = ''
  manager.onEvent = (e) => {
    if (e.type === 'tool_start') toolName = e.toolCall.function.name
  }

  await manager.start()
  assert.equal(toolName, 'get_weather', 'tool_choice 为工具名时应强制调用指定工具')
})

await runTest('tool_choice 为工具名时模型调用其他工具应报错', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.config.tool_choice = 'get_weather'
  manager.messages.push({
    role: 'user',
    content: '不要调用 get_weather，请用 calculate 工具计算 1+1 的结果',
  })

  let toolStarted = false
  let agentError: any
  manager.onEvent = (e) => {
    if (e.type === 'tool_start') toolStarted = true
    if (e.type === 'agent_error') agentError = e.error
  }

  await manager.start()
  assert.ok(!toolStarted, '不应执行非指定工具')
  assert.ok(agentError, '模型调用非指定工具时应触发 agent_error')
})

await runTest('tool_choice: none 时模型违规返回工具调用应报错', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.config.tool_choice = 'none'
  manager.messages.push({ role: 'user', content: '调用 get_weather 工具查询北京天气' })

  let toolStarted = false
  let agentError: any
  manager.onEvent = (e) => {
    if (e.type === 'tool_start') toolStarted = true
    if (e.type === 'agent_error') agentError = e.error
  }

  await manager.start()
  assert.ok(!toolStarted, 'tool_choice 为 none 时不应触发工具调用')
  assert.ok(agentError, '模型违规返回工具调用时应触发 agent_error')
})
