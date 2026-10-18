export const tools = [
  { name: 'avatar_capabilities', description: 'Get your own desktop avatar actions, expression names and motions.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'avatar_animate', description: 'Animate your own avatar temporarily, then return to its current agent state.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['celebrate', 'greet', 'sad', 'working', 'thinking', 'reading', 'searching', 'editing', 'testing', 'running', 'done', 'error', 'blocked', 'idle'] }, duration_ms: { type: 'number', minimum: 200, maximum: 15000 } }, required: ['action'], additionalProperties: false } },
  { name: 'avatar_message', description: 'Display a short public message above your own desktop avatar.', inputSchema: { type: 'object', properties: { text: { type: 'string', maxLength: 500 }, duration_ms: { type: 'number', minimum: 200, maximum: 15000 } }, required: ['text'], additionalProperties: false } },
  { name: 'avatar_reset', description: 'Clear temporary animations and return your avatar to its current agent state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'avatar_status', description: 'Get your own avatar model and current Herdr state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];

export async function mcpResponse(request, invoke) {
  if (request.id === undefined) return null;
  const reply = result => ({ jsonrpc: '2.0', id: request.id, result });
  if (request.method === 'initialize') return reply({ protocolVersion: ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'].includes(request.params?.protocolVersion) ? request.params.protocolVersion : '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'ayla-companions', version: '0.2.0' } });
  if (request.method === 'ping') return reply({});
  if (request.method === 'tools/list') return reply({ tools });
  if (request.method === 'tools/call') {
    try {
      const tool = tools.find(item => item.name === request.params?.name); if (!tool) throw new Error('Unknown avatar tool');
      const args = request.params.arguments || {}; if (typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object');
      for (const key of Object.keys(args)) if (!Object.hasOwn(tool.inputSchema.properties, key)) throw new Error(`Unexpected argument: ${key}`);
      for (const key of tool.inputSchema.required || []) if (!Object.hasOwn(args,key)) throw new Error(`Missing argument: ${key}`);
      if (args.duration_ms !== undefined && (!Number.isFinite(args.duration_ms) || args.duration_ms < 200 || args.duration_ms > 15000)) throw new Error('Duration must be 200–15000 ms');
      if (args.action !== undefined && !tool.inputSchema.properties.action?.enum.includes(args.action)) throw new Error('Unsupported semantic action');
      if (args.text !== undefined && (typeof args.text !== 'string' || args.text.length > 500)) throw new Error('Message must be at most 500 characters');
      const result = await invoke(tool.name, args);
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (error) { return reply({ isError: true, content: [{ type: 'text', text: error.message }] }); }
  }
  return { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } };
}
