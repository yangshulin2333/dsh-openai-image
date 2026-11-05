// Shared output schema. Every optional field is either a primitive or an
// object with additionalProperties, never `null` — a null anywhere in the
// result makes the host reject the tool output as invalid.
//
// `defineTool` always installs a render wrapper that calls `output.render`, so
// every tool must provide one or the host throws
// "output.render failed: userRender is not a function" on the first result.
// The render result must be a content-block array (`[{ type: 'text', text }]`),
// not a bare string: the host calls `content.some(...)` on it.

const renderImage = (args, value) => [
  { type: 'text', text: (typeof value?.summary === 'string' && value.summary) || 'image' },
]

export const imageOutput = {
  render: renderImage,
  schema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      summary: { type: 'string' },
      action: { type: 'string' },
      model: { type: 'string' },
      size: { type: 'string' },
      quality: { type: 'string' },
      preset: { type: 'string' },
      count: { type: 'integer' },
      duration_ms: { type: 'integer' },
      path: { type: 'string' },
      prompt: { type: 'string' },
      revised_prompt: { type: 'string' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            path: { type: 'string' },
            bytes: { type: 'integer' },
            format: { type: 'string' },
          },
        },
      },
    },
  },
}

export const uploadOutput = {
  render: renderImage,
  schema: {
    type: 'object',
    additionalProperties: true,
    properties: {
      summary: { type: 'string' },
      action: { type: 'string' },
      needs_confirmation: { type: 'boolean' },
      path: { type: 'string' },
      asset_id: { type: 'string' },
      rbxassetid: { type: 'string' },
      asset_type: { type: 'string' },
      moderation_state: { type: 'string' },
      display_name: { type: 'string' },
      duration_ms: { type: 'integer' },
      luau: { type: 'string' },
    },
  },
}
