import test from 'node:test';import assert from 'node:assert/strict';import {propThemeValues} from '../web/prop-themes.js';import {lifeSettings} from '../web/life-controller.js';
test('themes respect actual Core bounds, target colors only and restore original cleanly',()=>{
 const p=[{id:'ParamKeyboardColorR',min:0,max:255},{id:'C_LoadingG',min:-1,max:1},{id:'ParamHairFront',min:0,max:8}];
 const v=propThemeValues('mint',p);assert.equal(v.ParamKeyboardColorR,.35*255);assert.equal(v.C_LoadingG,-1+2*.86);assert.equal(v.ParamHairFront,undefined);assert.deepEqual(propThemeValues('original',p),{});assert.deepEqual(propThemeValues('amber',[]),{});
 assert.equal(lifeSettings({propTheme:'mint'}).propTheme,'mint');assert.throws(()=>lifeSettings({propTheme:'unknown'}),/theme/);
});
