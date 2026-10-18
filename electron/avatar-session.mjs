import {desktopPosition,projectLabel} from '../lib/desktop-position.mjs';
import {ActivityDirector,ACTIVITIES} from '../lib/activity-director.mjs';
import {attachRecoveredTemplateMotions,attachAlternateIdle} from '../lib/recovered-motions.mjs';
import {lifeSettings} from '../web/life-controller.js';
import {behaviorFromMessage,BehaviorLog} from '../lib/agent-behavior.mjs';
import {desktopSize} from '../lib/desktop-size.mjs';
import { appearanceKey } from '../lib/draft-record.mjs';
import { AppearanceHistory } from '../lib/appearance-history.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectModel, modelPayload } from '../lib/model-library.mjs';
import { resolvePreset, validateAppearance } from '../lib/appearance-profile.mjs';
import { expressionFor, CommandLease } from '../lib/animation-policy.mjs';

export function createAvatarSession({ id, label, defaults, shared, onChange, persist, position }) {
  const { models, previewTextures, root, args, smoke, createWindow } = shared;
  let selectedPath=defaults.modelPath,requestedPath=null;
  let current, pending, imported, importing = false, agentStatus = 'idle', destroyed = false, loadRevision=0, runningLoad=Promise.resolve();
  const state = { ...defaults,life:lifeSettings(defaults.life),accessories:defaults.accessories || {}, appearance: defaults.appearance || {}, appearancePreset: defaults.appearancePreset || '', label, status: 'Select a model', parameters: [], error: null, mappings: defaults.mappings || {}, automatic: defaults.automatic ?? id !== 'studio' };
  let baseline=structuredClone(defaults.savedBaseline || {modelPath:defaults.modelPath,appearance:state.appearance,appearancePreset:state.appearancePreset,sourceAsset:defaults.sourceAsset});
  const preferences=()=>({modelPath:selectedPath,appearance:state.appearance,appearancePreset:state.appearancePreset,sourceAsset:state.sourceAsset,characterId:state.characterId,scale:state.scale,fps:state.fps,alwaysOnTop:state.alwaysOnTop,mappings:state.mappings,automatic:state.automatic,life:state.life,accessories:state.accessories,windowSize:state.windowSize,windowPosition:state.windowPosition,recoveryDisabled:state.recoveryDisabled || false,recoveredMotionFolder:state.recoveredMotionFolder || null,idleMotion:state.idleMotion || '__auto__'});
  let lastMessageBehavior=null,lastMessageAt=0;
  const behaviorLog=new BehaviorLog();const activityDirector=new ActivityDirector(id);
  const history = new AppearanceHistory({values:state.appearance,preset:state.appearancePreset});
  const area = shared.area;
  const initialSize=desktopSize(defaults.windowSize?.width || 520,defaults.windowSize?.height || 720,area);state.windowSize=initialSize;
  const initialPosition=desktopPosition(defaults.windowPosition || {x:area.x+24+position*180,y:area.y+area.height-initialSize.height-24},initialSize,shared.displays?.() || [area]);state.windowPosition=initialPosition;
  const desktopTitle=`Companion · ${label}`;
  const avatar = createWindow('avatar', { ...initialPosition, width:initialSize.width,height:initialSize.height,minWidth:160,minHeight:180, title: `Companion · ${label}`, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: true, alwaysOnTop: state.alwaysOnTop, skipTaskbar: false });
  if(!avatar.embedded){shared.topmostController?.position(desktopTitle,state.windowPosition,{apply:false});shared.topmostController?.update(desktopTitle,state.alwaysOnTop);}
  const publish = () => onChange();
  const save = () => persist();
  const snapshot = () => ({ ...state,behaviorLog:behaviorLog.entries, ...history.status, dirty:appearanceKey(preferences())!==appearanceKey(baseline), savedBaseline:baseline, loading:importing, embedded: Boolean(avatar.embedded), id, agentStatus, runtimeAvailable: Boolean(shared.getCore()), model: current ? modelPayload(current) : null });
  const lease = new CommandLease((status,context={}) => {
    if (!current || destroyed || !state.automatic) return;
    if(state.life.mode==='still' && !context.override){command({type:'reset'});return;}
    const expression = expressionFor(status, current.expressions, state.mappings);
    behaviorLog.add('behavior',status,expression);
    command(expression ? {type:'expression',name:expression,behavior:status,duration:context.duration} : {type:'gesture',action:status});
  });
  let resizeTimer,positionTimer,lastDesktopMove=0;
  function rememberGeometry(geometry){
    if(avatar.embedded || ![geometry.x,geometry.y].every(Number.isFinite))return;
    const next={x:Math.round(geometry.x),y:Math.round(geometry.y)};
    if(Math.abs(next.x)>100000 || Math.abs(next.y)>100000)return;
    if(state.windowPosition?.x===next.x && state.windowPosition?.y===next.y)return;
    lastDesktopMove=Date.now();state.windowPosition=next;shared.topmostController?.position(desktopTitle,next,{apply:false});publish();
    clearTimeout(positionTimer);positionTimer=setTimeout(()=>{void save().catch(error=>{state.error=error.message;publish();});},250);
  }
  avatar.on('move',()=>{if(!shared.nativeWayland && avatar.getPosition){const [x,y]=avatar.getPosition();rememberGeometry({x,y});}});
  avatar.on('resize',()=>{if(avatar.embedded)return;if(state.scale!==1){state.scale=1;avatar.webContents.send('companion:event',{type:'command',command:{type:'scale',value:1}});}const size=avatar.getSize?.();if(size)state.windowSize={width:size[0],height:size[1]};publish();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{void save().catch(error=>{state.error=error.message;publish();});},200);});
  const ready = avatar.loadURL(`${shared.origin}/avatar.html`);
  avatar.on('close', event => { if (!shared.isQuitting?.() && !destroyed) { event.preventDefault(); avatar.hide(); state.visible = false; publish(); } });
