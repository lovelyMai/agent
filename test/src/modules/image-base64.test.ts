import assert from 'node:assert/strict'

import { runTest } from './utils/run.ts'
import { createManager } from './services/manager.ts'

await runTest('base64 图片发送', async () => {
  const manager = createManager()
  manager.messages.push({
    role: 'user',
    content: [
      { type: 'text', text: '这张图片是什么颜色？只回答颜色' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        },
      },
    ],
  })

  let content = ''
  manager.onEvent = (e) => {
    if (e.type === 'message_update' && 'content' in e.text) {
      content += e.text.content ?? ''
    }
  }

  await manager.start()
  assert.ok(content.length > 0, '预期收到内容')
})
