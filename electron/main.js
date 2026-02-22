const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV !== 'production';
const FRONTEND_DEV_URL = 'http://localhost:5173';
const CAPTURE_HOTKEYS = process.platform === 'darwin'
  ? ['Command+Shift+A', 'Control+Shift+A']
  : ['Control+Shift+A'];

let mainWindow;
let backendProcess;
let captureInFlight = false;
let lastCaptureAt = 0;

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    titleBarStyle: 'hidden',
    title: 'Lumina',
    show: false,
    backgroundColor: '#07121a',
  });

  if (isDev) {
    mainWindow.loadURL(FRONTEND_DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function waitForWindowReady(win) {
  if (!win || win.isDestroyed()) {
    return Promise.reject(new Error('Main window is not available'));
  }

  if (win.webContents.isLoadingMainFrame()) {
    return new Promise((resolve) => {
      win.webContents.once('did-finish-load', () => resolve(win));
    });
  }

  return Promise.resolve(win);
}

async function ensureMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const win = createWindow();
    return waitForWindowReady(win);
  }
  return waitForWindowReady(mainWindow);
}

function startBackend() {
  const backendDir = isDev
    ? path.join(__dirname, '../backend')
    : path.join(process.resourcesPath, 'backend');

  backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: backendDir,
    shell: true,
  });

  backendProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
  backendProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));
}

function registerGlobalShortcuts() {
  for (const hotkey of CAPTURE_HOTKEYS) {
    const registered = globalShortcut.register(hotkey, async () => {
      await captureAndSendScreen('global-shortcut');
    });

    if (!registered) {
      console.error(`[shortcut] Failed to register global shortcut: ${hotkey}`);
      continue;
    }

    const isRegistered = globalShortcut.isRegistered(hotkey);
    console.log(`[shortcut] ${hotkey} registered: ${isRegistered}`);
  }
}

async function captureAndSendScreen(trigger = 'unknown') {
  const now = Date.now();
  if (captureInFlight || now - lastCaptureAt < 500) {
    return;
  }

  captureInFlight = true;
  lastCaptureAt = now;

  try {
    const win = await ensureMainWindow();
    win.webContents.send('shortcut-capture', { trigger });

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (!sources.length) {
      console.warn('[capture] No screen sources available');
      return;
    }

    const screenshot = sources[0].thumbnail.toPNG();
    const base64 = screenshot.toString('base64');
    win.webContents.send('screen-captured', base64);

    if (!win.isVisible()) {
      win.show();
    }
    win.focus();
  } catch (err) {
    console.error('Screen capture failed:', err);
  } finally {
    captureInFlight = false;
  }
}

app.whenReady().then(() => {
  app.setName('Lumina');
  // startBackend(); // Let npm-run-all handle backend for now in development
  createWindow();
  registerGlobalShortcuts();

  ipcMain.on('request-capture', async () => {
    await captureAndSendScreen('renderer-hotkey');
  });

  app.on('activate', async () => {
    const win = await ensureMainWindow();
    if (!win.isVisible()) {
      win.show();
    }
  });
});

// Keep app alive for global shortcuts even after all windows are closed.
app.on('window-all-closed', () => {
  // No-op by design.
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (backendProcess) {
    backendProcess.kill();
  }
});
