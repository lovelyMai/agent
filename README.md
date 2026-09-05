# @lovelymai/agent

一个纯净、极简、易于使用的 Agent 框架。

## 第一步：安装依赖

```bash
npm install @lovelymai/agent openai
```

`openai` 是 peer dependency，需要在项目中自行安装。

## 第二步：创建 Agent 实例

```typescript
import OpenAI from 'openai'
import { createAgentManager } from '@lovelymai/agent'

const client = new OpenAI()
const agent = createAgentManager(client)
```

## 第三步：配置模型与消息

```typescript
agent.config = { model: 'deepseek-v4-flash', thinking: { type: 'disabled' } }
agent.messages.push({ role: 'user', content: '你好' })
```

## 第四步：注册工具（可选）

定义工具并在 Agent 中注册，Agent 会在对话中自动调用：

```typescript
agent.updateTools([
  {
    name: 'get_weather',
    description: '查询指定城市的天气',
    properties: {
      city: { type: 'string', description: '城市名称', required: true },
    },
    function: async ({ city }) => {
      return `${city}今天晴，25°C`
    },
  },
])
```

## 第五步：监听事件

通过 `onEvent` 回调获取 Agent 运行过程中的各种事件：

```typescript
agent.onEvent = (event) => {
  if (event.type === 'message_update' && 'content' in event.text) {
    process.stdout.write(event.text.content ?? '')
  }
}
```

支持的事件类型：

| 事件             | 说明                                                |
| ---------------- | --------------------------------------------------- |
| `agent_start`    | Agent 开始运行                                      |
| `turn_start`     | 每轮对话开始                                       |
| `message_update` | 流式输出更新                                       |
| `tool_start`     | 工具开始执行                                        |
| `tool_end`       | 工具执行完成                                        |
| `agent_end`      | Agent 运行结束                                      |
| `agent_error`    | Agent 运行出错                                      |

## 第六步：启动与停止

```typescript
// 启动
await agent.start()

// 手动停止
agent.stop()
```
