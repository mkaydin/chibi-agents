const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('companion', Object.freeze({
  resizeAvatar:(width,height)=>ipcRenderer.invoke('companion:resize-avatar',width,height),
  guardNavigation: () => ipcRenderer.invoke('companion:guard-navigation'),
  performance: () => ipcRenderer.invoke('companion:performance'),
  previewViewport: bounds => ipcRenderer.invoke('companion:preview-viewport', bounds),
  importPackage: () => ipcRenderer.invoke('companion:import-package'),
  libraryAction: value => ipcRenderer.invoke('companion:library', value),
  state: () => ipcRenderer.invoke('companion:state'),
  selectTarget: id => ipcRenderer.invoke('companion:select-target', id),
  configure: value => ipcRenderer.invoke('companion:configure', value),
  connectHerdr: path => ipcRenderer.invoke('companion:connect-herdr', path),
  selectModel: () => ipcRenderer.invoke('companion:select-model'),
  selectRuntime: () => ipcRenderer.invoke('companion:select-runtime'),
  command: command => ipcRenderer.invoke('companion:command', command),
  cachedTexture:(id,index,limit)=>ipcRenderer.invoke('companion:cached-texture',id,index,limit),
  previewTexture: (id, index, bytes, limit) => ipcRenderer.invoke('companion:preview-texture', id, index, bytes, limit),
  clearPreviewTextures: id => ipcRenderer.invoke('companion:clear-preview-textures', id),
  report: payload => ipcRenderer.send('companion:report', payload),
  onEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('companion:event', listener);
    return () => ipcRenderer.removeListener('companion:event', listener);
  },
}));
