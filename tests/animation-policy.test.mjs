import test from 'node:test';
import assert from 'node:assert/strict';
import { expressionFor, CommandLease } from '../lib/animation-policy.mjs';
test('maps only capabilities that exist and honors explicit no-expression mapping', () => {
  const expressions = [{ name: 'Loading' }, { name: 'Question' }, { name: 'Happy' }];
  assert.equal(expressionFor('blocked', expressions), 'Question');
  assert.equal(expressionFor('working', expressions), 'Loading');
  assert.equal(expressionFor('working', expressions, { working: '__none__' }), null);
  assert.equal(expressionFor('sad', expressions), null);
});
test('an override expires into the latest state rather than its starting state', () => {
  const applied = []; let callback;
  const lease = new CommandLease(x => applied.push(x), { setTimeout: cb => { callback = cb; return 1; }, clearTimeout: () => {} });
  lease.state('working'); lease.override('celebrate', 2000); lease.state('blocked');
  assert.deepEqual(applied, ['working', 'celebrate']); callback();
  assert.deepEqual(applied, ['working', 'celebrate', 'blocked']);
  assert.throws(() => lease.override('celebrate', 20000), /Duration/);
});
test('chibi completion reactions exclude appearance presets and unsupported VTube expressions',()=>{
 const expressions=[{name:'Star',kind:'reaction',supported:true},{name:'Happy',kind:'appearance',supported:true},{name:'Joy',kind:'reaction',supported:false}];
 assert.equal(expressionFor('done',expressions),'Star');assert.equal(expressionFor('celebrate',expressions),'Star');
 assert.equal(expressionFor('idle',expressions),null);
 assert.equal(expressionFor('working',expressions,{working:'Happy'}),null);
});
