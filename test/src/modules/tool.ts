import type { Tool } from '@/index.ts'

export const tools: Tool[] = [
  {
    name: 'get_weather',
    description: '获取天气信息',
    properties: {
      city: { type: 'string', description: '城市名称', required: true },
      unit: { type: 'string', description: '温度单位', enum: ['celsius', 'fahrenheit'] },
    },
    function: (args: { city: string; unit?: string }) => {
      return { city: args.city, temp: 25, unit: args.unit ?? 'celsius' }
    },
  },
  {
    name: 'calculate',
    description: '数学计算',
    properties: {
      expression: { type: 'string', description: '数学表达式', required: true },
    },
    function: (args: { expression: string }) => {
      return eval(args.expression)
    },
  },
  {
    name: 'return_string',
    description: '返回字符串',
    properties: {
      value: { type: 'string', description: '要返回的值', required: true },
    },
    function: (args: { value: string }) => args.value,
  },
  {
    name: 'return_object',
    description: '返回对象',
    properties: {
      key: { type: 'string', description: '键名', required: true },
    },
    function: (args: { key: string }) => ({ [args.key]: 42 }),
  },
  {
    name: 'return_circular',
    description: '返回循环引用对象，用于测试序列化异常',
    properties: {},
    function: () => {
      const obj: any = { a: 1 }
      obj.self = obj
      return obj
    },
  },
]
