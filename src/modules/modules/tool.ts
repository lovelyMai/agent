type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'

type JsonSchemaValue =
  | string
  | number
  | boolean
  | null
  | JsonSchemaValue[]
  | { [key: string]: JsonSchemaValue }

type Property = {
  type: JsonSchemaType
  description?: string
  required?: boolean
  items?: Property
  properties?: Record<string, Property>
  enum?: JsonSchemaValue[]
  minItems?: number
  maxItems?: number
}

export type Tool = {
  name: string
  description: string
  properties: Record<string, Property>
  function: (...args: any[]) => any
}

type JsonSchemaProperty = Omit<Property, 'required' | 'items' | 'properties'> & {
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, JsonSchemaProperty>
      required: string[]
    }
  }
}

const toSchema = ({ required, items, properties, ...rest }: Property): JsonSchemaProperty => ({
  ...rest,
  ...(items && { items: toSchema(items) }),
  ...(properties && {
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, toSchema(value)]),
    ),
    required: Object.keys(properties).filter((key) => properties[key].required),
  }),
})

export const generateTools = (tools: Tool[]) => {
  const toolDefinitions: ToolDefinition[] = tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.properties).map(([key, value]) => [key, toSchema(value)]),
        ),
        required: Object.keys(tool.properties).filter((key) => tool.properties[key].required),
      },
    },
  }))
  const toolExecutors: Record<string, Tool['function']> = {}
  for (const tool of tools) {
    toolExecutors[tool.name] = tool.function
  }
  return { toolDefinitions, toolExecutors }
}
