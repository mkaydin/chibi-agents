import {colorFromParameters,parametersFromColor} from './appearance-colors.js';
const api = window.companion;
const $ = id => document.getElementById(id);
let pendingAppearance=null,appearanceFrame=null,appearanceFlush=Promise.resolve();
let state, shownId, libraryKey, activeView = 'characters', viewportScheduled = false, editSerial = 0;
const linkedAppearance=new Set();
const send = async command => { try { if(command.type!=='appearance')await flushAppearance();await api.command(command); } catch (error) { $('error').textContent = error.message; $('studio-error').textContent = error.message; } };
function options(select, entries, label) {
  select.replaceChildren();
  if (!entries.length) { const option = document.createElement('option'); option.textContent = 'No animations available'; select.append(option); }
  entries.forEach((item, index) => { const option = document.createElement('option'); option.value = index; option.textContent = label(item)+(item.supported===false?' (incompatible)':'');option.disabled=item.supported===false; select.append(option); });
}
function parameterControls(list) {
  $('parameters').replaceChildren();
  for (const p of list) {
    const label = document.createElement('label'); label.dataset.id = p.id.toLowerCase(); label.textContent = p.id;
    const output = document.createElement('output'); output.textContent = Number(p.value).toFixed(2);
    const input = document.createElement('input'); input.type = 'range'; input.min = p.min; input.max = p.max; input.step = (p.max - p.min) / 200 || .01; input.value = p.value;
    input.addEventListener('input', () => { output.textContent = Number(input.value).toFixed(2); void send({ type: 'parameter', id: p.id, value: Number(input.value) }); });
    label.append(output, input); $('parameters').append(label);
  }
}
function render(next) {
  state = next;
  $('app-mark').hidden=!next.hasAppIcon;
  $('connection-badge').textContent=next.herdr?.connected?`${next.agentCount} agents connected`:'Herdr offline';$('connection-badge').dataset.connected=Boolean(next.herdr?.connected);
  $('selected-project').textContent=next.selectedId==='studio'?'Studio preview':(next.project || next.label || 'Companion');
  $('selected-detail').textContent=next.selectedId==='studio'?(activeView==='agents'?'Choose a project companion below to adjust its desktop placement.':activeView==='settings'?'Manage connections, model runtime, and rendering preferences.':'Create looks without changing your desktop agents'):[next.agentKind,next.pane,next.activity || next.agentStatus].filter(Boolean).join(' · ');
  $('position-status').textContent=next.embedded?'Desktop positions are remembered for each agent.':next.windowPosition?`Position remembered · ${next.windowPosition.x}, ${next.windowPosition.y}`:'Drag your character to save its desktop position.';
  const targetList = next.targets || [];
  const optionsKey = JSON.stringify(targetList);
  if ($('target').dataset.options !== optionsKey) { $('target').replaceChildren(); for (const target of targetList) { const option = document.createElement('option'); option.value = target.id; option.textContent = [target.project || target.label,target.kind,target.status].filter(Boolean).join(' · '); $('target').append(option); } $('target').dataset.options = optionsKey; }
  $('target').value = next.selectedId;
  $('topmost-status').textContent=next.topmostStatus?.error || (next.topmostStatus?.backend==='kwin' && next.topmostStatus.active?'KDE keep-above helper loaded':next.topmostStatus?.backend==='wayland'?'Native Wayland requires KDE keep-above support.':'');
  if (document.activeElement !== $('herdr-socket')) $('herdr-socket').value = next.herdr?.path || '';
  $('herdr-status').textContent = next.herdr?.connected ? `${next.agentCount} recognized agents · one character per agent` : `Disconnected: ${next.herdr?.error || 'not connected'}`;
  $('recovered-draft').hidden=!next.recoveredDraft;
  $('library-task').textContent=next.libraryTask?`${next.libraryTask.message} · ${next.libraryTask.done}/${next.libraryTask.total}`:'';
  $('cancel-thumbnails').hidden=!next.libraryTask;
  $('preview-background').value=next.previewBackground || 'solid';$('preview-surface').dataset.background=next.previewBackground || 'solid';$('preview-surface').querySelector('p').hidden=Boolean(next.previewLoaded && next.embeddedPreview);
  $('texture-quality').value=next.preferences?.textureLimit || 4096;$('default-fps').value=next.preferences?.fps || 30;
  $('graphics-info').textContent=next.graphics?`${next.graphics.renderer} · max atlas ${next.graphics.maxTextureSize}`:`Graphics mode: ${next.graphicsMode || 'nvidia'}`;
  renderAgentCards(next);renderBehaviors(next);renderCompatibleParts(next);
  $('undo-appearance').disabled=!next.canUndo;$('redo-appearance').disabled=!next.canRedo;$('revert-appearance').disabled=!next.dirty;
  $('dirty-state').textContent=next.dirty?'Modified':'Saved';
  $('preview-help').textContent=next.embeddedPreview ? (next.selectedId==='studio'?'Editing the studio preview. Save a character, then assign it to an agent.':'The preview shows the studio character. Current controls affect the selected agent.') : 'Desktop preview mode is enabled.';
  $('preview-zoom').disabled=next.selectedId!=='studio';if(next.selectedId==='studio')$('preview-zoom').value=next.scale || 1;
  scheduleViewport();
  $('status').textContent = next.status; $('studio-error').textContent = next.error || ''; renderLibrary(next);
  $('error').textContent = next.error || '';
  $('runtime').textContent = next.runtimeAvailable ? 'Change runtime' : 'Choose Cubism Core';
  const displayedSize=next.embedded?next.scale:(next.windowSize?.width || 520)/520;$('scale').value=displayedSize;$('scale-value').textContent=`${Math.round(displayedSize*100)}%`;
  $('fps').value = next.fps; $('topmost').checked = next.alwaysOnTop; $('click-through').checked = next.clickThrough;
  $('click-through').disabled = next.embedded || !next.clickThroughSupported;
  for(const id of ['visibility','center','topmost'])$(id).disabled=Boolean(next.embedded);
  $('click-through').title = next.clickThroughSupported ? 'Pass all clicks to the desktop underneath' : `Unsupported by Electron ${next.electronVersion} on Wayland`;
  $('visibility').textContent = next.visible ? 'Hide avatar' : 'Show avatar';
  $('animation').textContent = next.animation || '';
  if (shownId !== next.model?.id) {
    shownId = next.model?.id;
    $('idle-motion').replaceChildren();for(const item of [{value:'__auto__',name:'Automatic normal/sleep idle'},{value:'__none__',name:'Disable automatic idle'},...(next.model?.motions || []).filter(m=>!m.recovered).map(m=>({value:`${m.group}:${m.index}`,name:m.name}))]){const option=document.createElement('option');option.value=item.value;option.textContent=item.name;$('idle-motion').append(option);}
    options($('motion'), next.model?.motions || [], item => `${item.group} · ${item.name}`);
    options($('preset'), (next.model?.expressions || []).filter(e => e.kind === 'appearance' && e.supported !== false), item => item.name);
    options($('expression'), (next.model?.expressions || []).filter(e => e.kind !== 'appearance' && e.supported !== false), item => item.name);
    parameterControls(next.parameters || []); appearanceControls(next);
  }
  for (const input of $('appearance-controls').querySelectorAll('input[data-parameter]')) {
    if (document.activeElement === input) continue;
    const p = next.parameters.find(p => p.id === input.dataset.parameter);
    input.value = next.appearance?.[p.id] ?? p.default ?? p.value;
    const row=input.closest('[data-search]');if(row){row.querySelector('output').textContent=Number(input.value).toFixed(2);const numeric=row.querySelector('input[type=number]');if(document.activeElement!==numeric)numeric.value=Number(input.value).toFixed(3);}
  }
  for(const picker of $('appearance-controls').querySelectorAll('input[data-color-ids]')) {
    if(document.activeElement===picker)continue;
    const parameters=JSON.parse(picker.dataset.colorIds).map(id=>next.parameters.find(p=>p.id===id));
    picker.value=colorFromParameters(parameters,next.appearance || {});
  }
  $('play').disabled = !next.model?.motions.length; $('apply').disabled = !(next.model?.expressions || []).some(e=>e.kind!=='appearance'&&e.supported!==false);
  $('reset').disabled = !next.model;
  $('idle-motion').value=next.idleMotion || '__auto__';
  for(const input of $('appearance-controls').querySelectorAll('input'))input.disabled=Boolean(next.loading || next.libraryTask);
  $('save-character').disabled=!next.model || next.loading || Boolean(next.libraryTask);$('apply-preset').disabled=!next.model || next.loading || Boolean(next.libraryTask);$('save-workspace').disabled=!next.model || next.loading || Boolean(next.libraryTask);
  $('life-hover').checked=next.life?.hoverNotice!==false;
  $('life-temperament').value=next.life?.temperament || 'relaxed';$('life-cursor').checked=Boolean(next.life?.noticeCursor);
  $('infer-activity').checked=next.inferActivity!==false;
  $('prop-theme').value=next.life?.propTheme || 'original';
  $('prop-mode').value=next.life?.poseMode || 'auto';
  $('life-mode').value=next.life?.mode || 'calm';$('life-blink').checked=next.life?.blink!==false;$('life-look').checked=next.life?.lookAround!==false;
  $('life-head').checked=next.life?.head!==false;$('life-breath').checked=next.life?.breathing!==false;$('life-rest').checked=Boolean(next.life?.rest);$('life-rest-delay').value=next.life?.restAfter || 300;
  $('glasses-option').hidden=!(next.model?.expressions || []).some(e=>e.name==='Glasses'&&e.supported);$('accessory-glasses').checked=Boolean(next.accessories?.glasses);
  $('automatic').checked = Boolean(next.automatic);
  const mappingKey = JSON.stringify([next.selectedId, next.model?.id, next.mappings]);
  if ($('mappings').dataset.key !== mappingKey) {
    $('mappings').replaceChildren();
    for (const phase of ['working','thinking','reading','searching','editing','testing','running','blocked','done','error','idle','disconnected']) {
      const label = document.createElement('label'); label.textContent = phase;
      const select = document.createElement('select'); select.className = 'wide';
      for (const [value, text] of [['', 'Default gesture & expression'], ['__none__', 'Gesture only'], ...((next.model?.expressions || []).filter(e => e.kind !== 'appearance' && e.supported !== false)).map(e => [e.name, e.name])]) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
      select.value = next.mappings?.[phase] || ''; select.onchange = () => api.configure({ mappings: { [phase]: select.value || '__auto__' } }).catch(error => { $('error').textContent = error.message; });
      label.append(select); $('mappings').append(label);
    }
    $('mappings').dataset.key = mappingKey;
  }
}
$('runtime').onclick = async () => { const result = await api.selectRuntime(); if (result.error) $('error').textContent = result.error; };
$('import').onclick = async () => { const result = await guardNavigation()?await api.selectModel():{canceled:true}; if (result.error) $('error').textContent = result.error; };
$('play').onclick = () => { const motion = state.model.motions[Number($('motion').value)]; void send({ type: 'motion', group: motion.group, index: motion.index }); };
$('apply').onclick = () => void send({ type: 'expression', name: state.model.expressions.filter(e => e.kind !== 'appearance' && e.supported !== false)[Number($('expression').value)].name });
$('reset').onclick = () => void send({ type: 'reset' });
$('scale').oninput=()=>{const ratio=Number($('scale').value);void send(state.embedded?{type:'scale',value:ratio}:{type:'resize-window',width:520*ratio,height:720*ratio});};
$('fps').onchange = () => void send({ type: 'fps', value: Number($('fps').value) });
$('topmost').onchange = () => void send({ type: 'topmost', value: $('topmost').checked });
$('click-through').onchange = () => void send({ type: 'click-through', value: $('click-through').checked });
$('visibility').onclick = () => void send({ type: 'visibility', value: !state.visible });
$('center').onclick = () => void send({ type: 'center' });
$('clear-parameters').onclick = () => { void send({ type: 'clear-parameters' }); parameterControls(state.parameters); };
$('search').oninput = () => { for (const label of $('parameters').children) label.hidden = !label.dataset.id.includes($('search').value.toLowerCase()); };
api.onEvent(event => { if (event.type === 'state') render(event.state); if (event.type === 'animation') $('animation').textContent = event.text; });
render(await api.state());
$('target').onchange=async()=>{const id=$('target').value;if(await guardNavigation())await api.selectTarget(id);else $('target').value=state.selectedId;};
$('connect-herdr').onclick = () => api.connectHerdr($('herdr-socket').value).catch(error => { $('error').textContent = error.message; });

