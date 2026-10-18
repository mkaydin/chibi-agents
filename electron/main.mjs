import {WorkPosePool} from '../lib/work-pose.mjs';
import {installDesktopEntry} from '../lib/desktop-entry.mjs';
import {projectName} from '../lib/project-name.mjs';
import {DesktopRelay} from '../lib/desktop-relay.mjs';
import {KWinTopmost} from '../lib/kwin-topmost.mjs';
import {recoverMovedPackages} from '../lib/package-relocation.mjs';
import {textureForPreset,compatiblePresets,resolvePartPreset} from '../lib/preset-compatibility.mjs';
import {resolvePreset} from '../lib/appearance-profile.mjs';
import { readSettings,writeSettings } from '../lib/settings-store.mjs';
import { validateCharacterDocument,appearanceKey } from '../lib/draft-record.mjs';
import { pruneVariants } from '../lib/asset-cache.mjs';
import { createPreviewHost } from './preview-host.mjs';
import crypto from 'node:crypto';
import { inspectPackage, materializeTextureSet } from '../lib/character-package.mjs';
import { app, BrowserWindow, WebContentsView, ipcMain, dialog, Tray, Menu, nativeImage, screen } from 'electron';
import { readFile, writeFile, mkdir, rename, realpath, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startServer } from '../lib/server.mjs';
import { PreviewTextures } from '../lib/preview-textures.mjs';
import { graphicsConfiguration } from '../lib/graphics.mjs';
import { supportsWaylandClickThrough } from '../lib/runtime.mjs';
import { createAvatarSession } from './avatar-session.mjs';
import { HerdrAdapter, rpc, normalizeAgents } from '../lib/herdr.mjs';
import { Bindings, gatewayPath, startGateway } from '../lib/gateway.mjs';
import { expressionFor } from '../lib/animation-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), smoke = args.includes('--smoke-test');
const option = name => { const at = args.indexOf(name); return at < 0 ? null : args[at + 1]; };
const nativeWayland = process.platform === 'linux' && args.includes('--native-wayland');
if (process.platform === 'linux') app.commandLine.appendSwitch('ozone-platform', nativeWayland ? 'wayland' : 'x11');
const graphics = graphicsConfiguration(args, process.env);
for (const [name, value] of graphics.switches) app.commandLine.appendSwitch(name, value);
app.setName('Companion Studio');
if(process.platform==='linux')app.setDesktopName('companion-studio.desktop');
app.setPath('userData', process.env.COMPANION_DATA_DIR || join(app.getPath('appData'), 'ayla-companions'));
if (app.commandLine.hasSwitch('no-sandbox')) app.exit(64);
if (!app.requestSingleInstanceLock()) app.exit(0);
const configPath = join(app.getPath('userData'), 'settings.json');
const models = new Map(), sessions = new Map(), previewTextures = new PreviewTextures(), bindings = new Bindings();
const appIconPath=join(root,'live2d-assets/Type-H1_v2.0/Type-H1/icon.png');
let appIcon;
let controls, server, tray, corePath, adapter, gateway, selectedId = 'studio', settings = {}, agentRecords = [], syncChain = Promise.resolve(), saveChain = Promise.resolve();
const textureKeys=new Map(),workPoses=new WorkPosePool();
let recoveryFolder,alternateIdle;
let cursorTimer,recoveredDraft=null,libraryTask=null;
let topmostStatus={backend:nativeWayland?'wayland':'electron',active:!nativeWayland,error:null};
const desktopRelay=new DesktopRelay({script:join(root,'scripts/desktop-relay.py'),onEvent:event=>{if(event.type==='relay-error'){topmostController.bridgeError=event.message;topmostStatus={...topmostStatus,error:event.message};publish();return;}for(const session of sessions.values())if(session.desktopTitle===event.title){if(event.type==='geometry')session.desktopGeometry(event);else session.desktopPointer(event);}}});
const topmostController=new KWinTopmost({relay:desktopRelay,getPids:()=>[process.pid,...app.getAppMetrics().map(m=>m.pid)],enabled:nativeWayland && /kde/i.test(process.env.XDG_CURRENT_DESKTOP || ''),onStatus:value=>{topmostStatus=value;if(value.error)console.error(value.error);publish();}});
let connection = { connected: false, error: null, path: '' };
const defaults = { graphicsMode: graphics.mode, electronVersion: process.versions.electron, clickThroughSupported: !nativeWayland || supportsWaylandClickThrough(process.versions.electron), scale: 1, fps: 30, alwaysOnTop: true, clickThrough: false, visible: true };
const selected = () => sessions.get(selectedId) || sessions.get('studio');
const snapshot = () => ({ ...selected()?.snapshot(), selectedId, libraryTask, libraryRevision:settings.libraryRevision || 0, library: settings.packages || [], characters: settings.characters || [], defaultCharacterId: settings.defaultCharacterId, embeddedPreview:!args.includes('--desktop-preview'), previewLoaded:Boolean(sessions.get('studio')?.current), recoveredDraft:Boolean(recoveredDraft), previewBackground:settings.previewBackground || 'solid', preferences:settings.rendering || {textureLimit:4096,fps:30}, targets: [...sessions.values()].map(s => ({ id: s.id, label: s.state.label, status: s.snapshot().agentStatus,project:s.state.project,kind:s.state.agentKind,pane:s.state.pane })), herdr: connection, agentCount: agentRecords.length, hasAppIcon:Boolean(appIcon),topmostStatus,inferActivity:settings.inferActivity!==false });
function publish() { if (controls && !controls.isDestroyed()) controls.webContents.send('companion:event', { type: 'state', state: snapshot() }); }
function save() {
  settings.corePath = corePath;const savedStudio=sessions.get('studio')?.savedPreferences();if(savedStudio)settings.modelPath=savedStudio.modelPath || null;
  const studio=sessions.get('studio');
  if(studio){settings.studio=studio.savedPreferences();settings.studioDraft=studio.snapshot().dirty?studio.preferences():recoveredDraft;}
  settings.assignments ||= {};
  for (const agent of agentRecords) { const s = sessions.get(agent.id); if (s) settings.assignments[preferenceKey(agent)] = s.preferences(); }
  const data = JSON.stringify(settings, null, 2);
  saveChain = saveChain.catch(() => {}).then(async () => { await writeSettings(configPath,data); });
  return saveChain;
}
const variantRoot=()=>join(app.getPath('userData'),'character-variants');
async function pruneCache(){return pruneVariants(variantRoot(),[...sessions.values()].flatMap(s=>[s.current?.path,s.pending?.model.path,s.requestedPath,s.savedPreferences().modelPath]),1024*1024*1024);}
async function resolvePreferences(preferences){
  const copy=structuredClone(preferences),asset=copy.sourceAsset;if(!asset)return copy;
  const record=settings.packages.find(p=>p.id===asset.packageId) || {path:asset.sourcePath,root:asset.root};
  const current=(await inspectPackage(record.root || dirname(dirname(record.path)))).find(p=>p.path===record.path);
  if(!current)throw new Error('Character base files are missing. Relink the package folder.');
  if(asset.fingerprint && asset.fingerprint!==current.fingerprint)throw new Error('Character base changed. Refresh or relink its package explicitly.');
  copy.modelPath=await materializeTextureSet(current,asset.textureSet || '',variantRoot());copy.sourceAsset={...asset,sourcePath:current.path,root:current.root,fingerprint:current.fingerprint};return copy;
}
function preferenceKey(agent) { return JSON.stringify([connection.path, agent.pane, agent.kind, agent.cwd]); }
function sessionFor(event) {
  if (!event.senderFrame?.url.startsWith(server.origin + '/')) throw new Error('Untrusted renderer');
  if (event.sender === controls?.webContents) return selected();
  const s = [...sessions.values()].find(s => s.avatar.webContents === event.sender);
  if (!s) throw new Error('Unknown avatar renderer'); return s;
}
function controlOnly(event) { sessionFor(event); if (event.sender !== controls.webContents) throw new Error('Controls required'); }
function createWindow(page, opts) {
  const win = new BrowserWindow({ ...(appIcon?{icon:appIcon}:{}),...opts, show: false, webPreferences: { preload: join(root, 'electron/preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: page !== 'avatar' } });
  if(page==='avatar')win.on('page-title-updated',event=>event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(server.origin + '/')) event.preventDefault(); });
  win.webContents.on('console-message', (event) => { console.log(`[${page}] ${event.message}`); });
  return win;
}

function createEmbeddedPreview() {
  const view=new WebContentsView({webPreferences:{preload:join(root,'electron/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  view.setBackgroundColor('#202434');
  view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  view.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(server.origin+'/'))event.preventDefault();});
  view.webContents.on('console-message',event=>console.log('[preview]',event.message));
  return createPreviewHost(controls,view);
}
async function addSession(id, label, preferences = {}) {
  if (!preferences.modelPath && settings.defaultCharacterId) preferences = { ...settings.characters?.find(c=>c.id===settings.defaultCharacterId)?.preferences, ...preferences };
  const s = createAvatarSession({ id, label, defaults: { ...defaults, ...(settings.rendering || {}), ...preferences, savedBaseline:id==='studio'?settings.studio:undefined }, shared: { root, args, smoke, models, previewTextures, area: screen.getPrimaryDisplay().workArea, createWindow: id==='studio' && !args.includes('--desktop-preview') ? createEmbeddedPreview : createWindow, origin: server.origin, getCore: () => corePath, topmostController, nextWorkPose:()=>workPoses.next(), nativeWayland, displays:()=>screen.getAllDisplays().map(d=>d.workArea), recoveryFolder, alternateIdle, isQuitting: () => app.isQuitting }, position: sessions.size, onChange: publish, persist: save });
  sessions.set(id, s); await s.ready;
  let path = preferences.modelPath || settings.modelPath;
  if(preferences.sourceAsset){try{const resolved=await resolvePreferences(preferences);path=resolved.modelPath;s.state.sourceAsset=resolved.sourceAsset;}catch(error){s.state.error=error.message;console.error(`[avatar] ${label}: ${error.message}`);publish();return s;}}
  if (corePath && path) { try { await s.importModel(path,{appearance:preferences.appearance || {}}); } catch (error) { console.error(`[avatar] ${label}: ${error.message}`); } }
  if(id==='studio'){s.avatar.setBackground?.(settings.previewBackground || 'solid');s.avatar.webContents.send('companion:event',{type:'command',command:{type:'preview-background',value:settings.previewBackground || 'solid'}});}
  publish(); return s;
}
async function synchronize(agents) {
  await Promise.all(agents.map(async agent=>{if(!agent.project)agent.project=await projectName(agent.cwd);}));
  const previousAgents=agentRecords;agentRecords = agents; bindings.reconcile(agents);
  const ids = new Set(agents.map(item => item.id));
  for (const [id, s] of sessions) if (id !== 'studio' && !ids.has(id)) { const previous=previousAgents.find(a=>a.id===id);if(previous){settings.assignments ||= {};settings.assignments[preferenceKey(previous)]=s.preferences();}s.destroy(); sessions.delete(id); if (selectedId === id) selectedId = 'studio'; }
  for (const agent of agents) {
    let s = sessions.get(agent.id);
    if (!s) s = await addSession(agent.id, `${agent.label} · ${agent.pane}`, settings.assignments?.[preferenceKey(agent)] || {});
    s?.setAgent(agent);
  }
  if(previousAgents.some(a=>!ids.has(a.id)))await save();
  publish();
}
function connectHerdr(path) {
  if (typeof path !== 'string' || !path || path.length > 1024) throw new Error('Select a valid Herdr socket path');
  adapter?.stop(); bindings.tokens.clear(); settings.herdrPath = path; connection = { path, connected: false, error: null };
  const next = new HerdrAdapter(path,rpc,{inferOutput:settings.inferActivity!==false}); adapter = next;
  next.on('status', value => {
    if (adapter !== next) return; connection = value;
    if (!value.connected) for (const [id, s] of sessions) if (id !== 'studio') s.setAgent({ label: s.state.label, status: 'disconnected' });
    publish();
  });
  next.on('activity',signal=>{if(adapter===next)sessions.get(signal.id)?.activity(signal.activity,signal.source);});
  next.on('agents', agents => { if (adapter === next) syncChain = syncChain.catch(error => console.error(error.message)).then(() => { if (adapter === next) return synchronize(agents); }); });
  next.start(); publish(); void save();
}
async function handleGateway(request) {
  if (!connection.connected || !adapter) throw new Error('Herdr is disconnected');
  // Resolve against an authoritative current snapshot before every binding/use.
  const result = await rpc(connection.path, 'session.snapshot');
  const live = normalizeAgents(result.snapshot, connection.path);
  if (request.method === 'register') {
    if (request.herdr !== connection.path) throw new Error('MCP bridge and desktop must use the same Herdr socket');
    const agent = live.find(item => item.pane === request.pane); if (!agent) throw new Error('No recognized agent in this pane');
    if (!agent.session) throw new Error('Herdr has not reported a stable agent session identity yet; enable the agent integration and retry');
    return { token: bindings.register(agent) };
  }
  if(request.method==='unregister'){bindings.tokens.delete(request.token);return {accepted:true};}
  if (request.method !== 'call') throw new Error('Unknown command');
  const agent = bindings.resolve(request.token, live), s = sessions.get(agent.id);
  if (!s) throw new Error('Avatar not instantiated; select a model or increase the visible-agent allocation');
  const a = request.arguments || {};
  if (request.tool === 'avatar_capabilities') return { model: s.current?.name || null, expressions: s.current?.expressions.filter(e=>e.kind!=='appearance' && e.supported!==false).map(e => e.name) || [], motions: s.current?.motions || [], actions: ['celebrate','greet','sad','working','thinking','reading','searching','editing','testing','running','done','error','blocked','idle'].filter(()=>Boolean(s.current)) };
  if (request.tool === 'avatar_status') return { pane: agent.pane, status: agent.status, model: s.current?.name || null, visible: s.state.visible };
  if (request.tool === 'avatar_reset') { s.reset(); return { accepted: true }; }
  if (request.tool === 'avatar_animate') return s.animate(a.action, a.duration_ms ?? 3000);
  if (request.tool === 'avatar_message') return s.command({ type: 'message', text: a.text, lifetime: a.duration_ms });
  throw new Error('Unknown avatar tool');
}
async function start() {
  const image=nativeImage.createFromPath(appIconPath);if(!image.isEmpty())appIcon=image;else console.error('[icon] Local Type-H1 icon is unavailable');
  if(appIcon && process.platform==='linux')try{await installDesktopEntry(join(process.env.XDG_DATA_HOME || join(homedir(),'.local/share'),'applications/companion-studio.desktop'),{root,icon:appIconPath,node:process.env.npm_node_execpath || 'node',nativeWayland,graphics:graphics.mode});}catch(error){console.error(`[icon] Desktop entry: ${error.message}`);}

  settings=await readSettings(configPath);
  for(const move of await recoverMovedPackages(settings,join(root,'live2d-assets')))console.log(`[library] Recovered moved package: ${move.from} → ${move.to}`);
  const localRecovery=join(root,'live2d-assets/older-versions/Type-H1_v1.4/Type-H1_v1.4/Type-H1_v1.4/Expressions');
  try{await stat(localRecovery);recoveryFolder=localRecovery;}catch{}
  try{const path=join(root,'live2d-assets/older-versions/Type-H1_v1.1/Motions/idle copy.motion3.json');await stat(path);alternateIdle=path;}catch{}
  recoveredDraft=settings.studioDraft;
  corePath = option('--core') || process.env.LIVE2D_CORE_PATH || settings.corePath;
  const modelOverride=option('--model') || process.env.LIVE2D_MODEL_PATH;if(modelOverride){settings.modelPath=modelOverride;settings.studio={...(settings.studio || {}),modelPath:modelOverride,appearance:{},appearancePreset:'',sourceAsset:null};}
  server = await startServer({ webRoot: join(root,'web'), models, previewTextures, getCorePath: () => corePath,getAppIconPath:()=>appIcon?appIconPath:null });
  controls = createWindow('control', { width: 1180, height: 850, minWidth: 820, minHeight: 620, title: 'Companion Studio', backgroundColor: '#10131d', autoHideMenuBar: true });
  ipcMain.handle('companion:state', event => event.sender === controls.webContents ? (controlOnly(event), snapshot()) : sessionFor(event).snapshot());
  ipcMain.handle('companion:resize-avatar',(event,width,height)=>{const session=sessionFor(event);if(event.sender===controls.webContents)throw new Error('Avatar renderer required');return session.command({type:'resize-window',width,height});});
  ipcMain.handle('companion:preview-viewport',(event,bounds)=>{controlOnly(event);sessions.get('studio')?.avatar.viewport?.(bounds);});
  ipcMain.handle('companion:command', async (event,value)=>{controlOnly(event);if(libraryTask)throw new Error('Wait for preset thumbnails to finish');
    if(value?.type==='revert-appearance' && selected().savedPreferences().modelPath){await selected().restorePreferences(await resolvePreferences(selected().savedPreferences()),{checkpoint:true});return {accepted:true};}
    return selected().command(value);
  });
  ipcMain.handle('companion:performance',async event=>{
    controlOnly(event);const results=await Promise.all([...sessions.values()].map(async session=>({id:session.id,...await session.avatar.webContents.executeJavaScript('window.samplePerformance()')})));
    const report={timestamp:new Date().toISOString(),graphics:await app.getGPUInfo('basic'),features:app.getGPUFeatureStatus(),processes:app.getAppMetrics(),sessions:results};
    await mkdir(join(root,'artifacts'),{recursive:true});await writeFile(join(root,'artifacts/performance.json'),JSON.stringify(report,null,2));return report;
  });
  ipcMain.handle('companion:guard-navigation',async event=>{controlOnly(event);const studio=sessions.get('studio');if(libraryTask)return false;if(!studio?.snapshot().dirty)return true;
    const result=await dialog.showMessageBox(controls,{type:'question',title:'Unsaved character draft',message:'Keep the changes to your studio character?',detail:'Save stores this draft in your local workspace. Saved library characters change only when you save over them explicitly.',buttons:['Save workspace','Discard changes','Cancel'],defaultId:0,cancelId:2});
    if(result.response===2)return false;if(result.response===0){studio.checkpoint();await save();}else await studio.discard();return true;
  });
  ipcMain.handle('companion:select-target',(event,id)=>{controlOnly(event);if(!sessions.has(id))throw new Error('Unknown agent');selectedId=id;publish();});
  ipcMain.handle('companion:configure',async(event,value)=>{controlOnly(event);if(libraryTask)throw new Error('Wait for preset previews');const target=selected();target.configure(value);if(value.idleMotion!==undefined && target.current){const editor=target.captureEditor();await target.importModel(target.current.path,{appearance:target.state.appearance});await target.restoreEditor(editor);}});
  ipcMain.handle('companion:connect-herdr', (event, path) => { controlOnly(event); connectHerdr(path); });
  ipcMain.handle('companion:import-package', async event => {
    controlOnly(event);
    const result = await dialog.showOpenDialog(controls, { title:'Import customizable Live2D package folder', properties:['openDirectory'] });
    if(result.canceled)return {canceled:true};
    const records=await inspectPackage(result.filePaths[0]);
    settings.packages=[...(settings.packages || []).filter(p=>!records.some(r=>r.id===p.id)),...records];
    settings.libraryRevision=(settings.libraryRevision || 0)+1;await save(); publish(); return {ok:true};
  });
  ipcMain.handle('companion:library', async (event,value) => {
    controlOnly(event);if(libraryTask){if(value?.type==='cancel-thumbnails'){libraryTask.cancel=true;return {ok:true};}throw new Error('Preset thumbnails are being generated');} if(!value || typeof value!=='object')throw new Error('Invalid library action');
    const target=selected();
    if(value.type==='herdr-inference'){if(typeof value.enabled!=='boolean')throw new Error('Invalid activity inference setting');settings.inferActivity=value.enabled;if(connection.path)connectHerdr(connection.path);
    } else if(value.type==='recover-mouse-motions'){
      const result=await dialog.showOpenDialog(controls,{title:'Select legacy Expressions folder containing MouseL_ON.motion3.json',properties:['openDirectory']});
      if(result.canceled)return {canceled:true};await target.recoverMouseMotions(result.filePaths[0]);
    } else if(value.type==='remove-recovered-motions'){await target.recoverMouseMotions(null);
    } else if(value.type==='preset-thumbnails') {
      const record=settings.packages.find(p=>p.id===value.id);if(!record)throw new Error('Unknown package');
      const studio=sessions.get('studio'),editor=studio.captureEditor();libraryTask={message:'Preparing preset previews…',done:0,total:record.presets.length,cancel:false};publish();
      try{
        const current=(await inspectPackage(record.root || dirname(dirname(record.path)))).find(p=>p.path===record.path);
        if(!current || (record.fingerprint && record.fingerprint!==current.fingerprint))throw new Error('Refresh the package before generating previews');
        record.presetThumbnails ||= {};
        for(const preset of record.presets){
          if(libraryTask.cancel)break;libraryTask.message=`Previewing ${preset}`;publish();
          const textureSet=current.textureSets.find(t=>t.id===preset)?.id || '';
          const path=await materializeTextureSet(current,textureSet,variantRoot());await studio.importModel(path,{preset});
          await new Promise(resolve=>setTimeout(resolve,120));await studio.avatar.webContents.executeJavaScript('window.renderDiagnostic()');
          const image=await studio.avatar.webContents.capturePage(undefined,{stayHidden:true});if(!image.isEmpty())record.presetThumbnails[preset]=image.resize({height:180}).toDataURL();
          libraryTask.done++;settings.libraryRevision=(settings.libraryRevision || 0)+1;publish();
        }
      }finally{try{await studio.restoreEditor(editor);}finally{libraryTask=null;publish();}}
    } else if(value.type==='load-package') {
      const record=settings.packages?.find(p=>p.id===value.id);if(!record)throw new Error('Unknown package');
      const refreshed=(await inspectPackage(record.root || dirname(dirname(record.path)))).find(p=>p.path===record.path);
      if(!refreshed)throw new Error('Package model is missing; use Relink folder');
      if(record.fingerprint && record.fingerprint!==refreshed.fingerprint && !value.acceptChanges)throw new Error('Package files changed. Use Refresh package before loading the updated model.');
      Object.assign(record,refreshed,{id:record.id});
      const compatibleTexture=value.preset?textureForPreset(refreshed,value.preset):'';
      if(value.textureSet && value.textureSet!==compatibleTexture)throw new Error('Choose a complete look with matching artwork');
      const path=await materializeTextureSet(refreshed,compatibleTexture,variantRoot());
      await target.importModel(path,{preset:value.preset});
      target.state.sourceAsset={packageId:record.id,sourcePath:record.path,root:record.root,fingerprint:refreshed.fingerprint,textureSet:compatibleTexture,lookPreset:value.preset || ''};

    } else if(value.type==='part-preset') {
      const asset=target.state.sourceAsset,record=settings.packages.find(p=>p.id===asset?.packageId);if(!record || !target.current)throw new Error('Choose a complete package look first');
      if(!compatiblePresets(record,asset.textureSet).includes(value.preset))throw new Error('This preset uses different artwork and cannot be mixed with the current look');
      const values=resolvePartPreset(record,value.preset,value.part,target.current,target.state.parameters,resolvePreset);target.command({type:'appearance',values});
    } else if(value.type==='save-character') {
      if(target.pending)throw new Error('Wait for the character to finish loading');if(!target.current)throw new Error('Load a base model first');
      const name=String(value.name || '').trim().slice(0,80);if(!name)throw new Error('Enter a character name');
      settings.characters ||= [];
      const existing=value.id && settings.characters.find(c=>c.id===value.id);
      if(value.id && !existing)throw new Error('Saved character no longer exists');
      const preferences=structuredClone(target.preferences());let thumbnail=existing?.thumbnail;
      try {
        await target.avatar.webContents.executeJavaScript('window.renderDiagnostic()');
        const image=await target.avatar.webContents.capturePage(undefined,{stayHidden:true});
        if(!image.isEmpty())thumbnail=image.resize({height:240}).toDataURL();
      } catch(error) {console.error('[thumbnail]',error.message);}
      const unchanged=JSON.stringify(preferences)===JSON.stringify(target.preferences());
      const record={id:existing?.id || crypto.randomUUID(),name,preferences,thumbnail:unchanged?thumbnail:existing?.thumbnail};
      if(existing)Object.assign(existing,record);else settings.characters.push(record);
      if(unchanged)target.checkpoint(record.id);
    } else if(value.type==='apply-character') {
      const record=settings.characters?.find(c=>c.id===value.id);if(!record)throw new Error('Unknown character');
      await target.restorePreferences({...await resolvePreferences(record.preferences),characterId:record.id},{checkpoint:true});
    } else if(value.type==='edit-character') {
      const record=settings.characters?.find(c=>c.id===value.id);if(!record)throw new Error('Unknown character');
      const studio=sessions.get('studio');recoveredDraft=null;selectedId='studio';await studio.restorePreferences({...await resolvePreferences(record.preferences),characterId:record.id},{checkpoint:true});
    } else if(value.type==='save-draft') {
      if(!target.current)throw new Error('Load a character first');
      target.checkpoint();
    } else if(value.type==='restore-draft') {
      if(!recoveredDraft)throw new Error('No recovered draft');selectedId='studio';await sessions.get('studio').restorePreferences(await resolvePreferences(recoveredDraft));recoveredDraft=null;
    } else if(value.type==='discard-recovered-draft') {recoveredDraft=null;settings.studioDraft=null;
    } else if(value.type==='refresh-package' || value.type==='relink-package') {
      const record=settings.packages?.find(p=>p.id===value.id);if(!record)throw new Error('Unknown package');
      let root=record.root || dirname(dirname(record.path));
      if(value.type==='relink-package') {const result=await dialog.showOpenDialog(controls,{title:'Relink base package folder',properties:['openDirectory']});if(result.canceled)return {canceled:true};root=result.filePaths[0];}
      const records=await inspectPackage(root),replacement=records.find(r=>r.name===record.name);
      if(!replacement)throw new Error('The selected folder has no matching base model');
      for(const character of settings.characters || [])if(character.preferences.sourceAsset?.packageId===record.id){character.preferences.sourceAsset={...character.preferences.sourceAsset,sourcePath:replacement.path,root:replacement.root,fingerprint:replacement.fingerprint};}
      const asset={sourcePath:replacement.path,root:replacement.root,fingerprint:replacement.fingerprint};
      for(const prefs of [settings.studio,settings.studioDraft,recoveredDraft,...Object.values(settings.assignments || {})])if(prefs?.sourceAsset?.packageId===record.id)Object.assign(prefs.sourceAsset,asset);
      for(const session of sessions.values())session.relinkAsset(record.id,asset);
      Object.assign(record,replacement,{id:record.id});
    } else if(value.type==='export-character') {
      const record=settings.characters?.find(c=>c.id===value.id);if(!record)throw new Error('Unknown character');
      const result=await dialog.showSaveDialog(controls,{title:'Export character settings only',defaultPath:'character.json',filters:[{name:'Character settings',extensions:['json']}]});
      if(!result.canceled)await writeFile(result.filePath,JSON.stringify({schemaVersion:1,name:record.name,preferences:record.preferences},null,2));
    } else if(value.type==='import-character') {
      const result=await dialog.showOpenDialog(controls,{title:'Import character settings',properties:['openFile'],filters:[{name:'Character settings',extensions:['json']}]});if(result.canceled)return {canceled:true};
      if((await stat(result.filePaths[0])).size>1024*1024)throw new Error('Character settings file is too large');
      const record=validateCharacterDocument(JSON.parse(await readFile(result.filePaths[0],'utf8')));if(record.preferences.sourceAsset && !settings.packages.some(p=>p.id===record.preferences.sourceAsset.packageId)){const compatible=settings.packages.find(p=>p.fingerprint===record.preferences.sourceAsset.fingerprint);if(!compatible)throw new Error('Import the matching base package before importing these character settings');record.preferences.sourceAsset={...record.preferences.sourceAsset,packageId:compatible.id,sourcePath:compatible.path,root:compatible.root};}record.preferences=await resolvePreferences(record.preferences);await import('../lib/model-library.mjs').then(m=>m.inspectModel(record.preferences.modelPath));
      settings.characters.push({...record,id:crypto.randomUUID()});
    } else if(value.type==='relink-character') {
      const record=settings.characters.find(c=>c.id===value.id);if(!record)throw new Error('Unknown character');
      const result=await dialog.showOpenDialog(controls,{title:'Relink character to a local model manifest',properties:['openFile'],filters:[{name:'Cubism model manifest',extensions:['json']}]});if(result.canceled)return {canceled:true};
      await import('../lib/model-library.mjs').then(m=>m.inspectModel(result.filePaths[0]));record.preferences.modelPath=result.filePaths[0];record.preferences.sourceAsset=null;
    } else if(value.type==='remove-character') {
      settings.characters=settings.characters.filter(c=>c.id!==value.id);if(settings.defaultCharacterId===value.id)settings.defaultCharacterId=null;
    } else if(value.type==='preview-background') {
      if(!['solid','checkerboard','transparent'].includes(value.value))throw new Error('Unknown preview background');settings.previewBackground=value.value;
      sessions.get('studio')?.avatar.setBackground?.(value.value);sessions.get('studio')?.avatar.webContents.send('companion:event',{type:'command',command:{type:'preview-background',value:value.value}});
    } else if(value.type==='render-settings') {
      if(![2048,4096,8192].includes(value.textureLimit) || ![15,30,60].includes(value.fps))throw new Error('Invalid rendering settings');
      settings.rendering={textureLimit:value.textureLimit,fps:value.fps};
      for(const session of sessions.values()){session.state.textureLimit=value.textureLimit;session.command({type:'fps',value:value.fps});session.avatar.webContents.send('companion:event',{type:'command',command:{type:'texture-quality',value:value.textureLimit}});}
    } else if(value.type==='clear-cache') {await pruneCache();
    } else if(value.type==='duplicate-character') {
      const record=settings.characters?.find(c=>c.id===value.id);if(!record)throw new Error('Unknown character');
      settings.characters.push({...structuredClone(record),id:crypto.randomUUID(),name:`${record.name} copy`.slice(0,80)});
    } else if(value.type==='default-character') {
      if(!settings.characters?.some(c=>c.id===value.id))throw new Error('Unknown character');settings.defaultCharacterId=value.id;
    } else throw new Error('Unknown library action');
    settings.libraryRevision=(settings.libraryRevision || 0)+1;await save();await pruneCache();publish();return {ok:true};
  });
  ipcMain.handle('companion:select-model', async event => {
    controlOnly(event); const target = selected();
    const result = await dialog.showOpenDialog(controls, { title: 'Select local Live2D model', filters: [{ name: 'Cubism manifest', extensions: ['json'] }], properties: ['openFile'] });
    if (result.canceled) return { canceled: true };
    try { await target.importModel(result.filePaths[0]); return { ok: true }; } catch (error) { return { error: error.message }; }
  });
  ipcMain.handle('companion:select-runtime', async event => {
    controlOnly(event);
    if ([...sessions.values()].some(s => s.pending)) return { error: 'Wait for model loading to finish' };
    const result = await dialog.showOpenDialog(controls, { filters: [{ name: 'Trusted Cubism runtime', extensions: ['js'] }], properties: ['openFile'] });
    if (result.canceled) return { canceled: true };
    try {
      const file = await realpath(result.filePaths[0]); if (!file.endsWith('.js') || (await stat(file)).size > 8*1024*1024) throw new Error('Invalid runtime'); corePath = file;
      for (const s of sessions.values()) { await s.avatar.loadURL(`${server.origin}/avatar.html`); if (s.current) await s.importModel(s.current.path); }
      await save(); publish(); return { ok: true };
    } catch (error) { return { error: error.message }; }
  });
  async function textureKey(event,id,index,limit){
    const s=sessionFor(event),model=models.get(id);
    if(event.sender===controls.webContents || s.pending?.model.id!==id || !Number.isInteger(index) || index<0 || !model?.manifest.FileReferences.Textures[index] || !Number.isFinite(limit) || limit<1 || limit>16384)throw new Error('Invalid texture owner or quality');
    const path=model.allowed.get(model.manifest.FileReferences.Textures[index]),info=await stat(path),sourceKey=`${path}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
    if(!textureKeys.has(sourceKey)){textureKeys.set(sourceKey,crypto.createHash('sha256').update(await readFile(path)).digest('hex'));if(textureKeys.size>256)textureKeys.delete(textureKeys.keys().next().value);}
    return `${textureKeys.get(sourceKey)}:${limit}`;
  }
  ipcMain.handle('companion:cached-texture',async(event,id,index,limit)=>previewTextures.reuse(id,index,await textureKey(event,id,index,limit)));
  ipcMain.handle('companion:preview-texture', async(event, id, index, bytes, limit) => {
    const s = sessionFor(event); if (event.sender === controls.webContents || s.pending?.model.id !== id || !models.get(id)?.manifest.FileReferences.Textures[index]) throw new Error('Invalid texture owner'); return previewTextures.store(id,index,bytes,await textureKey(event,id,index,limit));
  });
  ipcMain.handle('companion:clear-preview-textures', (event,id) => { const s=sessionFor(event); if (event.sender === controls.webContents || (s.current?.id !== id && s.pending?.model.id !== id)) return; previewTextures.clear(id); });
  ipcMain.on('companion:report', (event,payload) => { const s=sessionFor(event); if (event.sender === controls.webContents) return; s.report(payload); if (payload?.type==='graphics-info') console.log('[graphics]',JSON.stringify(payload.info)); });
  await controls.loadURL(`${server.origin}/control.html`); if (!smoke) controls.show();
  await addSession('studio','Preview studio',{ scale: settings.scale || 1, fps: settings.fps || 30, ...settings.studio });
  if(!nativeWayland){let lastPoint;cursorTimer=setInterval(()=>{
    const active=[...sessions.values()].filter(s=>!s.avatar.embedded && (s.state.life?.noticeCursor || s.state.life?.hoverNotice || ['auto','keyboard-half'].includes(s.state.life?.poseMode)) && s.state.life.mode!=='still' && s.avatar.isVisible());if(!active.length)return;
    const point=screen.getCursorScreenPoint();if(lastPoint && Math.hypot(point.x-lastPoint.x,point.y-lastPoint.y)<2)return;lastPoint=point;
    for(const session of active){const bounds=session.avatar.getBounds(),x=(point.x-bounds.x-bounds.width/2)/(bounds.width/2),y=(point.y-bounds.y-bounds.height/2)/(bounds.height/2);const displays=screen.getAllDisplays().map(d=>d.bounds),left=Math.min(...displays.map(d=>d.x)),top=Math.min(...displays.map(d=>d.y));const display={x:left,y:top,width:Math.max(...displays.map(d=>d.x+d.width))-left,height:Math.max(...displays.map(d=>d.y+d.height))-top};session.desktopPointer({x:point.x-bounds.x,y:point.y-bounds.y,nx:(point.x-display.x)/display.width*2-1,ny:1-(point.y-display.y)/display.height*2});if(session.state.life.noticeCursor && Math.abs(x)<1.5&&Math.abs(y)<1.5)session.avatar.webContents.send('companion:event',{type:'command',command:{type:'attention',x,y}});}
  },100);cursorTimer.unref();}
  await pruneCache();
  if (smoke) {
    const s = selected(); if (!s.current) throw new Error('Smoke test requires a local model/runtime');
    const pixels=await s.avatar.webContents.executeJavaScript('window.renderDiagnostic()'); if (!pixels.visible || pixels.contextLost) throw new Error('No visible model pixels'); console.log(JSON.stringify(pixels)); app.quit(); return;
  }
  const bitmap=Buffer.alloc(24*24*4); for(let i=0;i<bitmap.length;i+=4) bitmap.set([255,160,166,255],i);
  tray=new Tray(appIcon?appIcon.resize({width:24,height:24,quality:'best'}):nativeImage.createFromBitmap(bitmap,{width:24,height:24}));
  tray.setToolTip('Companion Studio · Desktop agents');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Companion Studio',click:()=>{controls.show();controls.focus();}},{label:'Toggle selected avatar click-through',click:()=>{try{selected().command({type:'click-through',value:!selected().state.clickThrough});}catch(error){console.error(error.message);}}},{label:'Quit',click:()=>app.quit()}]));
  controls.on('close',event=>{if(!app.isQuitting){event.preventDefault();controls.hide();}});
  try { gateway=await startGateway(gatewayPath(),handleGateway); console.log('[MCP] Local command socket:',gatewayPath()); } catch(error){ console.error('[MCP]',error.message); }
  if (!args.includes('--no-herdr')) connectHerdr(option('--herdr-socket') || process.env.HERDR_SOCKET_PATH || settings.herdrPath || join(process.env.XDG_CONFIG_HOME || join(homedir(),'.config'),'herdr/herdr.sock'));
}
app.on('second-instance',()=>{controls?.show();controls?.focus();});
let finalQuit=false;
app.on('before-quit',event=>{
  if(finalQuit)return;event.preventDefault();if(app.isQuitting)return;app.isQuitting=true;clearInterval(cursorTimer);if(libraryTask)libraryTask.cancel=true;adapter?.stop();
  const pendingSave=save();for(const session of sessions.values())session.destroy();
  void Promise.allSettled([pendingSave,gateway?.close(),server?.close(),topmostController.stop()]).then(()=>{finalQuit=true;app.quit();});
});
app.whenReady().then(start).catch(error=>{console.error(error.stack);if(!smoke)dialog.showErrorBox('Companions startup failed',error.message);app.exit(1);});
