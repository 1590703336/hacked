const { contextBridge, ipcRenderer } = require('electron');

const screenCapturedListeners = new Set();
const shortcutCaptureListeners = new Set();
let pendingScreenCapture = null;
let pendingShortcutCaptureArgs = null;

function safeInvoke(listener, ...args) {
    try {
        listener(...args);
    } catch (err) {
        console.error('[preload] IPC listener failed:', err);
    }
}

ipcRenderer.on('screen-captured', (_event, base64) => {
    if (screenCapturedListeners.size === 0) {
        pendingScreenCapture = base64;
        return;
    }

    for (const listener of screenCapturedListeners) {
        safeInvoke(listener, base64);
    }
});

ipcRenderer.on('shortcut-capture', (_event, ...args) => {
    if (shortcutCaptureListeners.size === 0) {
        pendingShortcutCaptureArgs = args;
        return;
    }

    for (const listener of shortcutCaptureListeners) {
        safeInvoke(listener, ...args);
    }
});

contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for screen captures from the main process
    onScreenCaptured: (callback) => {
        if (typeof callback !== 'function') {
            return () => {};
        }

        screenCapturedListeners.add(callback);

        if (pendingScreenCapture) {
            const bufferedCapture = pendingScreenCapture;
            pendingScreenCapture = null;
            safeInvoke(callback, bufferedCapture);
        }

        return () => {
            screenCapturedListeners.delete(callback);
        };
    },

    // Listen for global shortcut capture event
    onShortcutCapture: (callback) => {
        if (typeof callback !== 'function') {
            return () => {};
        }

        shortcutCaptureListeners.add(callback);

        if (pendingShortcutCaptureArgs) {
            const bufferedArgs = pendingShortcutCaptureArgs;
            pendingShortcutCaptureArgs = null;
            safeInvoke(callback, ...bufferedArgs);
        }

        return () => {
            shortcutCaptureListeners.delete(callback);
        };
    },

    // Request a screen capture from the main process
    requestCapture: () => {
        ipcRenderer.send('request-capture');
    },

    // Platform info
    platform: process.platform,
});
