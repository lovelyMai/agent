type Property = {
  type: string
  description: string
  required?: boolean
  items?: { type: string }
  enum?: string[]
  minItems?: number
  maxItems?: number
}

export type Tool = {
  name: string
  description: string
  properties: Record<string, Property>
  function: (...args: any[]) => any
}

export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, Omit<Property, 'required'>>
      required: string[]
    }
  }
}

export const generateTools = (tools: Tool[]) => {
  const toolDefinitions: ToolDefinition[] = tools.map((tool) => {
    const cleanProperties = Object.fromEntries(
      Object.entries(tool.properties).map(([key, value]) => {
        const { required, ...rest } = value
        return [key, rest]
      }),
    )
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: cleanProperties,
          required: Object.keys(tool.properties).filter((key) => tool.properties[key].required),
        },
      },
    }
  })
  const toolExecutors: Record<string, Tool['function']> = {}
  for (const tool of tools) {
    toolExecutors[tool.name] = tool.function
  }
  return { toolDefinitions, toolExecutors }
}
