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

await runTest('tool_choice: none 应阻止工具调用', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.config.tool_choice = 'none'
  manager.messages.push({ role: 'user', content: '调用 get_weather 工具查询北京天气' })

  let toolStarted = false
  manager.onEvent = (e) => {
    if (e.type === 'tool_start') toolStarted = true
  }

  await manager.start()
  assert.ok(!toolStarted, 'tool_choice 为 none 时不应触发工具调用')
})
