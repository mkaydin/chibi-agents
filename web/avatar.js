import {propThemeValues} from './prop-themes.js';
import {poseMode,poseValues,compatibleRecovered,propAccent,MousePropTracker,TypingController} from './pose-controller.js';
import {LifeController,attachLife,LIFE_CHANNELS,lifeSettings,clearTransientExpression} from './life-controller.js';
import {characterLayout,titlePosition} from './desktop-layout.js';
import {resolvePreset,validateAppearance} from '/appearance-profile.mjs';
import {summarizeFrames} from './performance.js';
import { prepareTextures } from './textures.js';
const api = window.companion;
const configuration = api.state();
let expressionTimeout,expressionGeneration=0,poseTimeout,motionCatalog=[],avatarHitBounds=null,hoverInside=false,lastDesktopPointer=-Infinity,mouseTracker=new MousePropTracker(),automaticWorkPose='keyboard-full';
let textureQuality,previewPaused=false,lifeOptions,lifeBinding,agentPhase='idle',agentActivity='idle',accessoryValues=new Map(),disposeLife;
let app, model, modelId, modelName, scale = 1, fps = 30, fit, appearance = new Map(), overrides = new Map(), catalog = [], armFix = [], loadingId, initializationError;

try {
  if (!window.Live2DCubismCore) throw new Error('Cubism Core did not load. Check the selected local runtime path.');
  if (!window.PIXI?.live2d?.Live2DModel) throw new Error('The local Pixi/Live2D renderer bundle failed to load; check startup.log.');
  PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
  // Pixi 6 reads this global setting; preferWebGLVersion is not a v6 option.
  PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL;
  PIXI.Ticker.shared.maxFPS = fps;
  app = new PIXI.Application({ view: document.querySelector('#avatar'), width: innerWidth, height: innerHeight, backgroundAlpha: 0, resizeTo: window, sharedTicker: true, antialias: false, resolution: Math.min(devicePixelRatio, 1.5), autoDensity: true });
  app.view.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    console.error('[context] Lost:', event.statusMessage || 'No driver reason supplied');
    report('Graphics context lost; waiting for recovery');
  });
  app.view.addEventListener('webglcontextrestored', () => { console.log('[context] Restored'); model?.update(16); });
  const context = app.renderer.gl;
  if (!context) throw new Error('WebGL context creation failed. Restart with --graphics software or --graphics opengl.');
  const debug = context.getExtension('WEBGL_debug_renderer_info');
  const info = { vendor: context.getParameter(debug?.UNMASKED_VENDOR_WEBGL || context.VENDOR), renderer: context.getParameter(debug?.UNMASKED_RENDERER_WEBGL || context.RENDERER), maxTextureSize: context.getParameter(context.MAX_TEXTURE_SIZE) };
  api.report({ type: 'graphics-info', info });
  const config = await configuration;
  if (config.graphicsMode === 'nvidia' && !/nvidia/i.test(info.renderer)) throw new Error(`NVIDIA rendering requested, but WebGL selected ${info.renderer}. Check the NVIDIA driver and PRIME setup; see startup.log.`);
} catch (error) {
  initializationError = error.message;
  console.error('Renderer initialization failed:', initializationError);
  api.report({ type: 'initialization-error', error: initializationError });
}

