import {lifeSettings} from '../web/life-controller.js';
export function appearanceKey(preferences={}) {
  return JSON.stringify([preferences.modelPath || '',Object.entries(preferences.appearance || {}).sort(([a],[b])=>a.localeCompare(b)),preferences.appearancePreset || '']);
}
export function migrateSettings(input={}) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Invalid settings document');
  const settings=structuredClone(input);
  if(!Array.isArray(settings.characters))settings.characters=[];
  if(!Array.isArray(settings.packages))settings.packages=[];
  settings.schemaVersion=1;return settings;
}
export function validateCharacterDocument(input) {
  if(input?.schemaVersion!==1 || typeof input.name!=='string' || !input.name.trim() || input.name.length>80)throw new Error('Invalid character document');
  const p=input.preferences;if(!p || typeof p.modelPath!=='string' || !p.appearance || typeof p.appearance!=='object' || Array.isArray(p.appearance) || Object.keys(p.appearance).length>2048 || Object.values(p.appearance).some(v=>!Number.isFinite(v)))throw new Error('Invalid character appearance');
  return {name:input.name.trim(),preferences:{modelPath:p.modelPath,appearance:p.appearance,appearancePreset:typeof p.appearancePreset==='string'?p.appearancePreset:'',sourceAsset:p.sourceAsset,life:p.life?lifeSettings(p.life):undefined,accessories:p.accessories?.glasses===undefined?{}:{glasses:p.accessories.glasses===true}}};
}
