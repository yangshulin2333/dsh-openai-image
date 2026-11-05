// Shared output schema. Every optional field is either a primitive or an
// object with additionalProperties, never `null` — a null anywhere in the
// result makes the host reject the tool output as invalid.

export const imageOutput = {
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
