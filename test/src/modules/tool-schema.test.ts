import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'

import { generateTools, type Tool } from '@/modules/modules/tool.ts'

const toParameters = (tool: Tool) => generateTools([tool]).toolDefinitions[0].function.parameters

await runTest('扁平属性的 required 提升为顶层数组', () => {
  const parameters = toParameters({
    name: 'get_weather',
    description: '获取天气',
    properties: {
      city: { type: 'string', description: '城市', required: true },
      unit: { type: 'string', description: '单位' },
    },
    function: () => null,
  })
  assert.deepEqual(parameters.required, ['city'])
  assert.deepEqual(parameters.properties.city, { type: 'string', description: '城市' })
  assert.deepEqual(parameters.properties.unit, { type: 'string', description: '单位' })
})

await runTest('嵌套 object 的 required 提升为内层数组', () => {
  const parameters = toParameters({
    name: 'search',
    description: '搜索',
    properties: {
      location: {
        type: 'object',
        description: '位置',
        required: true,
        properties: {
          city: { type: 'string', description: '城市', required: true },
          radius: { type: 'number', description: '半径' },
        },
      },
    },
    function: () => null,
  })
  assert.deepEqual(parameters.required, ['location'])
  assert.deepEqual(parameters.properties.location, {
    type: 'object',
    description: '位置',
    properties: {
      city: { type: 'string', description: '城市' },
      radius: { type: 'number', description: '半径' },
    },
    required: ['city'],
  })
})

await runTest('数组元素的 required 提升为元素内层数组', () => {
  const parameters = toParameters({
    name: 'nearby',
    description: '附近地点',
    properties: {
      spots: {
        type: 'array',
        description: '地点列表',
        required: true,
        items: {
          type: 'object',
          description: '地点',
          properties: { name: { type: 'string', description: '名称', required: true } },
        },
      },
    },
    function: () => null,
  })
  assert.deepEqual(parameters.properties.spots, {
    type: 'array',
    description: '地点列表',
    items: {
      type: 'object',
      description: '地点',
      properties: { name: { type: 'string', description: '名称' } },
      required: ['name'],
    },
  })
})

await runTest('多层嵌套逐层提升 required', () => {
  const parameters = toParameters({
    name: 'emit',
    description: '输出',
    properties: {
      first: {
        type: 'object',
        description: '第一层',
        required: true,
        properties: {
          second: {
            type: 'object',
            description: '第二层',
            properties: {
              unit: {
                type: 'string',
                description: '单位',
                enum: ['celsius', 'fahrenheit'],
                required: true,
              },
            },
          },
        },
      },
    },
    function: () => null,
  })
  assert.deepEqual(parameters.properties.first, {
    type: 'object',
    description: '第一层',
    properties: {
      second: {
        type: 'object',
        description: '第二层',
        properties: {
          unit: { type: 'string', description: '单位', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['unit'],
      },
    },
    required: [],
  })
})

await runTest('无子属性的 object 不产生多余字段', () => {
  const parameters = toParameters({
    name: 'raw',
    description: '原始',
    properties: { meta: { type: 'object', description: '元数据' } },
    function: () => null,
  })
  assert.deepEqual(parameters.properties.meta, { type: 'object', description: '元数据' })
})

await runTest('嵌套必填 schema 端到端调用', async () => {
  const manager = createManager()
  manager.updateTools([
    {
      name: 'search_nearby',
      description: '按位置搜索附近地点',
      properties: {
        location: {
          type: 'object',
          description: '搜索位置',
          required: true,
          properties: {
            city: { type: 'string', description: '城市名称', required: true },
            radius: { type: 'number', description: '搜索半径（米）' },
          },
        },
      },
      function: (args: any) => ({ ok: true, args }),
    },
  ])
  manager.messages.push({ role: 'user', content: '调用 search_nearby 搜索北京 5000 米内的地点' })

  const eventTypes: string[] = []
  manager.onEvent = (e) => eventTypes.push(e.type)

  await manager.start()
  assert.ok(eventTypes.includes('tool_start'), '预期触发 tool_start')
  assert.ok(eventTypes.includes('tool_end'), '预期触发 tool_end')
})

await runTest('数值约束透传为 minimum 和 maximum', () => {
  const parameters = toParameters({
    name: 'get_more_messages',
    description: '获取更多消息',
    properties: {
      before: {
        type: 'integer',
        description: '往前再取多少条',
        minimum: 0,
        maximum: 5,
        required: true,
      },
      radius: { type: 'number', description: '半径', minimum: 1.5 },
    },
    function: () => null,
  })
  assert.deepEqual(parameters.properties.before, {
    type: 'integer',
    description: '往前再取多少条',
    minimum: 0,
    maximum: 5,
  })
  assert.deepEqual(parameters.properties.radius, {
    type: 'number',
    description: '半径',
    minimum: 1.5,
  })
})

await runTest('嵌套结构的数值约束同样透传', () => {
  const parameters = toParameters({
    name: 'plan_route',
    description: '规划路线',
    properties: {
      stops: {
        type: 'array',
        description: '途经点',
        required: true,
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object',
          description: '途经点',
          properties: {
            stay: { type: 'integer', description: '停留分钟', minimum: 1, maximum: 120 },
          },
        },
      },
    },
    function: () => null,
  })
  assert.deepEqual(parameters.properties.stops, {
    type: 'array',
    description: '途经点',
    minItems: 1,
    maxItems: 5,
    items: {
      type: 'object',
      description: '途经点',
      properties: {
        stay: { type: 'integer', description: '停留分钟', minimum: 1, maximum: 120 },
      },
      required: [],
    },
  })
})
