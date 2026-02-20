const { app, BrowserWindow, globalShortcut, desktopCapturer } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';
const FRONTEND_DEV_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3001';

let mainWindow;

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
        },
        titleBarStyle: 'hiddenInset',
        show: false,
    });

    // Load frontend
    if (isDev) {
        mainWindow.loadURL(FRONTEND_DEV_URL);
        mainWindow.webContents.openDevTools();
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

function registerGlobalShortcuts() {
    // Global screen capture shortcut (Ctrl/Cmd + Shift + A)
    globalShortcut.register('CommandOrControl+Shift+A', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 },
            });

            if (sources.length > 0) {
                const screenshot = sources[0].thumbnail.toPNG();
                const base64 = screenshot.toString('base64');

                // Send to renderer process
                if (mainWindow) {
                    mainWindow.webContents.send('screen-captured', base64);
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        } catch (err) {
            console.error('Screen capture failed:', err);
        }
    });
}

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    registerGlobalShortcuts();

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
});