function awaitAccessorySave(){void save().catch(error=>{state.error=error.message;publish();});}
function command(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid command');
  const allowed = new Set(['accessory','resize-window','behavior','gesture','clear-log','undo-appearance', 'redo-appearance', 'revert-appearance', 'reset-appearance-fields', 'appearance', 'preset', 'clear-appearance', 'motion', 'expression', 'reset', 'parameter', 'clear-parameters', 'scale', 'fps', 'topmost', 'click-through', 'visibility', 'center', 'message']);
  if (!allowed.has(value.type)) throw new Error('Unknown animation command');
  if(value.type==='accessory'){
    if(value.name!=='glasses' || typeof value.enabled!=='boolean' || !current?.expressions.some(e=>e.name==='Glasses'&&e.supported))throw new Error('Accessory is unavailable');
    state.accessories={...state.accessories,glasses:value.enabled};avatar.webContents.send('companion:event',{type:'command',command:{type:'accessories',values:state.accessories}});awaitAccessorySave();publish();return {accepted:true};
  }
  if(value.type==='clear-log'){behaviorLog.clear();publish();return {accepted:true};}
  if(value.type==='behavior'){if(!current)throw new Error('Load a character first');if(!ACTIVITIES.includes(value.action))throw new Error('Unknown behavior');const expression=expressionFor(value.action,current.expressions,state.mappings);if(state.automatic)lease.override(value.action,3000);else {behaviorLog.add('behavior',value.action,expression);command(expression?{type:'expression',name:expression,behavior:value.action}:{type:'gesture',action:value.action});}return {accepted:true};}
  if(value.type==='resize-window'){
    if(avatar.embedded)throw new Error('Use preview zoom for the studio');
    const size=desktopSize(value.width,value.height,area);state.scale=1;avatar.webContents.send('companion:event',{type:'command',command:{type:'scale',value:1}});avatar.setSize?.(size.width,size.height);state.windowSize=size;publish();void save().catch(error=>{state.error=error.message;publish();});return {accepted:true};
  }
  const appearanceCommands=['preset','appearance','clear-appearance','reset-appearance-fields','undo-appearance','redo-appearance','revert-appearance'];
  if (appearanceCommands.includes(value.type) && importing) throw new Error('Wait for the model to finish loading');
  if (value.type === 'reset-appearance-fields') {
    if(!Array.isArray(value.ids) || value.ids.length>2048 || value.ids.some(id=>!state.parameters.some(p=>p.id===id)))throw new Error('Invalid appearance fields');
    state.appearance={...state.appearance};for(const id of value.ids)delete state.appearance[id];state.appearancePreset='';
  }
  if (value.type === 'preset') {
    const preset = current?.expressions.find(e => e.name === value.name && e.kind === 'appearance' && e.supported);
    if (!preset) throw new Error('Unknown or unsupported appearance preset');
    state.appearance = resolvePreset(preset.parameters, state.parameters); state.appearancePreset = preset.name;
  }
  if (value.type === 'appearance') { state.appearance = { ...state.appearance, ...validateAppearance(value.values, state.parameters) }; state.appearancePreset = ''; }
  if (value.type === 'clear-appearance') { state.appearance = {}; state.appearancePreset = ''; }
  if (appearanceCommands.includes(value.type)) {
    const operation={'undo-appearance':'undo','redo-appearance':'redo','revert-appearance':'revert'}[value.type];
    const result=operation ? history[operation]() : history.commit({values:state.appearance,preset:state.appearancePreset},typeof value.editGroup==='string' ? value.editGroup.slice(0,80) : null);
    state.appearance=result.values;state.appearancePreset=result.preset;
    avatar.webContents.send('companion:event', { type:'command', command: { type:'appearance', values: state.appearance } });
    publish(); void save().catch(error => { state.error = error.message; publish(); }); return { accepted:true };
  }
  if (value.type === 'motion' && !current?.motions.some(item => item.supported!==false && item.group === value.group && item.index === value.index)) throw new Error('Unknown motion');
  if (value.type === 'expression' && !current?.expressions.some(item => item.name === value.name && item.kind !== 'appearance' && item.supported !== false)) throw new Error('Unknown expression');
  if (value.type === 'parameter') {
    const p = state.parameters.find(item => item.id === value.id);
    if (!p || !Number.isFinite(value.value)) throw new Error('Unknown parameter');
    value = { ...value, value: Math.max(p.min, Math.min(p.max, value.value)) };
  }
  if (value.type === 'scale') { if (!Number.isFinite(value.value)) throw new Error('Invalid scale'); state.scale = Math.max(.2, Math.min(2, value.value)); }
  if (value.type === 'fps') { if (![15, 30, 60].includes(value.value)) throw new Error('Invalid FPS'); state.fps = value.value; }
  if (value.type === 'topmost') { state.alwaysOnTop = Boolean(value.value); avatar.setAlwaysOnTop(state.alwaysOnTop,'screen-saver');if(!avatar.embedded)shared.topmostController?.update(`Companion · ${label}`,state.alwaysOnTop); }
  if (value.type === 'click-through') {
    if (avatar.embedded) throw new Error('Click-through only applies to desktop agent windows');
    if (!state.clickThroughSupported) throw new Error(`Wayland click-through needs Electron 43.7.6+ or 44.5.0+. This runtime is ${process.versions.electron}.`);
    avatar.setIgnoreMouseEvents(Boolean(value.value));
    state.clickThrough = Boolean(value.value);
    console.log(`[input] Click-through ${state.clickThrough ? 'enabled' : 'disabled'}; Electron ${process.versions.electron}`);
  }
  if (value.type === 'visibility') { state.visible = Boolean(value.value); if (state.visible && current) avatar.show(); else avatar.hide(); }
  if (value.type === 'message') { if (typeof value.text !== 'string' || value.text.length > 500) throw new Error('Message must be at most 500 characters'); value = { type: 'message', text: value.text, lifetime: Math.max(200, Math.min(15000, Number(value.lifetime) || 5000)) };
    const behavior=behaviorFromMessage(value.text);behaviorLog.add('message',value.text);
    if(state.automatic && state.life.mode!=='still' && current && behavior && expressionFor(behavior,current.expressions,state.mappings)){
      const priority={error:4,blocked:3,done:2,working:1},now=Date.now();if(now-lastMessageAt>=2500 || (priority[behavior] || 0)>(priority[lastMessageBehavior] || 0)){lease.override(behavior,Math.min(value.lifetime,5000));lastMessageAt=now;lastMessageBehavior=behavior;}
    }
  }
  if(value.type==='expression' && !value.behavior)behaviorLog.add('expression',value.name,value.name);
  if (value.type === 'center') {const point=desktopPosition({x:area.x+(area.width-state.windowSize.width)/2,y:area.y+(area.height-state.windowSize.height)/2},state.windowSize,[area]);if(shared.nativeWayland)shared.topmostController?.position(desktopTitle,point);else avatar.center();rememberGeometry(point);}
  avatar.webContents.send('companion:event', { type: 'command', command: value });
  publish();
  if (['scale', 'fps', 'topmost','center'].includes(value.type)) void save().catch(error => { state.error = error.message; publish(); });
  return { accepted: true };
}
async function importModel(path,options={}) {
  const revision=++loadRevision;requestedPath=path;
  if(pending) {avatar.webContents.send('companion:event',{type:'cancel-load',id:pending.model.id});pending.reject(new Error('Model load superseded'));}
  const previous=runningLoad;
  const operation=(async()=>{await previous.catch(()=>{});if(revision!==loadRevision || destroyed)throw new Error('Model load superseded');return performImport(path,options);})();
  runningLoad=operation;try{return await operation;}finally{if(revision===loadRevision)requestedPath=null;}
}
async function performImport(path,options={}) {
  if (importing) throw new Error('Another model is loading');
  if (!shared.getCore()) throw new Error('Select live2dcubismcore.min.js first');
  importing = true;
  state.status = 'Validating model…'; state.error = null; publish();
  try {
    let model = await inspectModel(path);
    let recoveredFolder=options.recoveredMotionFolder===undefined?(state.recoveredMotionFolder==null && !state.recoveryDisabled && model.name==='Type-H1'?shared.recoveryFolder:state.recoveredMotionFolder):options.recoveredMotionFolder;
    if(recoveredFolder){try{await attachRecoveredTemplateMotions(model,recoveredFolder);if(shared.alternateIdle)await attachAlternateIdle(model,shared.alternateIdle);}catch(error){if(options.recoveredMotionFolder)throw error;console.error(`[animations] ${error.message}; loading base model without legacy overlay`);model=await inspectModel(path);recoveredFolder=null;}}
    if(options.preset && !model.expressions.some(e=>e.name===options.preset && e.kind==='appearance' && e.supported))throw new Error('Unknown or unsupported appearance preset');
    imported = model;
    models.set(model.id, model);
    state.status = `Loading ${model.name}…`; publish();
    // Map the native X11 surface before creating/uploading the model textures.
    // Rendering into a hidden transparent window can fail presentation on XWayland.
    if (state.visible && !smoke) avatar.show();
    console.log(`[model] Loading ${model.name}; window visible=${avatar.isVisible()}`);
    let loadedAppearance,recoveredSupport=[];
    await new Promise((resolveLoaded, reject) => {
      const timer = setTimeout(() => { pending = null; avatar.webContents.send('companion:event', { type: 'cancel-load', id: model.id }); reject(new Error('Model loading timed out after 60 seconds')); }, 60_000);
      pending = { model, resolve: payload => {loadedAppearance=payload?.appearance;recoveredSupport=payload?.recoveredSupport || []; clearTimeout(timer); pending = null; resolveLoaded(); }, reject: error => { clearTimeout(timer); pending = null; reject(error); } };
      avatar.webContents.send('companion:event', { type: 'load', model: {...modelPayload(model),initialAppearance:options.appearance ?? (selectedPath===model.path?state.appearance:{}),initialPreset:options.preset,life:state.life,workPose:state.workPose,idleMotion:state.idleMotion || '__auto__'} });
    });
    if (current) models.delete(current.id);
    if ((current?.path || defaults.modelPath) !== model.path) { state.appearance = {}; state.appearancePreset = ''; state.sourceAsset=null;state.characterId=null;state.accessories={}; }
    for(const support of recoveredSupport){const motion=model.motions.find(m=>m.group===support.group&&m.index===support.index);if(motion)motion.supported=support.supported;}
    current = model;selectedPath=model.path;state.recoveredMotionFolder=recoveredFolder || null;if(options.recoveredMotionFolder!==undefined)state.recoveryDisabled=options.recoveredMotionFolder===null;
    state.appearance = validateAppearance(loadedAppearance || {}, state.parameters);if(options.preset)state.appearancePreset=options.preset;
    history.reset({values:state.appearance,preset:state.appearancePreset});
    avatar.webContents.send('companion:event', { type:'command', command:{ type:'appearance', values:state.appearance } });
    avatar.webContents.send('companion:event',{type:'command',command:{type:'accessories',values:state.accessories}});
    if(!avatar.embedded)shared.topmostController?.update(`Companion · ${label}`,state.alwaysOnTop);
    state.status = `${model.name} ready`; state.error = null;
    if (state.visible && !smoke) { avatar.show(); avatar.moveTop(); }
    console.log('[model] Ready', JSON.stringify({ name: model.name, bounds: avatar.getBounds(), visible: avatar.isVisible(), expressions: model.expressions.length, motions: model.motions.length }));
    if (!smoke) {
      if(args.includes('--diagnose'))await new Promise(resolveFrame=>setTimeout(resolveFrame,500));
      const diagnostic = args.includes('--diagnose') ? await avatar.webContents.executeJavaScript('window.renderDiagnostic()') : null;
      if(diagnostic)console.log('[render]', JSON.stringify(diagnostic));
      if (diagnostic && !diagnostic.visible) {
        state.error = 'Model loaded, but the canvas has no visible pixels. See the [render] diagnostics in startup.log.';
      }
      if (args.includes('--diagnose')) {
        const image = await avatar.webContents.capturePage();
        await mkdir(join(root, 'artifacts'), { recursive: true });
        await writeFile(join(root, 'artifacts/render.png'), image.toPNG());
        console.log('[render] Local screenshot saved to artifacts/render.png');
      }
    }
    lease.state(agentStatus); await save(); publish();
  } catch (error) {
    if (imported && imported.id !== current?.id) { models.delete(imported.id); previewTextures.clear(imported.id); }
    state.status = current ? `${current.name} ready` : 'No model loaded'; state.error = error.message; publish(); throw error;
  } finally { importing = false; imported = null;publish(); }
}

  return {
    id, avatar, state, ready, snapshot, command, importModel,
    get current() { return current; },get requestedPath(){return requestedPath;}, get pending() { return pending; },
    relinkAsset(packageId,replacement) {if(state.sourceAsset?.packageId===packageId)state.sourceAsset={...state.sourceAsset,...replacement};if(baseline.sourceAsset?.packageId===packageId)baseline.sourceAsset={...baseline.sourceAsset,...replacement};publish();},
    captureEditor() {return {preferences:structuredClone(preferences()),baseline:structuredClone(baseline),history:history.serialize()};},
    async restoreEditor(editor) {if(editor.preferences.modelPath)await this.restorePreferences(editor.preferences);else await this.discard();baseline=editor.baseline;history.restore(editor.history);await save();publish();},
    checkpoint(characterId=state.characterId) {state.characterId=characterId;baseline=structuredClone(preferences());history.checkpoint();publish();},
    async discard() {
      if(baseline.modelPath)return this.restorePreferences(baseline,{checkpoint:true});
      if(current){models.delete(current.id);previewTextures.clear(current.id);}current=null;selectedPath=null;state.appearance={};state.appearancePreset='';state.sourceAsset=null;state.parameters=[];state.status='Select a model';
      history.reset({values:{},preset:''});avatar.webContents.send('companion:event',{type:'command',command:{type:'clear-model'}});await save();publish();
    },
    savedPreferences() {return {...structuredClone(baseline),scale:state.scale,windowSize:state.windowSize,windowPosition:state.windowPosition,fps:state.fps,alwaysOnTop:state.alwaysOnTop,mappings:state.mappings,automatic:state.automatic,life:state.life,accessories:state.accessories,recoveryDisabled:state.recoveryDisabled || false,recoveredMotionFolder:state.recoveredMotionFolder || null,idleMotion:state.idleMotion || '__auto__'};},
    async restorePreferences(value,{checkpoint=false}={}) {
      if(!value?.modelPath)throw new Error('No saved model to restore');
      const validated=current?.path===value.modelPath?validateAppearance(value.appearance || {},state.parameters):null;
      if(!validated || (value.recoveredMotionFolder || null)!==(state.recoveredMotionFolder || null))await importModel(value.modelPath,{appearance:value.appearance || {},recoveredMotionFolder:value.recoveryDisabled?null:(value.recoveredMotionFolder || undefined)});
      else {command({type:'clear-appearance'});command({type:'appearance',values:validated});}
      if(value.life){state.life=lifeSettings(value.life);avatar.webContents.send('companion:event',{type:'command',command:{type:'life-settings',value:state.life}});}
      state.accessories=value.accessories || {};avatar.webContents.send('companion:event',{type:'command',command:{type:'accessories',values:state.accessories}});
      state.appearancePreset=value.appearancePreset || '';state.sourceAsset=value.sourceAsset;state.characterId=value.characterId;
      history.reset({values:state.appearance,preset:state.appearancePreset});
      if(checkpoint)baseline=structuredClone(preferences());
      await save();publish();
    },
    async recoverMouseMotions(folder){if(!current)throw new Error('Load a model first');await importModel(current.path,{appearance:state.appearance,recoveredMotionFolder:folder});await save();publish();},
    activity(action,source='explicit-hook'){
      if(!ACTIVITIES.includes(action))throw new Error('Unknown activity');
      if(!current || !state.automatic || state.life.mode==='still' || lease.timer || agentStatus==='blocked' || agentStatus==='disconnected')return {accepted:false,reason:'higher-priority state or reaction'};
      behaviorLog.add('signal',`${source}: ${action}`);lease.override(action,1800);publish();return {accepted:true};
    },
    desktopTitle,
    desktopGeometry(geometry){rememberGeometry(geometry);},
    desktopPointer(point){if(Date.now()-lastDesktopMove<180)return;if(!avatar.embedded && state.visible!==false)avatar.webContents.send('companion:event',{type:'command',command:{type:'pointer-local',x:point.x,y:point.y,nx:point.nx,ny:point.ny}});},
    preferences,
    report(payload) {
      if (payload?.type === 'loaded' && payload.id === pending?.model.id) { state.parameters = payload.parameters; pending.resolve(payload); }
      if (payload?.type === 'load-error' && payload.id === pending?.model.id) pending.reject(new Error(String(payload.error)));
      if (payload?.type === 'initialization-error') { state.error = String(payload.error); publish(); }
      if(payload?.type==='graphics-info'){state.graphics=payload.info;publish();}
      if(payload?.type==='life-event'){behaviorLog.add('life',String(payload.text));publish();}
      if (payload?.type === 'animation') { state.animation = payload.text; publish(); }
    },
    setAgent(agent) { const signal=activityDirector.update(agent);state.activity=signal.activity;state.signalSource=signal.source;const changed = agentStatus !== agent.status;if(changed && agent.status==='working')state.workPose=shared.nextWorkPose?.() || (Math.random()<.5?'keyboard-full':'keyboard-half'); agentStatus = agent.status; state.project=projectLabel(agent);state.agentKind=agent.kind || state.agentKind || '';state.pane=agent.pane || state.pane;state.label=state.project; if(changed){if(!current || !state.automatic || lease.timer)behaviorLog.add('state',agent.status);lease.state(agent.status);}if(signal.accent && state.automatic && state.life.mode!=='still' && !lease.timer && current && (!changed || signal.accent!==agent.status)){behaviorLog.add('signal',`${signal.source}: ${signal.accent}`);lease.override(signal.accent,signal.accent==='done'?2200:1800);} avatar.webContents.send('companion:event', { type: 'agent-state', label: state.label,kind:state.agentKind,pane:state.pane,workPose:state.workPose,status: agent.status,activity:signal.activity }); publish(); },
    configure(value) {if(value.life){state.life=lifeSettings({...state.life,...value.life});avatar.webContents.send('companion:event',{type:'command',command:{type:'life-settings',value:state.life}});if(state.life.mode==='still')command({type:'reset'});}if(value.idleMotion!==undefined){if(!['__auto__','__none__'].includes(value.idleMotion) && !current?.motions.some(m=>!m.recovered && `${m.group}:${m.index}`===value.idleMotion))throw new Error('Unknown idle motion');state.idleMotion=value.idleMotion;} if (typeof value.automatic === 'boolean') state.automatic = value.automatic; if (value.mappings) { for (const [key, name] of Object.entries(value.mappings)) { if (!ACTIVITIES.includes(key) || (!['__none__','__auto__'].includes(name) && !current?.expressions.some(item => item.name === name))) throw new Error('Invalid animation mapping'); if (name === '__auto__') delete state.mappings[key]; else state.mappings[key] = name; } } lease.reset(); void save(); publish(); },
    animate(action, duration = 3000) { if (!current) throw new Error('No model assigned'); if (!ACTIVITIES.includes(action)) throw new Error('Unsupported action'); state.automatic = true; lease.override(action, duration); return { accepted: true }; },
    reset() { command({ type: 'reset' }); lease.reset(); },
    destroy() { if(!avatar.embedded)shared.topmostController?.remove(`Companion · ${label}`);destroyed = true;clearTimeout(resizeTimer);clearTimeout(positionTimer);loadRevision++; lease.clear(); if (pending) pending.reject(new Error('Agent exited')); if (current) { models.delete(current.id); previewTextures.clear(current.id); } avatar.destroy(); },
  };
}