function parameters(instance) {
  const core = instance.internalModel.coreModel;
  const ids = core._model.parameters.ids;
  return Array.from(ids, (id, index) => ({ id, min: core.getParameterMinimumValue(index), max: core.getParameterMaximumValue(index), default: core.getParameterDefaultValue(index), value: core.getParameterDefaultValue(index) }));
}
function layout() {
  if (!model || !fit) return;
  const result=characterLayout(innerWidth,innerHeight,fit,scale,document.body.classList.contains('embedded-preview'));
  model.scale.set(result.factor);model.position.set(result.x,result.y);positionTitle();
}
function report(text) { api.report({ type: 'animation', text }); }
async function healthyContext() {
  const deadline = performance.now() + 10_000;
  while (app.renderer.gl.isContextLost()) {
    if (performance.now() > deadline) throw new Error('WebGL context stayed lost for 10 seconds. Rendering failed; check [context] log lines.');
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
}
async function load(data) {
  if (!app || initializationError) { api.report({ type: 'load-error', id: data.id, error: initializationError || 'Renderer is unavailable.' }); return; }
  let candidate;
  let prepared;
  loadingId = data.id;
  try {
    await healthyContext();
    const config = await configuration;
    lifeOptions=lifeOptions || lifeSettings(data.life || config.life);
    const textureLimit = config.graphicsMode === 'software' ? 2048 : Math.min(textureQuality || config.textureLimit || 4096, app.renderer.gl.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE));
    prepared = await prepareTextures(data, textureLimit);
    const motionChoice=data.idleMotion || '__auto__';
    const normal=motionChoice==='__none__'?null:data.motions.find(m=>motionChoice==='__auto__'?/^(idle|idle_normal)$/i.test(m.name):`${m.group}:${m.index}`===motionChoice);
    const sleep=motionChoice==='__auto__'?data.motions.find(m=>/^idle_sleep$/i.test(m.name)):null;
    for(const motion of data.motions.filter(m=>m.pose)){prepared.manifest.FileReferences.Motions[`Pose_${motion.pose}${motion.sleeping?'_sleep':''}`]=[prepared.manifest.FileReferences.Motions[motion.group][motion.index]];}
    if(normal)prepared.manifest.FileReferences.Motions.CompanionIdle=[prepared.manifest.FileReferences.Motions[normal.group][normal.index]];
    if(sleep)prepared.manifest.FileReferences.Motions.CompanionSleep=[prepared.manifest.FileReferences.Motions[sleep.group][sleep.index]];
    const clipOwnership=new Map(),fileOwnership=new Map();
    for(const group of ['CompanionIdle','CompanionSleep']){
      const file=prepared.manifest.FileReferences.Motions[group]?.[0]?.File;if(!file)continue;
      const response=await fetch(new URL(file,prepared.manifest.url));if(!response.ok)throw new Error('Idle motion metadata could not be loaded');
      const text=await response.text();if(text.length>8*1024*1024)throw new Error('Idle motion metadata is too large');const motion=JSON.parse(text);
      const channels=new Set((motion.Curves || []).filter(c=>c.Target==='Parameter').map(c=>c.Id));clipOwnership.set(`${group}:0`,channels);fileOwnership.set(file,channels);
    }
    for(const motion of data.motions){const file=prepared.manifest.FileReferences.Motions[motion.group]?.[motion.index]?.File;if(fileOwnership.has(file))clipOwnership.set(`${motion.group}:${motion.index}`,fileOwnership.get(file));}
    candidate = await PIXI.live2d.Live2DModel.from(prepared.manifest, { autoInteract: false, idleMotionGroup: normal?'CompanionIdle':'__disabled_idle__', motionPreload: 'NONE' });
    const list = parameters(candidate);
    const recoveredSupport=compatibleRecovered(data.motions,list);
    const supported=m=>!m.recovered || recoveredSupport.some(s=>s.group===m.group&&s.index===m.index&&s.supported);
    for(const motion of data.motions.filter(m=>m.recovered && supported(m))){
      const channels=new Set(motion.channels);clipOwnership.set(`${motion.group}:${motion.index}`,channels);
      if(motion.pose)clipOwnership.set(`Pose_${motion.pose}${motion.sleeping?'_sleep':''}:0`,channels);
    }
    const initialAppearance=data.initialPreset?resolvePreset(data.expressions.find(e=>e.name===data.initialPreset && e.kind==='appearance')?.parameters || [],list):validateAppearance(data.initialAppearance || {},list);
    const applyInitial=()=>{for(const [id,value] of Object.entries(initialAppearance))candidate.internalModel.coreModel.setParameterValueById(id,value);candidate.internalModel.coreModel.update();};
    if(typeof candidate.internalModel.updateNaturalMovements!=='function')throw new Error('Unsupported Cubism animation stage; cannot safely install the life controller');
    const b = candidate.getLocalBounds();
    if (!(b.width > 0 && b.height > 0)) throw new Error('Model has empty drawable bounds');
    if (loadingId !== data.id) { candidate.destroy({ children: true, texture: true, baseTexture: true }); return; }
    // Validate rendering before removing the currently displayed instance.
    app.stage.addChild(candidate);
    candidate.visible = false;
    const previous = model;
    const nextFit = { width: b.width, height: b.height, centerX: b.x + b.width / 2, centerY: b.y + b.height / 2 };
    // A failed GPU draw must not replace or destroy the previous model.
    const geometry=characterLayout(innerWidth,innerHeight,nextFit,scale,document.body.classList.contains('embedded-preview'));
    candidate.scale.set(geometry.factor);candidate.position.set(geometry.x,geometry.y);
    candidate.visible = true;
    candidate.update(16);applyInitial();
    app.renderer.render(app.stage);
    await healthyContext();
    // Drivers can lose the context during atlas upload. Only acknowledge a
    // model after the asynchronous context-loss event has had time to arrive.
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
    await healthyContext();
    if(loadingId!==data.id)throw new Error('Model load superseded');
    candidate.update(16);applyInitial();app.renderer.render(app.stage);
    clearTimeout(poseTimeout);automaticWorkPose=data.workPose || config.workPose || (Math.random()<.5?'keyboard-full':'keyboard-half');mouseTracker=new MousePropTracker();hoverInside=false;avatarHitBounds=null;motionCatalog=data.motions;model = candidate; modelId = data.id; modelName = data.name; catalog = data.expressions; fit = nextFit;
    appearance=new Map(Object.entries(initialAppearance)); overrides.clear(); armFix = []; layout();
    clearTimeout(expressionTimeout);expressionGeneration++;disposeLife?.();accessoryValues.clear();
    previous?.destroy({ children: true, texture: true, baseTexture: true });
    const metadata = data.display?.Parameters || [];
    const start = metadata.findIndex(p => p.Id === 'customization_a'), end = metadata.findIndex(p => p.Id === 'customization_b');
    const appearanceIds = new Set([
      ...(start >= 0 && end > start ? metadata.slice(start + 1, end).map(p => p.Id) : []),
      ...catalog.filter(e => e.kind === 'appearance').flatMap(e => e.parameters.map(p => p.Id)),
    ]);
    const defaultValues = new Map(list.map(p => [p.id, p.default]));
    let activePose={},chosenPose='standing';
    const typing=new TypingController(config.id || data.id,catalog,list);
    const themeIds=Object.keys(propThemeValues('lavender',list)),themeCache=new Map(['original','lavender','mint','amber'].map(name=>[name,propThemeValues(name,list)]));
    const propIds=new Set(['ParamMouseClick','ParamMouseButton','ParamMouseX','ParamMouseY','CtrRDown',...catalog.filter(e=>/^Key(?:[A-Z]|[0-9])$/.test(e.name)&&e.supported).flatMap(e=>e.parameters.map(p=>p.Id))]);
    const propBounds=new Map(list.map(p=>[p.id,p]));
    candidate.internalModel.on('afterMotionUpdate', () => {
      // Restore the baseline before applying offsets resolved to absolute values.
      // Cubism saves these parameters each frame: omitting this causes old presets
      // to leak into subsequent presets and makes clearing an appearance ineffective.
      for (const id of [...appearance.keys(),...accessoryValues.keys()]) appearanceIds.add(id);
      for (const id of appearanceIds) if (defaultValues.has(id)) candidate.internalModel.coreModel.setParameterValueById(id, accessoryValues.get(id) ?? appearance.get(id) ?? defaultValues.get(id));
      for(const id of [...propIds,...themeIds])if(defaultValues.has(id) && !(clipOwnership.get(`${candidate.internalModel.motionManager.state.currentGroup}:${candidate.internalModel.motionManager.state.currentIndex}`)?.has(id)))candidate.internalModel.coreModel.setParameterValueById(id,appearance.get(id) ?? defaultValues.get(id));
      for(const [id,value] of Object.entries(themeCache.get(lifeOptions.propTheme) || {}))candidate.internalModel.coreModel.setParameterValueById(id,value);
      for(const [id,value] of Object.entries(activePose))candidate.internalModel.coreModel.setParameterValueById(id,value);
    });
    candidate.internalModel.on('beforeModelUpdate', () => {
      const core = candidate.internalModel.coreModel;
      for (const [id, value] of overrides) core.setParameterValueById(id, value);
      for (const id of armFix) core.setParameterValueById(id, 1);
    });
    const controller=new LifeController(config.id || data.id,lifeOptions);controller.setStatus(agentPhase);
    const noChannels=new Set(),manualChannels=new Set(LIFE_CHANNELS);
    const manager=candidate.internalModel.motionManager,normalGroup=normal?'CompanionIdle':'__disabled_idle__';
    const available=new Set(data.motions.filter(m=>m.pose&&!m.sleeping&&supported(m)).map(m=>m.pose));
    if(!list.some(p=>p.id==='ModeChange'))available.clear();
    if(list.some(p=>p.id==='ParamArmRPose') && data.expressions.some(e=>e.name==='Mic'&&e.supported))available.add('microphone');
    let currentGroup,manualPose=null;
    const updateIdle=resting=>{
      if(manualPose)resting=Boolean(manualPose.sleeping);
      const choice=manualPose?(manualPose.pose || 'standing'):(lifeOptions.mode==='still'?'standing':poseMode(lifeOptions.poseMode,agentPhase,agentActivity,resting,available,automaticWorkPose));
      chosenPose=choice;activePose=list.some(p=>p.id==='ModeChange')?poseValues(choice,list,id=>appearance.get(id) ?? defaultValues.get(id)):{};
      const poseClip=data.motions.find(m=>m.pose===choice&&Boolean(m.sleeping)===Boolean(resting)&&supported(m));
      const group=manualPose && !manualPose.pose?manualPose.group:lifeOptions.mode==='still'&&!manualPose?'__disabled_idle__':poseClip?`Pose_${choice}${resting?'_sleep':''}`:resting&&sleep?'CompanionSleep':normalGroup;
      if(group!==currentGroup){currentGroup=group;manager.groups.idle=group;manager.stopAllMotions();}
    };
    disposeLife=attachLife(candidate.internalModel,list,controller,{base:id=>accessoryValues.get(id) ?? appearance.get(id) ?? defaultValues.get(id),clipChannels:()=>{
      const state=manager.state;return clipOwnership.get(`${state.currentGroup}:${state.currentIndex}`) || (state.currentPriority>1?manualChannels:noChannels);
    },onFrame:(_values,time,delta)=>{
      const mouse=mouseTracker.step(delta);
      if(manager.state.currentPriority>1){typing.clear();return;}
      const accent=chosenPose.startsWith('keyboard')?typing.step(delta,chosenPose,agentPhase):(typing.step(delta,chosenPose,agentPhase),propAccent(chosenPose,agentPhase,time));
      const core=candidate.internalModel.coreModel,apply=(id,target,weight=accent?.weight ?? 1)=>{const p=propBounds.get(id);if(!p)return;const current=core.getParameterValueById(id);core.setParameterValueById(id,Math.max(p.min,Math.min(p.max,current+(target-current)*weight)));};
      if(chosenPose==='keyboard-half')for(const [id,value] of [['ParamMouseX',mouse.x],['ParamMouseY',mouse.y]]){const p=propBounds.get(id);if(p){const base=defaultValues.get(id) ?? 0;apply(id,base+value*(value>=0?p.max-base:base-p.min),1);}}
      if(!accent)return;
      if(accent.parameter)apply(accent.parameter,(defaultValues.get(accent.parameter) || 0)+1);
      if(accent.expression){const expression=catalog.find(e=>e.name===accent.expression&&e.supported);if(expression)for(const [id,value] of Object.entries(resolvePreset(expression.parameters,list)))apply(id,value);}
    },onRest:resting=>{updateIdle(resting);api.report({type:'life-event',text:resting?'Resting after inactivity':'Awake and attentive'});}});
    lifeBinding={controller,updateIdle,playPose(motion){manualPose=motion;updateIdle(motion.sleeping);clearTimeout(poseTimeout);poseTimeout=setTimeout(()=>{if(model!==candidate)return;manualPose=null;updateIdle(controller.sleeping);},4000);},clearPose(){clearTimeout(poseTimeout);manualPose=null;updateIdle(controller.sleeping);}};controller.setActivity(agentActivity);candidate.once('destroy',disposeLife);updateIdle(false);
    positionTitle();
    api.report({ type: 'loaded', id: data.id, parameters: list,appearance:initialAppearance,recoveredSupport });
    report('Ready · select a motion or expression');
  } catch (error) {
    if (candidate && candidate !== model) candidate.destroy({ children: true, texture: true, baseTexture: true });
    api.report({ type: 'load-error', id: data.id, error: error.message });
  } finally { await prepared?.dispose(); }
}
async function command(c) {
  if(c.type==='preview-background') {document.body.dataset.previewBackground=c.value;return;}
  if(c.type==='preview-active') {previewPaused=!c.value;if(app){if(c.value)app.start();else app.stop();}return;}
  if (c.type === 'message') {
    const bubble = document.getElementById('bubble'); bubble.textContent = c.text; bubble.hidden = false;
    clearTimeout(window.bubbleTimer); window.bubbleTimer = setTimeout(() => { bubble.hidden = true; }, c.lifetime); return;
  }
  if (c.type === 'click-through') { document.body.classList.toggle('click-through', Boolean(c.value)); return; }
  if (c.type === 'scale') { scale = c.value; layout(); return; }
  if (c.type === 'fps') { fps = c.value; PIXI.Ticker.shared.maxFPS = fps; return; }
  if(c.type==='pointer-local'){lastDesktopPointer=performance.now();mouseTracker.point(c.nx,c.ny);noticePointer(c.x,c.y,0,'desktop');return;}
  if(c.type==='attention'){lifeBinding?.controller.attend(c.x,c.y);return;}
  if(c.type==='life-settings'){lifeOptions=lifeSettings(c.value);lifeBinding?.controller.configure(lifeOptions);lifeBinding?.updateIdle(lifeBinding.controller.sleeping);return;}
  if(c.type==='texture-quality'){textureQuality=c.value;return;}
  if(c.type==='clear-model'){clearTimeout(poseTimeout);clearTimeout(expressionTimeout);expressionGeneration++;disposeLife?.();disposeLife=null;lifeBinding=null;model?.destroy({children:true,texture:true,baseTexture:true});model=null;modelId=null;app?.renderer.render(app.stage);return;}
  if (!model) return;
  if(c.type==='accessories'){
    accessoryValues.clear();const glasses=catalog.find(e=>e.name==='Glasses'&&e.supported);if(glasses && c.values.glasses!==undefined){const list=parameters(model),values=c.values.glasses?resolvePreset(glasses.parameters,list):Object.fromEntries(glasses.parameters.map(p=>[p.Id,list.find(v=>v.id===p.Id)?.default ?? 0]));accessoryValues=new Map(Object.entries(values));}return;
  }
  if(c.type==='gesture'){clearTimeout(expressionTimeout);expressionGeneration++;clearTransientExpression(model.internalModel.motionManager.expressionManager);lifeBinding?.controller.react(c.action);return;}
  if (c.type === 'appearance') { appearance = new Map(Object.entries(c.values)); return; }
  if (c.type === 'motion') {
    const motion=motionCatalog.find(m=>m.group===c.group&&m.index===c.index);
    if(motion?.pose || motion?.group==='RecoveredIdle'){lifeBinding?.playPose(motion);report(`Previewing ${motion.name} for 4 seconds`);return;}
    const started = await model.motion(c.group, c.index, 3);
    report(started ? `Playing ${c.group} / ${c.index + 1}` : 'Motion did not start');
  }
  if (c.type === 'expression') {
    if(c.behavior)lifeBinding?.controller.react(c.behavior);
    // Mk6's alternate prop artwork otherwise leaves its default arms visible.
    // This correction is scoped to Mk6 and actual parameter existence.
    armFix = [];
    if (modelName === 'Mk6') {
      const ids = new Set(parameters(model).map(p => p.id));
      const fixes = { Tablet: ['ParamForearmR1ONOFF'], Pen: ['ParamForearmL1ONOFF'], Controller: ['ParamForearmR1ONOFF', 'ParamForearmL1ONOFF'], Tracking: ['ParamForearmR1ONOFF', 'ParamForearmL1ONOFF'] };
      armFix = (fixes[c.name] || []).filter(id => ids.has(id));
    }
    clearTimeout(expressionTimeout);const generation=++expressionGeneration,instance=model;
    await instance.expression(catalog.findIndex(item=>item.name===c.name));if(instance!==model || generation!==expressionGeneration)return;report(`Expression · ${c.name}`);
    if(c.behavior){const duration=c.duration || ({working:1500,blocked:2200,done:1600,error:2200}[c.behavior] || 1800);
      expressionTimeout=setTimeout(()=>{if(model===instance&&generation===expressionGeneration)clearTransientExpression(instance.internalModel.motionManager.expressionManager);},duration);
    }
  }
  if (c.type === 'reset') {lifeBinding?.controller.react('idle');lifeBinding?.clearPose(); clearTimeout(expressionTimeout);expressionGeneration++; model.internalModel.motionManager.stopAllMotions(); clearTransientExpression(model.internalModel.motionManager.expressionManager); overrides.clear(); armFix = []; report('Motion, expression and overrides reset'); }
  if (c.type === 'parameter') overrides.set(c.id, c.value);
  if (c.type === 'clear-parameters') { overrides.clear(); report('Parameter overrides cleared'); }
}
api.onEvent(event => {
  if (event.type === 'agent-state') {agentPhase=event.status;if(['keyboard-full','keyboard-half'].includes(event.workPose))automaticWorkPose=event.workPose;agentActivity=event.activity || event.status;lifeBinding?.controller.setStatus(agentPhase);lifeBinding?.controller.setActivity(agentActivity);lifeBinding?.updateIdle(lifeBinding.controller.sleeping); setCaption(event.label);positionTitle(); }
  if (event.type === 'cancel-load' && loadingId === event.id) loadingId = null;
  if (event.type === 'load') void load(event.model);
  if (event.type === 'command') void command(event.command).catch(error => report(error.message));
});
window.addEventListener('resize', layout);
const initial = await configuration; scale = initial.scale; fps = initial.fps;agentPhase=initial.agentStatus || 'idle';agentActivity=initial.activity || agentPhase;lifeOptions=lifeSettings(initial.life);
if(!initial.embedded)setCaption(initial.project || initial.label);
if (app) { PIXI.Ticker.shared.maxFPS = fps; if(initial.embedded){document.body.classList.add('embedded-preview');document.body.dataset.previewBackground=initial.previewBackground || 'solid';} }
window.renderDiagnostic = () => {
  if (!app || !model) throw new Error('No rendered model');
  app.renderer.render(app.stage);
  const data = app.renderer.extract.pixels();
  let transparent = 0, visible = 0;
  for (let i = 3; i < data.length; i += 4) { if (data[i] === 0) transparent++; if (data[i] > 10) visible++; }
  return { transparent, visible, total: data.length / 4, modelId, viewport: { width: innerWidth, height: innerHeight }, canvas: { width: app.renderer.width, height: app.renderer.height }, model: { x: model.x, y: model.y, scale: model.scale.x, bounds: fit }, contextLost: app.renderer.gl.isContextLost() };
};

