const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const extract = require('extract-zip');

app.commandLine.appendSwitch('hide-scrollbars');

const APP_TITLE = "Victor's Archive";

const UPDATE_OWNER = 'strailico5327';
const UPDATE_REPO = 'strailico5327.github.io';
const UPDATE_BRANCH = 'gh-pages';

const updateApiUrl = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/commits/${UPDATE_BRANCH}`;
const updateZipUrl = `https://codeload.github.com/${UPDATE_OWNER}/${UPDATE_REPO}/zip/refs/heads/${UPDATE_BRANCH}`;

const userDataRoot = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'user-data')
  : path.join(__dirname, 'user-data');

app.setPath('userData', userDataRoot);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

function getAppRoot() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
}

function getPublicRoot() {
  return path.join(getAppRoot(), 'public');
}

function getUpdateStatePath() {
  return path.join(app.getPath('userData'), 'update-state.json');
}

function getPendingPublicPath() {
  return path.join(app.getPath('userData'), 'pending-public');
}

function getDownloadZipPath() {
  return path.join(app.getPath('userData'), 'gh-pages.zip');
}

function setWindowStatus(win, status) {
  if (!win || win.isDestroyed()) return;
  win.setTitle(status ? `${APP_TITLE} - ${status}` : APP_TITLE);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function createDownloadStatusUpdater(win) {
  return ({ downloadedBytes, totalBytes, speedBytesPerSecond }) => {
    const speedText = `${formatBytes(speedBytesPerSecond)}/s`;

    if (totalBytes > 0) {
      const percentage = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
      setWindowStatus(win, `Downloading ${percentage}% · ${speedText}`);
      return;
    }

    setWindowStatus(win, `Downloading ${formatBytes(downloadedBytes)} · ${speedText}`);
  };
}

function readUpdateState() {
  try {
    return JSON.parse(fs.readFileSync(getUpdateStatePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeUpdateState(state) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(getUpdateStatePath(), JSON.stringify(state, null, 2), 'utf8');
}

function removePath(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function findExtractedSiteRoot(extractRoot) {
  if (fs.existsSync(path.join(extractRoot, 'index.html'))) {
    return extractRoot;
  }

  const entries = fs.readdirSync(extractRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const candidate = path.join(extractRoot, entry.name);

    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Victors-Archive',
          'Accept': 'application/vnd.github+json'
        }
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${body}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    request.on('error', reject);
  });
}

function downloadFile(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Victors-Archive'
        }
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          file.close();
          removePath(destination);
          downloadFile(response.headers.location, destination, onProgress).then(resolve, reject);
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          file.close();
          removePath(destination);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = Number(response.headers['content-length'] || 0);
        let downloadedBytes = 0;
        let lastBytes = 0;
        let lastTime = Date.now();

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;

          const now = Date.now();
          const elapsedSeconds = (now - lastTime) / 1000;

          if (elapsedSeconds >= 0.5) {
            const speedBytesPerSecond = (downloadedBytes - lastBytes) / elapsedSeconds;

            if (typeof onProgress === 'function') {
              onProgress({
                downloadedBytes,
                totalBytes,
                speedBytesPerSecond
              });
            }

            lastBytes = downloadedBytes;
            lastTime = now;
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          if (typeof onProgress === 'function') {
            onProgress({
              downloadedBytes,
              totalBytes,
              speedBytesPerSecond: 0
            });
          }

          file.close(resolve);
        });
      }
    );

    request.on('error', (err) => {
      file.close();
      removePath(destination);
      reject(err);
    });
  });
}

function applyPendingUpdate() {
  const state = readUpdateState();

  if (!state.pendingSha) return;

  const pendingPublic = getPendingPublicPath();

  if (!fs.existsSync(path.join(pendingPublic, 'index.html'))) {
    writeUpdateState({ ...state, pendingSha: null });
    return;
  }

  const publicRoot = getPublicRoot();
  const backupRoot = path.join(getAppRoot(), 'public-backup');

  try {
    removePath(backupRoot);

    if (fs.existsSync(publicRoot)) {
      fs.renameSync(publicRoot, backupRoot);
    }

    fs.renameSync(pendingPublic, publicRoot);
    removePath(backupRoot);

    writeUpdateState({
      currentSha: state.pendingSha,
      pendingSha: null,
      updatedAt: new Date().toISOString()
    });

    console.log('[update] Pending update applied.');
  } catch (err) {
    try {
      if (!fs.existsSync(publicRoot) && fs.existsSync(backupRoot)) {
        fs.renameSync(backupRoot, publicRoot);
      }
    } catch {}

    console.error('[update] Failed to apply pending update:', err);
  }
}

