import test from 'node:test';
import assert from 'node:assert/strict';
import {colorFromParameters,parametersFromColor} from '../web/appearance-colors.js';
test('RGB controls map negative, fractional and byte domains without assuming identical ranges',()=>{
 const p=[{id:'R',min:-255,max:255,default:0},{id:'G',min:0,max:1,default:0},{id:'B',min:0,max:255,default:255}];
 assert.equal(colorFromParameters(p,{}),'#8000ff');
 assert.deepEqual(parametersFromColor(p,'#ff00ff'),{R:255,G:0,B:255});
 assert.deepEqual(parametersFromColor(p,'#000000'),{R:-255,G:0,B:0});
 assert.throws(()=>parametersFromColor(p,'red'),/Invalid/);
});