$('automatic').onchange = () => api.configure({ automatic: $('automatic').checked }).catch(error => { $('error').textContent = error.message; });

function showView(view) {
  activeView = view;document.body.dataset.activeView=view; scheduleViewport();
  if(state?.selectedId==='studio')$('selected-detail').textContent=view==='agents'?'Choose a project companion below to adjust its desktop placement.':view==='settings'?'Manage connections, model runtime, and rendering preferences.':'Create looks without changing your desktop agents';
  document.querySelectorAll('[data-view]').forEach(el => {
    if (el.tagName === 'BUTTON') { el.classList.toggle('active', el.dataset.view === view); el.setAttribute('aria-current',el.dataset.view === view?'page':'false'); }
    else el.hidden = el.dataset.view !== view;
  });
}
$('import-package-compact').onclick=()=>$('import-package').click();
document.querySelectorAll('nav button').forEach(button=>button.onclick=async()=>{if(button.dataset.view===activeView || await guardNavigation())showView(button.dataset.view);});
async function libraryAction(value) {
  try {await flushAppearance();
    if(['load-package','apply-character','edit-character','import-character'].includes(value.type) && !await guardNavigation())return false;
    $('library-status').textContent='Working…';await api.libraryAction(value);$('library-status').textContent='Ready';return true;
  }
  catch(error) { $('library-status').textContent = error.message; }
}
function renderLibrary(next) {
  const key = JSON.stringify([next.libraryRevision || 0,(next.library || []).length,(next.characters || []).length,next.defaultCharacterId,next.selectedId,next.sourceAsset?.lookPreset]);
  if (key === libraryKey) return; libraryKey = key;
  $('packages').replaceChildren(); $('characters').replaceChildren();
  for(const [id,empty,message] of [['packages',!next.library?.length,'Import a package folder to browse its character looks.'],['characters',!next.characters?.length,'No saved looks yet. Style a character, give it a name, then save it here.']]){if(empty){const p=document.createElement('p');p.className='empty-state';p.textContent=message;$(id).append(p);}}
  for (const pack of next.library || []) {
    const card = document.createElement('article'); card.className = 'card';
    const title = document.createElement('h3'); title.textContent = pack.name;
    const info = document.createElement('p'); info.className = 'muted'; info.textContent=`${pack.presets.length} coordinated looks`;
    const select = document.createElement('select'); select.setAttribute('aria-label', `${pack.name} preset`);
    for (const name of ['',...pack.presets]) { const option=document.createElement('option'); option.value=name; option.textContent=name || 'Base appearance'; select.append(option); }
    if(next.sourceAsset?.packageId===pack.id)select.value=next.sourceAsset.lookPreset || '';
    const texture = document.createElement('select'); texture.setAttribute('aria-label','Matched texture artwork');texture.hidden=true;
    for(const set of [{id:'',name:'Original textures'},...pack.textureSets]) { const option=document.createElement('option');option.value=set.id;option.textContent=set.name;texture.append(option); }
    select.onchange=()=> { texture.value = pack.textureSets.some(t=>t.id===select.value) ? select.value : ''; };
    texture.value=pack.textureSets.some(t=>t.id===select.value)?select.value:'';
    const load=document.createElement('button'); load.textContent='Use look';load.className='primary'; load.onclick=async()=> {load.disabled=true;try{await libraryAction({type:'load-package',id:pack.id,preset:select.value,textureSet:texture.value});}finally{load.disabled=false;}};
    const refresh=document.createElement('button');refresh.textContent='Refresh package';refresh.onclick=()=>libraryAction({type:'refresh-package',id:pack.id});
    const relink=document.createElement('button');relink.textContent='Relink folder';relink.onclick=()=>libraryAction({type:'relink-package',id:pack.id});
    const previews=document.createElement('button');previews.textContent='Generate preset thumbnails';previews.onclick=async()=>{if(await guardNavigation())await libraryAction({type:'preset-thumbnails',id:pack.id});};
    const browser=document.createElement('div');browser.className='preset-browser';browser.setAttribute('aria-label','Supplied character looks');
    for(const preset of pack.presets){
      const button=document.createElement('button');button.className='preset-card'+(preset===next.sourceAsset?.lookPreset?' selected':'');button.setAttribute('aria-label',`Use ${preset}`);button.setAttribute('aria-pressed',String(preset===next.sourceAsset?.lookPreset));
      if(pack.presetThumbnails?.[preset]){const image=document.createElement('img');image.src=pack.presetThumbnails[preset];image.alt='';button.append(image);}
      const caption=document.createElement('span');caption.textContent=preset;button.append(caption);
      button.onclick=()=>libraryAction({type:'load-package',id:pack.id,preset,textureSet:pack.textureSets.some(t=>t.id===preset)?preset:''});browser.append(button);
    }
    const more=document.createElement('details');const moreTitle=document.createElement('summary');moreTitle.textContent='Package options';more.append(moreTitle,previews,refresh,relink);
    card.append(title,info,select,texture,load,browser,more);$('packages').append(card);
  }
  for(const character of next.characters || []) {
    const card=document.createElement('article');card.className='card';card.dataset.characterName=character.name.toLowerCase();
    const title=document.createElement('h3');title.textContent=character.name;
    const use=document.createElement('button');use.textContent='Assign to selected window';use.onclick=()=>libraryAction({type:'apply-character',id:character.id});
    const def=document.createElement('button');def.textContent=next.defaultCharacterId===character.id?'Default for new agents':'Use as default';def.disabled=next.defaultCharacterId===character.id;def.onclick=()=>libraryAction({type:'default-character',id:character.id});
    const duplicate=document.createElement('button');duplicate.textContent='Duplicate';duplicate.onclick=()=>libraryAction({type:'duplicate-character',id:character.id});
    const overwrite=document.createElement('button');overwrite.textContent='Save selected appearance over this character';overwrite.onclick=()=>libraryAction({type:'save-character',id:character.id,name:character.name});
    if(character.thumbnail){const image=document.createElement('img');image.src=character.thumbnail;image.alt=character.name;image.loading='lazy';card.append(image);}
    const edit=document.createElement('button');edit.textContent='Edit in studio';edit.onclick=()=>libraryAction({type:'edit-character',id:character.id});
    const exportButton=document.createElement('button');exportButton.textContent='Export settings';exportButton.onclick=()=>libraryAction({type:'export-character',id:character.id});
    const relinkCharacter=document.createElement('button');relinkCharacter.textContent='Relink model file';relinkCharacter.onclick=()=>libraryAction({type:'relink-character',id:character.id});
    const remove=document.createElement('button');remove.textContent='Remove from library';remove.onclick=()=>libraryAction({type:'remove-character',id:character.id});
    const more=document.createElement('details');const moreTitle=document.createElement('summary');moreTitle.textContent='More';more.append(moreTitle,def,duplicate,overwrite,exportButton,relinkCharacter,remove);
    card.append(title,edit,use,more);$('characters').append(card);
  }
}
function appearanceControls(next) {
  const entries=next.model?.display?.Parameters || [], groups=next.model?.display?.ParameterGroups || [];
  const labels=new Map(entries.map(p=>[p.Id,p])),runtime=new Map((next.parameters || []).map(p=>[p.id,p]));
  const groupNames=new Map(groups.map(g=>[g.Id,g.Name]));
  const start=entries.findIndex(p=>p.Id==='customization_a'), end=entries.findIndex(p=>p.Id==='customization_b');
  const customizable=new Set([...(start>=0 && end>start ? entries.slice(start+1,end).map(p=>p.Id) : []),...(next.model?.expressions || []).filter(e=>e.kind==='appearance').flatMap(e=>e.parameters.map(p=>p.Id))]);
  $('appearance-controls').replaceChildren();
  const sections=new Map();
  for(const p of next.parameters || []) {
    if(!customizable.has(p.id))continue;
    const meta=labels.get(p.id),name=meta?.Name || p.id,group=groupNames.get(meta?.GroupId) || 'Other';
    if(p.min===p.max || name.includes('+++'))continue;
    if(!sections.has(group)) {const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=group;details.append(summary);
      const resetGroup=document.createElement('button');resetGroup.textContent='Reset group';resetGroup.className='subtle';resetGroup.onclick=()=>send({type:'reset-appearance-fields',ids:[...details.querySelectorAll('input[type=range]')].map(input=>input.dataset.parameter)});details.append(resetGroup);sections.set(group,details);$('appearance-controls').append(details);}
    const label=document.createElement('label');label.dataset.search=`${name} ${p.id} ${group}`.toLowerCase();label.textContent=name;label.title=p.id;
    const output=document.createElement('output');output.textContent=Number(next.appearance?.[p.id] ?? p.value).toFixed(2);
    const input=document.createElement('input');input.type='range';input.min=p.min;input.max=p.max;input.step=(p.max-p.min)/400 || .01;input.value=next.appearance?.[p.id] ?? p.value;input.dataset.parameter=p.id;
    input.setAttribute('aria-label',name);
    const opposite=/^Param.*[LR]$/.test(p.id)?runtime.get(p.id.slice(0,-1)+(p.id.endsWith('L')?'R':'L')):null;
    const paired=opposite && customizable.has(opposite.id) && opposite.min===p.min && opposite.max===p.max;
    const pairKey=paired?[p.id,opposite.id].sort().join(':'):null;
    const changes=value=>paired && linkedAppearance.has(pairKey)?{[p.id]:value,[opposite.id]:value}:{[p.id]:value};
    let editGroup;
    input.onpointerdown=()=>{editGroup=`drag-${Date.now()}-${++editSerial}`;};
    input.onkeydown=event=>{if(!event.repeat)editGroup=`key-${Date.now()}-${++editSerial}`;};
    const numeric=document.createElement('input');numeric.type='number';numeric.min=p.min;numeric.max=p.max;numeric.step='any';numeric.value=Number(input.value).toFixed(3);numeric.setAttribute('aria-label',`${name} numeric value`);
    input.oninput=()=>{output.textContent=Number(input.value).toFixed(2);numeric.value=Number(input.value).toFixed(3);queueAppearance(changes(Number(input.value)),editGroup);};
    numeric.onchange=()=>{const value=Number(numeric.value);if(numeric.value && Number.isFinite(value))queueAppearance(changes(value));};
    const reset=document.createElement('button');reset.textContent='Reset';reset.className='subtle';reset.type='button';reset.onclick=()=>send({type:'reset-appearance-fields',ids:[p.id]});
    label.append(output,input,numeric,reset);
    if(paired && p.id.endsWith('L')){const link=document.createElement('input');link.type='checkbox';link.checked=linkedAppearance.has(pairKey);link.setAttribute('aria-label','Link opposite side');link.onchange=()=>{if(link.checked)linkedAppearance.add(pairKey);else linkedAppearance.delete(pairKey);};const text=document.createElement('span');text.className='muted';text.textContent=' Link opposite side ';label.append(text,link);}
    if(/switch|onoff/i.test(p.id) && p.min===0 && p.max===1){const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=Number(input.value)>=.5;toggle.setAttribute('aria-label',`${name} on/off`);toggle.onchange=()=>queueAppearance({[p.id]:toggle.checked?1:0});label.append(toggle);}sections.get(group).append(label);
  }
  for(const p of next.parameters || []) {
    const match=p.id.match(/^(C_.+)R$/);if(!match || !customizable.has(p.id))continue;
    const channels=['R','G','B'].map(s=>runtime.get(match[1]+s));
    if(channels.some(c=>!c || c.max<=c.min || !/color/i.test(labels.get(c.id)?.Name || '')))continue;
    const meta=labels.get(p.id), section=sections.get(groupNames.get(meta?.GroupId) || 'Other');if(!section)continue;
    const row=document.createElement('label');row.dataset.search=`${meta.Name} color mixer`.toLowerCase();row.textContent=meta.Name.replace(/ R$/,'')+' · RGB mix';
    row.title='Maps RGB to the rig’s parameter ranges. Resulting artwork colors also depend on textures and multiply/screen settings.';
    const picker=document.createElement('input');picker.type='color';picker.dataset.colorIds=JSON.stringify(channels.map(c=>c.id));picker.value=colorFromParameters(channels,next.appearance || {});
    let editGroup;picker.onpointerdown=()=>{editGroup=`color-${Date.now()}-${++editSerial}`;};
    picker.oninput=()=>queueAppearance(parametersFromColor(channels,picker.value),editGroup);
    row.append(picker);section.append(row);
  }
  if(!customizable.size) {const info=document.createElement('p');info.className='muted';info.textContent='This model has no recognized appearance groups. Use Advanced parameter controls in Settings.';$('appearance-controls').append(info);}
}
$('apply-preset').onclick=async()=> {const preset=state.model?.expressions.filter(e=>e.kind==='appearance'&&e.supported!==false)[Number($('preset').value)];if(preset){await send({type:'preset',name:preset.name});}};
$('reset-appearance').onclick=async()=>{await send({type:'clear-appearance'});};
$('appearance-search').oninput=()=>{for(const label of $('appearance-controls').querySelectorAll('label[data-search]')){label.hidden=!label.dataset.search.includes($('appearance-search').value.toLowerCase());if(!label.hidden && $('appearance-search').value)label.parentElement.open=true;}};
$('import-package').onclick=async()=>{try{await api.importPackage();}catch(error){$('library-status').textContent=error.message;}};
$('save-character').onclick=async()=>{await flushAppearance();return libraryAction({type:'save-character',name:$('character-name').value});};
$('edit-preview').onclick=async()=>{if(await guardNavigation()){await api.selectTarget('studio');showView('characters');}};
showView('characters');

