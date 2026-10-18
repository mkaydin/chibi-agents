import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAgents } from '../lib/herdr.mjs';
import { Bindings } from '../lib/gateway.mjs';
test('root agent identities include terminal and session occupant, excluding plain shells', () => {
  const agent = { pane_id: 'w1:p2', terminal_id: 't1', agent: 'codex', agent_status: 'working', agent_session: { value: 'session1' } };
  const first = normalizeAgents({ agents: [agent, { ...agent, agent: null }] }, '/socket');
  assert.equal(first.length, 1); assert.equal(first[0].status, 'working');
  const second = normalizeAgents({ agents: [{ ...agent, agent_session: { value: 'session2' } }] }, '/socket');
  assert.notEqual(first[0].id, second[0].id);
  const bindings = new Bindings(), token = bindings.register(first[0]);
  assert.equal(bindings.resolve(token, first).pane, 'w1:p2');
  assert.throws(() => bindings.resolve(token, second), /expired/);
});
test('a client cannot select another agent with its existing token', () => {
  const bindings = new Bindings(); const token = bindings.register({ id: 'agent-a' });
  assert.throws(() => bindings.resolve(token, [{ id: 'agent-b' }]), /expired/);
});
