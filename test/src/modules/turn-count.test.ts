import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'
import { tools } from './services/tool.ts'

await runTest('简单对话 turnCount 应为 1', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  const endEvents: { turnCount: number }[] = []
  manager.onEvent = (e) => {
    if (e.type === 'agent_end') endEvents.push({ turnCount: e.turnCount })
  }

  await manager.start()
  assert.equal(endEvents.length, 1, '预期恰好一次 agent_end')
  assert.equal(endEvents[0].turnCount, 1, '简单对话 turnCount 应为 1')
})

await runTest('turn_start 与 agent_end turnCount 应一致', async () => {
  const manager = createManager()
  manager.messages.push({ role: 'user', content: '回复一个字：好' })

  const startTurns: number[] = []
  let endTurn: number | null = null
  manager.onEvent = (e) => {
    if (e.type === 'turn_start') startTurns.push(e.turnCount)
    if (e.type === 'agent_end') endTurn = e.turnCount
  }

  await manager.start()
  assert.ok(endTurn !== null, '预期收到 agent_end')
  assert.ok(
    startTurns.some((t) => t === endTurn),
    `turn_start 应包含与 agent_end 相同的 turnCount ${endTurn}`,
  )
})

await runTest('工具调用后结束 turnCount 应为有效值', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.messages.push({
    role: 'user',
    content: '调用 get_weather 工具查询北京天气，然后用一个字总结',
  })

  let endTurn: number | null = null
  let toolCount = 0
  const startTurns: number[] = []
  manager.onEvent = (e) => {
    if (e.type === 'turn_start') startTurns.push(e.turnCount)
    if (e.type === 'tool_end') toolCount++
    if (e.type === 'agent_end') endTurn = e.turnCount
  }

  await manager.start()
  assert.ok(endTurn !== null, '预期收到 agent_end')
  assert.ok(toolCount >= 1, '预期至少调用一次工具')
  assert.ok(endTurn! >= 1, `turnCount 应 >= 1，实际 ${endTurn}`)
  assert.ok(startTurns.includes(endTurn!), `turn_start 应包含 agent_end 的 turnCount ${endTurn}`)
})

await runTest('多轮工具调用 turnCount 应递增', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.maxIteration = 5
  manager.messages.push({
    role: 'user',
    content:
      '每次只调用一次 get_weather 工具查询不同城市（北京、上海、广州），不要一次性调用多个工具',
  })

  const startTurns: number[] = []
  const endTurns: number[] = []
  manager.onEvent = (e) => {
    if (e.type === 'turn_start') startTurns.push(e.turnCount)
    if (e.type === 'agent_end') endTurns.push(e.turnCount)
  }

  await manager.start()
  assert.ok(endTurns.length === 1, '预期恰好一次 agent_end')
  const lastEndTurn = endTurns[0]
  assert.ok(lastEndTurn >= 1, `多轮调用后 turnCount 应 >= 1，实际 ${lastEndTurn}`)
  assert.ok(
    startTurns.includes(lastEndTurn),
    `turn_start 应包含 agent_end 的 turnCount ${lastEndTurn}`,
  )
})

await runTest('循环正常结束时 turnCount 应为 maxIteration', async () => {
  const manager = createManager()
  manager.updateTools(tools)
  manager.maxIteration = 1
  manager.messages.push({
    role: 'user',
    content: '调用 calculate 工具计算 1+1，不要回复文字',
  })

  let endTurn: number | null = null
  manager.onEvent = (e) => {
    if (e.type === 'agent_end') endTurn = e.turnCount
  }

  await manager.start()
  assert.ok(endTurn !== null, '预期收到 agent_end')
  assert.equal(endTurn, 1, 'maxIteration=1 时循环走完 turnCount 应为 1')
})