$('undo-appearance').onclick=()=>send({type:'undo-appearance'});
$('redo-appearance').onclick=()=>send({type:'redo-appearance'});
$('revert-appearance').onclick=()=>send({type:'revert-appearance'});
$('preview-zoom').oninput=()=>send({type:'scale',value:Number($('preview-zoom').value)});
function scheduleViewport() {
  if(viewportScheduled)return;viewportScheduled=true;
  requestAnimationFrame(()=>{
    viewportScheduled=false;const rect=$('preview-surface').getBoundingClientRect();
    const visible=Boolean(state?.embeddedPreview && activeView==='characters' && rect.top>=0 && rect.left>=0 && rect.bottom<=innerHeight && rect.right<=innerWidth);
    void api.previewViewport({x:rect.left,y:rect.top,width:rect.width,height:rect.height,visible}).catch(error=>{$('studio-error').textContent=error.message;});
  });
}
new ResizeObserver(scheduleViewport).observe($('preview-surface'));
window.addEventListener('resize',scheduleViewport);window.addEventListener('scroll',scheduleViewport,{passive:true});

window.addEventListener('keydown',event=>{
  if(activeView!=='characters' || !(event.ctrlKey || event.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
  const key=event.key.toLowerCase();if(key!=='z' && key!=='y')return;
  event.preventDefault();void send({type:key==='y' || event.shiftKey?'redo-appearance':'undo-appearance'});
});

async function guardNavigation(){try{await flushAppearance();return await api.guardNavigation();}catch(error){$('studio-error').textContent=error.message;return false;}}
$('save-workspace').onclick=()=>libraryAction({type:'save-draft'});
$('restore-draft').onclick=()=>libraryAction({type:'restore-draft'});
$('discard-draft').onclick=()=>libraryAction({type:'discard-recovered-draft'});
$('cancel-thumbnails').onclick=()=>libraryAction({type:'cancel-thumbnails'});
$('import-character').onclick=()=>libraryAction({type:'import-character'});
$('character-search').oninput=()=>{for(const card of $('characters').children)card.hidden=!card.dataset.characterName.includes($('character-search').value.toLowerCase());};
$('preview-background').onchange=()=>libraryAction({type:'preview-background',value:$('preview-background').value});
$('clear-asset-cache').onclick=()=>libraryAction({type:'clear-cache'});
$('apply-render-settings').onclick=()=>libraryAction({type:'render-settings',textureLimit:Number($('texture-quality').value),fps:Number($('default-fps').value)});
$('measure-performance').onclick=async()=>{
  $('measure-performance').disabled=true;$('performance-result').textContent='Measuring 10 seconds…';
  try{showView('characters');window.scrollTo(0,0);await new Promise(resolve=>setTimeout(resolve,150));const report=await api.performance();showView('settings');$('performance-result').textContent=report.sessions.map(s=>s.unavailable?`${s.id}: ${s.reason}`:`${s.id}: ${s.fps.toFixed(1)} FPS · p95 ${s.p95FrameMs?.toFixed(1) ?? 'n/a'} ms${s.paused?' (preview paused)':''}`).join('\n')+'\nReport: artifacts/performance.json';}
  catch(error){$('performance-result').textContent=error.message;}finally{$('measure-performance').disabled=false;}
};
function renderAgentCards(next){
  const root=$('agent-cards'),key=JSON.stringify([next.selectedId,next.targets,next.characters?.map(c=>[c.id,c.name])]);if(root.dataset.key===key)return;root.dataset.key=key;root.replaceChildren();
  for(const agent of next.targets || []){
    if(agent.id==='studio')continue;const card=document.createElement('article');card.className='card'+(agent.id===next.selectedId?' selected':'');const title=document.createElement('h3');title.textContent=agent.project || agent.label;title.title=agent.project || agent.label;
    const status=document.createElement('span');status.className='state-badge';status.dataset.state=agent.status;status.textContent=agent.status;const meta=document.createElement('p');meta.className='agent-meta';meta.textContent=[agent.kind,agent.pane].filter(Boolean).join(' · ');
    const select=document.createElement('select');select.setAttribute('aria-label',`Character for ${agent.label}`);
    for(const character of next.characters || []){const option=document.createElement('option');option.value=character.id;option.textContent=character.name;select.append(option);}
    const assign=document.createElement('button');assign.textContent='Assign character';assign.disabled=!next.characters?.length;assign.onclick=async()=>{if(await guardNavigation()){await api.selectTarget(agent.id);await libraryAction({type:'apply-character',id:select.value});}};
    const settings=document.createElement('button');settings.textContent=agent.id===next.selectedId?'Controlling this agent':'Control this agent';settings.onclick=async()=>{if(await guardNavigation()){await api.selectTarget(agent.id);showView('agents');}};
    card.append(title,meta,status,settings);if(next.characters?.length){const change=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Change saved look';change.append(summary,select,assign);card.append(change);}root.append(card);
  }
  if(!root.childElementCount){const info=document.createElement('p');info.textContent='No connected agents. Check the Herdr connection in Settings.';root.append(info);}
}

function queueAppearance(values,editGroup){
  if(pendingAppearance && pendingAppearance.editGroup!==editGroup)void flushAppearance();
  pendingAppearance={values:{...pendingAppearance?.values,...values},editGroup};
  if(appearanceFrame===null)appearanceFrame=requestAnimationFrame(()=>{appearanceFrame=null;void flushAppearance();});
}
async function flushAppearance(){
  if(appearanceFrame!==null){cancelAnimationFrame(appearanceFrame);appearanceFrame=null;}
  const change=pendingAppearance;pendingAppearance=null;
  if(change)appearanceFlush=appearanceFlush.then(()=>send({type:'appearance',...change}));
  return appearanceFlush;
}

$('idle-motion').onchange=async()=>{try{await flushAppearance();await api.configure({idleMotion:$('idle-motion').value});}catch(error){$('studio-error').textContent=error.message;}};

function renderBehaviors(next){
  const log=$('behavior-log'),key=JSON.stringify([next.selectedId,next.behaviorLog]);
  if(log.dataset.key!==key){log.dataset.key=key;log.replaceChildren();for(const event of [...(next.behaviorLog || [])].reverse()){
    const row=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.dateTime=event.time;time.textContent=new Date(event.time).toLocaleTimeString();
    text.textContent=`${event.text}${event.expression?' → '+event.expression:''}`;row.append(time,text);log.append(row);
  }if(!log.childElementCount){const row=document.createElement('li');row.textContent='Agent activity and received messages appear here.';log.append(row);}}
  const actions=$('behavior-actions'),actionKey=next.model?.id || '';
  if(actions.dataset.key!==actionKey){actions.dataset.key=actionKey;actions.replaceChildren();for(const [action,label] of [['thinking','Thinking'],['testing','Testing'],['reading','Reading'],['editing','Editing'],['blocked','Needs help'],['done','Finished'],['error','Error'],['sad','Tired']]){
    const button=document.createElement('button');button.textContent=label;button.disabled=!next.model;button.onclick=()=>send({type:'behavior',action});actions.append(button);
  }}
}
function renderCompatibleParts(next){
  const root=$('compatible-parts'),asset=next.sourceAsset,pack=next.library?.find(p=>p.id===asset?.packageId);
  const options=pack?.presets.filter(name=>(pack.textureSets.some(t=>t.id===name)?name:'')===(asset.textureSet || '')) || [];
  const key=JSON.stringify([next.model?.id,asset,options]);if(root.dataset.key===key)return;root.dataset.key=key;root.replaceChildren();
  if(options.length<2){const info=document.createElement('p');info.className='muted';info.textContent='Choose a complete look above. Its hair, outfit and artwork stay matched.';root.append(info);return;}
  const info=document.createElement('p');info.className='muted';info.textContent='These options share the same artwork and can be mixed.';root.append(info);
  for(const [part,title] of [['hair','Hair'],['outfit','Outfit']]){
    const label=document.createElement('label');label.textContent=title;const select=document.createElement('select');select.className='wide';
    const prompt=document.createElement('option');prompt.value='';prompt.textContent='Keep current';select.append(prompt);
    for(const name of options){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
    select.onchange=()=>{if(select.value)void libraryAction({type:'part-preset',part,preset:select.value});};label.append(select);root.append(label);
  }
}
$('clear-log').onclick=()=>send({type:'clear-log'});

async function configureLife(patch){try{await flushAppearance();await api.configure({life:patch});}catch(error){$('studio-error').textContent=error.message;}}
$('life-mode').onchange=()=>configureLife({mode:$('life-mode').value});
for(const [id,key] of [['life-hover','hoverNotice'],['life-blink','blink'],['life-look','lookAround'],['life-head','head'],['life-breath','breathing'],['life-rest','rest']])$(id).onchange=()=>configureLife({[key]:$(id).checked});
$('life-rest-delay').onchange=()=>configureLife({restAfter:Number($('life-rest-delay').value)});
$('accessory-glasses').onchange=()=>send({type:'accessory',name:'glasses',enabled:$('accessory-glasses').checked});

$('life-temperament').onchange=()=>configureLife({temperament:$('life-temperament').value});$('life-cursor').onchange=()=>configureLife({noticeCursor:$('life-cursor').checked});

$('recover-mouse').onclick=()=>libraryAction({type:'recover-mouse-motions'});
$('remove-recovered').onclick=()=>libraryAction({type:'remove-recovered-motions'});

$('prop-mode').onchange=()=>configureLife({poseMode:$('prop-mode').value});

$('infer-activity').onchange=()=>libraryAction({type:'herdr-inference',enabled:$('infer-activity').checked});

$('prop-theme').onchange=()=>configureLife({propTheme:$('prop-theme').value});
