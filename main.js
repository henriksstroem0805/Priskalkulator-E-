const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Datamappe: Dokumenter/Priskalkulator/
const DATA_DIR = path.join(app.getPath('documents'), 'Priskalkulator');
const TILBUD_DIR = path.join(DATA_DIR, 'genererte tilbud');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const INDEX_FILE = path.join(DATA_DIR, 'tilbud_index.json');
const BACKUP_META_FILE = path.join(DATA_DIR, 'backup_meta.json');

// Opprett mapper hvis de ikke finnes
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TILBUD_DIR)) fs.mkdirSync(TILBUD_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // Migrer fra gammel "tilbud"-mappe hvis den finnes
  var oldDir = path.join(DATA_DIR, 'tilbud');
  if (fs.existsSync(oldDir) && oldDir !== TILBUD_DIR) {
    try {
      var files = fs.readdirSync(oldDir);
      files.forEach(function(f) {
        var src = path.join(oldDir, f);
        var dest = path.join(TILBUD_DIR, f);
        if (!fs.existsSync(dest)) fs.renameSync(src, dest);
      });
      if (fs.readdirSync(oldDir).length === 0) fs.rmdirSync(oldDir);
    } catch(e) { console.error('Migreringsfeil:', e); }
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Priskalkulator – Eika Økonomi',
    autoHideMenuBar: true,
    menuBarVisible: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Fjern menylinje helt
  mainWindow.setMenu(null);

  mainWindow.loadFile('priskalkulator.html');

  // Sjekk for oppdateringer etter 3 sekunder
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
}

// Automatisk backup ved oppstart (maks én per dag)
function autoBackup() {
  try {
    if (!fs.existsSync(INDEX_FILE)) return;
    const idx = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    if (idx.length === 0) return;

    const d = new Date();
    const dato = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const backupFile = path.join(BACKUP_DIR, 'auto_backup_' + dato + '.json');

    // Kun én auto-backup per dag
    if (fs.existsSync(backupFile)) return;

    const allData = [];
    idx.forEach(e => {
      try {
        const file = path.join(TILBUD_DIR, e.id + '.json');
        if (fs.existsSync(file)) allData.push(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch (err) {}
    });

    const json = JSON.stringify({ _type: 'tilbudsdatabase', _exportDate: new Date().toISOString(), _count: allData.length, tilbud: allData }, null, 2);
    fs.writeFileSync(backupFile, json, 'utf8');
    fs.writeFileSync(BACKUP_META_FILE, JSON.stringify({ siste_backup: new Date().toISOString() }, null, 2), 'utf8');
    console.log('Auto-backup lagret:', backupFile);

    // Slett backuper eldre enn 30 dager
    const files = fs.readdirSync(BACKUP_DIR);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    files.forEach(f => {
      if (f.startsWith('auto_backup_')) {
        const filePath = path.join(BACKUP_DIR, f);
        try {
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs < cutoff) { fs.unlinkSync(filePath); console.log('Slettet gammel backup:', f); }
        } catch (e) {}
      }
    });
  } catch (e) { console.error('Auto-backup feil:', e); }
}

app.whenReady().then(() => {
  ensureDirs();
  autoBackup();
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
autoUpdater.autoDownload = false;

autoUpdater.on('update-available', (info) => {
  console.log('Oppdatering tilgjengelig:', info.version);
  if (mainWindow) mainWindow.webContents.send('update-available', info.version);
});

autoUpdater.on('update-downloaded', () => {
  console.log('Oppdatering lastet ned');
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
  console.log('Auto-updater feil:', err.message);
  // Fallback: sjekk manuelt via GitHub API
  const https = require('https');
  https.get('https://api.github.com/repos/henriksstroem0805/Priskalkulator-E-/releases/latest', {
    headers: { 'User-Agent': 'Priskalkulator' }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        const latest = release.tag_name.replace('v', '');
        const current = app.getVersion();
        if (latest !== current) {
          if (mainWindow) mainWindow.webContents.send('update-available-manual', latest, release.html_url);
        }
      } catch (e) {}
    });
  }).on('error', () => {});
});

ipcMain.handle('app:downloadUpdate', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('app:installUpdate', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Lagre backup-fil til backup-mappen
ipcMain.handle('store:saveBackupFile', (event, json) => {
  try {
    const d = new Date();
    const dato = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const filnavn = 'Tilbudsdatabase_backup_' + dato + '.json';
    const file = path.join(BACKUP_DIR, filnavn);
    fs.writeFileSync(file, json, 'utf8');
    // Oppdater backup-meta
    fs.writeFileSync(BACKUP_META_FILE, JSON.stringify({ siste_backup: new Date().toISOString() }, null, 2), 'utf8');
    return { ok: true, path: file };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Lagre PDF fra HTML til genererte tilbud-mappen
ipcMain.handle('store:saveTilbudPDF', (event, htmlContent, kundeNavn) => {
  try {
    const pdfWin = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
    pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    return new Promise((resolve) => {
      pdfWin.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          pdfWin.webContents.printToPDF({ printBackground: true, marginType: 0 }).then(pdfData => {
            const d = new Date();
            const dato = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const safeName = (kundeNavn || 'tilbud').replace(/[^a-zA-ZæøåÆØÅ0-9 _-]/g, '').trim();
            const filnavn = 'Tilbud_' + safeName + '_' + dato + '.pdf';
            const file = path.join(TILBUD_DIR, filnavn);
            fs.writeFileSync(file, pdfData);
            pdfWin.close();
            resolve({ ok: true, path: file });
          }).catch(err => { pdfWin.close(); resolve({ ok: false, error: err.message }); });
        }, 500);
      });
    });
  } catch (e) { return { ok: false, error: e.message }; }
});

// Hent datamappe-stier
ipcMain.handle('store:getPaths', () => {
  return { data: DATA_DIR, tilbud: TILBUD_DIR, backup: BACKUP_DIR };
});
