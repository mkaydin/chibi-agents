import test from 'node:test';import assert from 'node:assert/strict';
import {ActivityDirector,structuredActivity} from '../lib/activity-director.mjs';
import {normalizeAgents,HerdrAdapter} from '../lib/herdr.mjs';
test('completion is recognized after working even when idle is the only final status',()=>{
 const director=new ActivityDirector('a');assert.notEqual(director.update({status:'idle',completionSeq:12}).accent,'done');director.update({status:'working',completionSeq:null});
 assert.equal(director.update({status:'idle',completionSeq:13}).accent,'done');assert.equal(director.update({status:'idle',completionSeq:13}).accent,null);
 director.update({status:'working',completionSeq:null});assert.equal(director.update({status:'idle',completionSeq:14}).source,'herdr-completion');
 const first=new ActivityDirector();first.update({status:'working',completionSeq:null});assert.equal(first.update({status:'idle',completionSeq:1}).accent,'done');
});
test('metadata activity and periodic pulses do not override blocked state or spam every poll',()=>{
 let time=0;const director=new ActivityDirector('phase',()=>time),agent={status:'working',tokens:{companion_activity:'testing'}};
 assert.equal(director.update(agent).activity,'testing');for(let i=0;i<10;i++){time+=1000;assert.equal(director.update(agent).accent,null);}
 time+=30000;assert.equal(director.update(agent).source,'working-pulse');assert.equal(structuredActivity({...agent,status:'blocked'}),'blocked');
 assert.equal(structuredActivity({status:'working',stateLabels:{working:'Reading files'}}),'reading');
});
test('Herdr normalization retains bounded metadata and output hints stay scoped and throttled',()=>{
 const raw={agent:'codex',pane_id:'w1:p1',terminal_id:'terminal',agent_status:'working',completion_seq:3,state_labels:{working:'testing'},tokens:{companion_activity:'testing'}};
 const [agent]=normalizeAgents({agents:[raw]},'/socket');assert.equal(agent.completionSeq,3);assert.equal(agent.tokens.companion_activity,'testing');
 const adapter=new HerdrAdapter('/unused'),signals=[];adapter.agents=[agent];adapter.on('activity',s=>signals.push(s));
 adapter.outputHint({pane_id:'other',matched_line:'testing'});assert.equal(signals.length,0);
 adapter.outputHint({pane_id:agent.pane,matched_line:'Running tests'});adapter.outputHint({pane_id:agent.pane,matched_line:'Error: failed'});
 assert.deepEqual(signals,[{id:agent.id,activity:'testing',source:'terminal-inferred'}]);assert.ok(!('text' in signals[0]));
 adapter.outputCooldown.clear();agent.status='blocked';adapter.outputHint({pane_id:agent.pane,matched_line:'testing'});assert.equal(signals.length,1);
});
