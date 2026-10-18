import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceKey,migrateSettings,validateCharacterDocument} from '../lib/draft-record.mjs';
test('draft comparison ignores slider insertion order but detects model and appearance changes',()=>{
 assert.equal(appearanceKey({modelPath:'a',appearance:{A:1,B:2}}),appearanceKey({modelPath:'a',appearance:{B:2,A:1}}));
 assert.notEqual(appearanceKey({modelPath:'a'}),appearanceKey({modelPath:'b'}));
 const old={modelPath:'local',assignments:{agent:{scale:2}}};const next=migrateSettings(old);assert.equal(next.schemaVersion,1);assert.deepEqual(next.assignments,old.assignments);assert.equal(old.schemaVersion,undefined);
});
test('settings-only imports reject unbounded, nonfinite or executable-shaped values',()=>{
 const valid={schemaVersion:1,name:'Chibi',preferences:{modelPath:'/local/Rig.model3.json',appearance:{Hair:1.5}}};
 assert.equal(validateCharacterDocument(valid).name,'Chibi');
 assert.throws(()=>validateCharacterDocument({...valid,preferences:{...valid.preferences,appearance:{Hair:'code'}}}),/Invalid/);
 assert.throws(()=>validateCharacterDocument({...valid,schemaVersion:99}),/Invalid/);
});
