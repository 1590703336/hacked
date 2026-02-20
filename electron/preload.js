const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for screen captures from the main process
    onScreenCaptured: (callback) => {
        ipcRenderer.on('screen-captured', (_event, base64) => callback(base64));
    },

    // Request a screen capture from the main process
    requestCapture: () => {
        ipcRenderer.send('request-capture');
    },

    // Platform info
    platform: process.platform,
});
