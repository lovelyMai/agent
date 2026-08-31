import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import { tools } from './services/tool.ts'

await runTest('start 前调用 stop 不会阻止执行', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  manager.stop()

  let agentStarted = false
  manager.onEvent = (e) => {
    if (e.type === 'agent_start') agentStarted = true
  }

  await manager.start()
  assert.ok(agentStarted, 'start 仍会触发 agent_start')
  assert.ok(manager.messages.length > 0, 'start 会正常执行并产生消息')
})

await runTest('streaming 期间调用 stop 应终止', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  let ended = false
  manager.onEvent = (e) => {
    if (e.type === 'message_update') manager.stop()
    if (e.type === 'agent_end') ended = true
  }

  await manager.start()
  assert.ok(ended, '预期触发 agent_end')
})

await runTest('工具调用后调用 stop 不应继续下一轮', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 get_weather 工具查询北京天气' })

  let endTurn: number | null = null
  let turnCount = 0
  manager.onEvent = (e) => {
    if (e.type === 'turn_start') turnCount++
    if (e.type === 'tool_end') manager.stop()
    if (e.type === 'agent_end') endTurn = e.turnCount
  }

  await manager.start()
  assert.ok(endTurn !== null, '预期收到 agent_end')
  assert.equal(turnCount, 1, 'stop 后不应有第二轮 turn_start')
})

await runTest('stop 后不应触发 message_update', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.messages.push({ role: 'user', content: '调用 get_weather 工具查询北京天气' })

  let afterStop = false
  manager.onEvent = (e) => {
    if (e.type === 'tool_end') manager.stop()
    if (e.type === 'message_update' && afterStop) {
      throw new Error('stop 后仍触发了 message_update')
    }
    if (e.type === 'agent_end') afterStop = true
  }

  await manager.start()
})

await runTest('多次调用 stop 不应报错', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  let ended = false
  manager.onEvent = (e) => {
    if (e.type === 'message_update') {
      manager.stop()
      manager.stop()
      manager.stop()
    }
    if (e.type === 'agent_end') ended = true
  }

  await manager.start()
  assert.ok(ended, '预期触发 agent_end')
})
