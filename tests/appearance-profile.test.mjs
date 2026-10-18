import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreset, validateAppearance } from '../lib/appearance-profile.mjs';
const parameters = [{id:'Hair',min:0,max:10,default:2,value:9},{id:'Color',min:-255,max:255,default:20,value:20}];
test('preset offsets use rig defaults, retain fractions and do not accumulate across selections',()=> {
 const a=[{Id:'Hair',Value:1.5,Blend:'Add'}], b=[{Id:'Color',Value:-51,Blend:'Add'}];
 assert.deepEqual(resolvePreset(a,parameters),{Hair:3.5});
 assert.deepEqual(resolvePreset(b,parameters),{Color:-31});
 assert.deepEqual(resolvePreset(a,parameters),{Hair:3.5});
 assert.deepEqual(resolvePreset([{Id:'Hair',Value:100,Blend:'Overwrite'}],parameters),{Hair:10});
 assert.deepEqual(resolvePreset([{Id:'Hair',Value:2,Blend:'Multiply'}],parameters),{Hair:4});
});
test('rejects unknown parameters, nonfinite values and VTube-specific blends',()=> {
 assert.throws(()=>resolvePreset([{Id:'Hair',Value:1,Blend:'VTS_Add'}],parameters),/Unsupported/);
 assert.throws(()=>validateAppearance({Unknown:2},parameters),/Invalid/);
 assert.throws(()=>validateAppearance({Hair:Infinity},parameters),/Invalid/);
 assert.deepEqual(validateAppearance({Hair:-2},parameters),{Hair:0});
});
