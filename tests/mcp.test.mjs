import test from 'node:test';
import assert from 'node:assert/strict';
import { mcpResponse } from '../lib/mcp.mjs';
test('initialization and tool discovery work without a connected desktop', async () => {
  const initialized = await mcpResponse({ id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(initialized.result.protocolVersion, '2025-03-26');
  const listed = await mcpResponse({ id: 2, method: 'tools/list' });
  assert.equal(listed.result.tools.length, 5);
  assert.equal(await mcpResponse({ method: 'notifications/initialized' }), null);
});
test('tool errors remain structured MCP results and arbitrary arguments are rejected', async () => {
  const rejected = await mcpResponse({ id: 3, method: 'tools/call', params: { name: 'avatar_status', arguments: { pane: 'someone-else' } } }, () => { throw new Error('Must not invoke'); });
  assert.equal(rejected.result.isError, true); assert.match(rejected.result.content[0].text, /Unexpected argument/);
  const called = await mcpResponse({ id: 4, method: 'tools/call', params: { name: 'avatar_message', arguments: { text: 'Done' } } }, async (_tool, args) => ({ shown: args.text }));
  assert.equal(JSON.parse(called.result.content[0].text).shown, 'Done');
});