async function checkForUpdatesSilently(win) {
  try {
    setWindowStatus(win, 'Checking for updates');

    fs.mkdirSync(app.getPath('userData'), { recursive: true });

    const state = readUpdateState();
    const remoteCommit = await requestJson(updateApiUrl);
    const remoteSha = remoteCommit && remoteCommit.sha;

    if (!remoteSha) {
      setWindowStatus(win, '');
      return;
    }

    if (state.currentSha === remoteSha || state.pendingSha === remoteSha) {
      setWindowStatus(win, '');
      return;
    }

    setWindowStatus(win, 'Downloading archive update');

    const zipPath = getDownloadZipPath();
    const extractRoot = path.join(app.getPath('userData'), 'extracting-public');
    const pendingPublic = getPendingPublicPath();

    removePath(zipPath);
    removePath(extractRoot);
    removePath(pendingPublic);

    await downloadFile(updateZipUrl, zipPath, createDownloadStatusUpdater(win));

    setWindowStatus(win, 'Extracting archive update');

    await extract(zipPath, { dir: extractRoot });

    const extractedSiteRoot = findExtractedSiteRoot(extractRoot);

    if (!extractedSiteRoot) {
      throw new Error('Downloaded archive does not contain index.html.');
    }

    copyDirectory(extractedSiteRoot, pendingPublic);

    if (!fs.existsSync(path.join(pendingPublic, 'index.html'))) {
      throw new Error('Pending public folder does not contain index.html.');
    }

    writeUpdateState({
      ...state,
      pendingSha: remoteSha,
      downloadedAt: new Date().toISOString()
    });

    removePath(zipPath);
    removePath(extractRoot);

    setWindowStatus(win, 'Update ready for next launch');

    setTimeout(() => {
      setWindowStatus(win, '');
    }, 6000);

    console.log('[update] Update downloaded. It will be applied on next launch.');
  } catch (err) {
    setWindowStatus(win, '');
    console.error('[update] Silent update failed:', err);
  }
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

function createStaticServer() {
  const publicRoot = getPublicRoot();

  return http.createServer((req, res) => {
    try {
      const requestUrl = new URL(req.url, 'http://127.0.0.1');
      const requestPath = decodeURIComponent(requestUrl.pathname);

      let targetPath = path.resolve(publicRoot, `.${requestPath}`);

      if (targetPath !== publicRoot && !targetPath.startsWith(publicRoot + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
      }

      fs.stat(targetPath, (statErr, stat) => {
        if (statErr) {
          send404(res);
          return;
        }

        if (stat.isDirectory()) {
          targetPath = path.join(targetPath, 'index.html');
        }

        fs.readFile(targetPath, (readErr, data) => {
          if (readErr) {
            send404(res);
            return;
          }

          const ext = path.extname(targetPath).toLowerCase();
          const contentType = mimeTypes[ext] || 'application/octet-stream';

          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        });
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err));
    }
  });
}

function createWindow(startUrl) {
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_TITLE,
    autoHideMenuBar: true,
    backgroundColor: '#eaf4f8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL(startUrl);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(startUrl)) {
      const currentOrigin = new URL(startUrl).origin;
      const targetOrigin = new URL(url).origin;

      if (targetOrigin !== currentOrigin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }

    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }

    if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
      event.preventDefault();
    }

    if (input.control && input.key.toLowerCase() === 'q') {
      app.quit();
      event.preventDefault();
    }
  });

  return win;
}

app.whenReady().then(() => {
  applyPendingUpdate();

  const server = createStaticServer();

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    const startUrl = `http://127.0.0.1:${port}/`;
    const mainWindow = createWindow(startUrl);

    setTimeout(() => {
      checkForUpdatesSilently(mainWindow);
    }, 3000);
  });

  app.on('before-quit', () => {
    server.close();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    app.relaunch();
    app.exit();
  }
});