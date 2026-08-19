const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronStore', {
  // Indeks
  getIndex: () => ipcRenderer.invoke('store:getIndex'),
  saveIndex: (idx) => ipcRenderer.invoke('store:saveIndex', idx),

  // Priser pr byrå
  getPriser: () => ipcRenderer.invoke('store:getPriser'),
  savePriser: (data) => ipcRenderer.invoke('store:savePriser', data),

  // Tilbud
  getTilbud: (id) => ipcRenderer.invoke('store:getTilbud', id),
  saveTilbud: (id, data) => ipcRenderer.invoke('store:saveTilbud', id, data),
  deleteTilbud: (id) => ipcRenderer.invoke('store:deleteTilbud', id),

  // Eksport/import
  exportAll: () => ipcRenderer.invoke('store:exportAll'),
  importAll: (data) => ipcRenderer.invoke('store:importAll', data),

  // Backup-metadata
  getBackupMeta: () => ipcRenderer.invoke('store:getBackupMeta'),
  setBackupMeta: (meta) => ipcRenderer.invoke('store:setBackupMeta', meta),

  // Backup-fil til mappe
  saveBackupFile: (json) => ipcRenderer.invoke('store:saveBackupFile', json),

  // PDF til genererte tilbud-mappe
  saveTilbudPDF: (html, kundeNavn) => ipcRenderer.invoke('store:saveTilbudPDF', html, kundeNavn),

  // Datamappe-stier
  getDataPath: () => ipcRenderer.invoke('store:getDataPath'),
  getPaths: () => ipcRenderer.invoke('store:getPaths'),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  // Update events
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (e, version) => cb(version)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  onUpdateAvailableManual: (cb) => ipcRenderer.on('update-available-manual', (e, version, url) => cb(version, url)),
  downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate')
});
