import test from 'node:test';
import assert from 'node:assert/strict';
import { AppearanceHistory } from '../lib/appearance-history.mjs';
const value=n=>({values:{Hair:n},preset:''});
test('slider gestures undo in one step and redo branches are discarded by new edits',()=>{
 const history=new AppearanceHistory(value(0));
 history.commit(value(1),'drag');history.commit(value(2),'drag');history.commit(value(3),'drag');
 assert.deepEqual(history.undo(),value(0));assert.deepEqual(history.redo(),value(3));
 history.undo();history.commit(value(5),'new-drag');assert.equal(history.status.canRedo,false);
 assert.deepEqual(history.undo(),value(0));
});
test('save checkpoints and reverting do not lose undo history or leak mutable input',()=>{
 const history=new AppearanceHistory(value(0));const original=value(2);history.commit(original);original.values.Hair=99;
 assert.deepEqual(history.current,value(2));history.checkpoint();assert.equal(history.status.dirty,false);
 history.commit(value(4));history.revert();assert.deepEqual(history.current,value(2));assert.equal(history.status.dirty,false);
 assert.deepEqual(history.undo(),value(4));history.reset(value(8));assert.equal(history.status.canUndo,false);
});