window.samplePerformance=async()=>{
  if(!app || !model) return {unavailable:true,reason:initializationError || 'No model'};
  const frames=[],start=performance.now();let previous=start;
  const tick=()=>{const now=performance.now();frames.push(now-previous);previous=now;};
  app.ticker.add(tick);try{await new Promise(resolve=>setTimeout(resolve,10000));return {...summarizeFrames(frames,performance.now()-start,previewPaused),model:modelName,graphicsMode:initial.graphicsMode,textureLimit:textureQuality || initial.textureLimit || 4096};}finally{app.ticker.remove(tick);}
};

function setCaption(project){
 const caption=document.getElementById('agent-caption');caption.replaceChildren();caption.dataset.status=agentPhase;
 const name=document.createElement('strong');name.textContent=project || 'Companion';
 caption.append(name);caption.title=name.textContent;caption.hidden=false;
}
function noticePointer(x,y,buttons=0,source='local'){
 if(source==='local' && performance.now()-lastDesktopPointer<250)return;
 if(!model || !avatarHitBounds || resizing || buttons || document.body.classList.contains('embedded-preview')){hoverInside=false;return;}
 const b=avatarHitBounds,hit=x>=b.x && x<=b.x+b.width && y>=b.y && y<=b.y+b.height;
 if(hit&&!hoverInside && lifeBinding?.controller.hover((x-b.x-b.width/2)/(b.width/2),(b.y+b.height/2-y)/(b.height/2)))api.report({type:'life-event',text:'Noticed pointer'});
 hoverInside=hit;
}
function positionTitle(){
  const caption=document.getElementById('agent-caption');if(!model || caption.hidden)return;
  const internal=model.internalModel,core=internal.coreModel;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(let i=0;i<core.getDrawableCount();i++){
    if(core.getDrawableOpacity(i)<.05 || !core.getDrawableDynamicFlagIsVisible(i))continue;
    const box=internal.getDrawableBounds(i);if(!Number.isFinite(box.x) || !Number.isFinite(box.y))continue;
    left=Math.min(left,box.x);top=Math.min(top,box.y);right=Math.max(right,box.x+box.width);bottom=Math.max(bottom,box.y+box.height);
  }
  const bounds=Number.isFinite(top)?{x:model.x+left*model.scale.x,y:model.y+top*model.scale.y,width:(right-left)*model.scale.x,height:(bottom-top)*model.scale.y}:model.getBounds();
  avatarHitBounds=bounds;
  const position=titlePosition(bounds,innerWidth,innerHeight,caption.offsetHeight || 40,caption.offsetWidth || 0);caption.style.left=`${position.x}px`;caption.style.top=`${position.y}px`;
}
let lastTitleUpdate=0;if(app)app.ticker.add(()=>{if(performance.now()-lastTitleUpdate>250){lastTitleUpdate=performance.now();positionTitle();}});
const grip=document.getElementById('resize-grip');let resizing=null,resizeFrame=null;
grip.addEventListener('pointerdown',event=>{if(document.body.classList.contains('click-through'))return;event.preventDefault();resizing={pointer:event.pointerId,x:event.screenX,y:event.screenY,width:innerWidth,height:innerHeight};grip.setPointerCapture(event.pointerId);});
grip.addEventListener('pointermove',event=>{
  if(!resizing || event.pointerId!==resizing.pointer)return;
  const dx=(event.screenX-resizing.x)/resizing.width,dy=(event.screenY-resizing.y)/resizing.height;const ratio=Math.max(.2,1+(Math.abs(dx)>Math.abs(dy)?dx:dy));
  if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;void api.resizeAvatar(resizing.width*ratio,resizing.height*ratio).catch(error=>report(error.message));});
});
function endResize(){if(resizeFrame!==null){cancelAnimationFrame(resizeFrame);resizeFrame=null;}resizing=null;}
grip.addEventListener('pointerup',endResize);grip.addEventListener('pointercancel',endResize);grip.addEventListener('lostpointercapture',endResize);

window.addEventListener('pointerleave',()=>{if(performance.now()-lastDesktopPointer>=250)hoverInside=false;});
window.addEventListener('pointermove',event=>{if(performance.now()-lastDesktopPointer>250)mouseTracker.point(event.clientX/innerWidth*2-1,1-event.clientY/innerHeight*2);noticePointer(event.clientX,event.clientY,event.buttons);if(event.buttons===0 && lifeOptions?.noticeCursor)lifeBinding?.controller.attend((event.clientX-innerWidth/2)/(innerWidth/2),(event.clientY-innerHeight/2)/(innerHeight/2));},{passive:true});
