const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Datamappe: Dokumenter/Priskalkulator/
const DATA_DIR = path.join(app.getPath('documents'), 'Priskalkulator');
const TILBUD_DIR = path.join(DATA_DIR, 'tilbud');
const INDEX_FILE = path.join(DATA_DIR, 'tilbud_index.json');
const BACKUP_META_FILE = path.join(DATA_DIR, 'backup_meta.json');

// Opprett mapper hvis de ikke finnes
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TILBUD_DIR)) fs.mkdirSync(TILBUD_DIR, { recursive: true });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Priskalkulator – Eika Økonomi',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('priskalkulator.html');

  // Sjekk for oppdateringer etter 3 sekunder
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

// === FILE STORAGE IPC ===

// Hent indeks
ipcMain.handle('store:getIndex', () => {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
  } catch (e) { console.error('Feil ved lesing av indeks:', e); }
  return [];
});

// Lagre indeks
ipcMain.handle('store:saveIndex', (event, idx) => {
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
    return true;
  } catch (e) { console.error('Feil ved lagring av indeks:', e); return false; }
});

// Hent tilbud
ipcMain.handle('store:getTilbud', (event, id) => {
  try {
    const file = path.join(TILBUD_DIR, id + '.json');
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) { console.error('Feil ved lesing av tilbud:', e); }
  return null;
});

// Lagre tilbud
ipcMain.handle('store:saveTilbud', (event, id, data) => {
  try {
    const file = path.join(TILBUD_DIR, id + '.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) { console.error('Feil ved lagring av tilbud:', e); return false; }
});

// Slett tilbud
ipcMain.handle('store:deleteTilbud', (event, id) => {
  try {
    const file = path.join(TILBUD_DIR, id + '.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  } catch (e) { console.error('Feil ved sletting av tilbud:', e); return false; }
});

// Eksporter alle tilbud (returnerer JSON-streng)
ipcMain.handle('store:exportAll', () => {
  try {
    const idx = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : [];
    const allData = [];
    idx.forEach(e => {
      try {
        const file = path.join(TILBUD_DIR, e.id + '.json');
        if (fs.existsSync(file)) allData.push(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch (err) {}
    });
    return { _type: 'tilbudsdatabase', _exportDate: new Date().toISOString(), _count: allData.length, tilbud: allData };
  } catch (e) { return null; }
});

// Importer tilbud
ipcMain.handle('store:importAll', (event, data) => {
  try {
    if (!data || !data.tilbud) return 0;
    const idx = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : [];
    let count = 0;
    data.tilbud.forEach(t => {
      const id = t._id || ('t_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
      t._id = id;
      const file = path.join(TILBUD_DIR, id + '.json');
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(t, null, 2), 'utf8');
        if (!idx.find(e => e.id === id)) {
          idx.push({
            id: id,
            navn: t._kundeNavn || '',
            org: t._kundeOrg || '',
            mndPris: t._mndPris || 0,
            byraa: t._byraa || '',
            byraaNavn: t._byraaNavn || '',
            dato: t._savedDate ? t._savedDate.slice(0, 10) : '',
            tilbudGenerert: !!t._tilbudGenerert
          });
        }
        count++;
      }
    });
    fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
    return count;
  } catch (e) { console.error('Feil ved import:', e); return 0; }
});

// Backup-metadata
ipcMain.handle('store:getBackupMeta', () => {
  try {
    if (fs.existsSync(BACKUP_META_FILE)) return JSON.parse(fs.readFileSync(BACKUP_META_FILE, 'utf8'));
  } catch (e) {}
  return {};
});

ipcMain.handle('store:setBackupMeta', (event, meta) => {
  try {
    fs.writeFileSync(BACKUP_META_FILE, JSON.stringify(meta, null, 2), 'utf8');
    return true;
  } catch (e) { return false; }
});

// Hent datamappe-sti (for visning til bruker)
ipcMain.handle('store:getDataPath', () => {
  return DATA_DIR;
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

ipcMain.handle('app:installUpdate', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});
