export function textureForPreset(record,preset){return record.textureSets.some(set=>set.id===preset)?preset:'';}
export function compatiblePresets(record,textureSet=''){
  return record.presets.filter(name=>textureForPreset(record,name)===textureSet && record.presetRecords?.find(p=>p.name===name)?.supported!==false);
}
export function resolvePartPreset(record,presetName,part,model,parameters,resolvePreset){
  if(!['hair','outfit'].includes(part))throw new Error('Unknown preset part');
  const preset=record.presetRecords?.find(p=>p.name===presetName && p.supported!==false);if(!preset)throw new Error('Unknown preset');
  const groups=new Set((model.display?.ParameterGroups || []).filter(g=>part==='hair'?/hair|ahoge|ponytail/i.test(g.Name):/^outfit$/i.test(g.Name)).map(g=>g.Id));
  const ids=new Set((model.display?.Parameters || []).filter(p=>groups.has(p.GroupId)).map(p=>p.Id));
  const defaults=Object.fromEntries(parameters.filter(p=>ids.has(p.id)).map(p=>[p.id,p.default ?? p.value]));
  if(!Object.keys(defaults).length)throw new Error('This model does not expose a compatible preset group');
  const resolved=resolvePreset(preset.parameters.filter(p=>ids.has(p.Id)),parameters);
  return {...defaults,...resolved};
}
