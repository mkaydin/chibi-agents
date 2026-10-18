import test from 'node:test';import assert from 'node:assert/strict';
import {behaviorFromMessage,BehaviorLog} from '../lib/agent-behavior.mjs';
test('received activity selects bounded expression intents without executing message content',()=>{
 assert.equal(behaviorFromMessage('Building the package'),'working');assert.equal(behaviorFromMessage('Waiting for approval'),'blocked');
 assert.equal(behaviorFromMessage('All tests passed, 0 errors'),'done');assert.equal(behaviorFromMessage('Build failed with exception'),'error');assert.equal(behaviorFromMessage('Ordinary note'),null);
});
test('activity history is bounded, deduplicated and preserves plain text',()=>{
 const log=new BehaviorLog(2);log.add('message','<script>plain text</script>');log.add('message','<script>plain text</script>');assert.equal(log.entries.length,1);
 log.add('behavior','working','Loading');log.add('behavior','done','Star');assert.equal(log.entries.length,2);assert.equal(log.entries.at(-1).expression,'Star');log.clear();assert.equal(log.entries.length,0);
});
