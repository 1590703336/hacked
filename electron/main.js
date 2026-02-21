const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV !== 'production';
const FRONTEND_DEV_URL = 'http://localhost:5173';

let mainWindow;
let backendProcess;
let captureInFlight = false;
let lastCaptureAt = 0;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false, // Help with local active development CORS
        },
        titleBarStyle: 'hidden', // Changed from hiddenInset to just hidden for testing
        show: false,
        backgroundColor: '#121b26' // Matches the App.jsx dark mode background
    });

    // Load frontend
    if (isDev) {
        mainWindow.loadURL(FRONTEND_DEV_URL);
        // Force open dev tools to debug why it's black
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startBackend() {
    const backendDir = isDev
        ? path.join(__dirname, '../backend')
        : path.join(process.resourcesPath, 'backend'); // Assuming backend is copied here in prod

    backendProcess = spawn('npm', ['run', 'dev'], {
        cwd: backendDir,
        shell: true,
    });

    backendProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));
}

function registerGlobalShortcuts() {
    // Global screen capture shortcut (Ctrl/Cmd + Shift + A)
    globalShortcut.register('CommandOrControl+Shift+A', async () => {
        await captureAndSendScreen('global-shortcut');
    });
}

async function captureAndSendScreen(trigger = 'unknown') {
    if (!mainWindow) return;
    const now = Date.now();
    // De-duplicate near-simultaneous triggers (e.g., global + renderer hotkey).
    if (captureInFlight || now - lastCaptureAt < 500) {
        return;
    }
    captureInFlight = true;
    lastCaptureAt = now;
    try {
        mainWindow.webContents.send('shortcut-capture', { trigger });
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 },
        });
        if (sources.length === 0) {
            console.warn('No screen sources available for capture');
            return;
        }

        const screenshot = sources[0].thumbnail.toPNG();
        const base64 = screenshot.toString('base64');
        mainWindow.webContents.send('screen-captured', base64);
        mainWindow.show();
        mainWindow.focus();
    } catch (err) {
        console.error('Screen capture failed:', err);
    } finally {
        captureInFlight = false;
    }
}

// App lifecycle
app.whenReady().then(() => {
    // startBackend(); // Let npm-run-all handle backend for now in development
    createWindow();
    registerGlobalShortcuts();
    ipcMain.on('request-capture', async () => {
        await captureAndSendScreen('renderer-hotkey');
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (backendProcess) {
        backendProcess.kill();
    }
});
