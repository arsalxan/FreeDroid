const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Check if Android device is connected
    checkDevice: () => ipcRenderer.invoke('check-device'),

    // Open file selection dialog
    selectFiles: () => ipcRenderer.invoke('select-files'),

    // Transfer files to device
    transferFiles: (filePaths) => ipcRenderer.invoke('transfer-files', filePaths),

    // Listen for transfer progress
    onTransferProgress: (callback) => {
        ipcRenderer.on('transfer-progress', (event, data) => callback(data));
    },

    // Pull functionality - Get list of connected devices
    getDevices: () => ipcRenderer.invoke('get-devices'),

    // Pull functionality - List files in Android directory
    listAndroidFiles: (deviceId, path) => ipcRenderer.invoke('list-android-files', deviceId, path),

    // Pull functionality - Pull file from Android to Mac
    pullFile: (deviceId, remotePath) => ipcRenderer.invoke('pull-file', deviceId, remotePath),

    // Multi-select functionality - Pull multiple files
    pullMultipleFiles: (deviceId, filePaths) => ipcRenderer.invoke('pull-multiple-files', deviceId, filePaths),

    // Folder functionality - Pull folder recursively
    pullFolderRecursive: (deviceId, folderPath) => ipcRenderer.invoke('pull-folder-recursive', deviceId, folderPath),

    // Preview functionality - Get file preview/metadata
    getFilePreview: (deviceId, filePath, isAndroid) => ipcRenderer.invoke('get-file-preview', deviceId, filePath, isAndroid),

    // Push folder to Android
    transferFolder: (folderPath) => ipcRenderer.invoke('transfer-folder', folderPath),

    // Listen for batch progress
    onBatchProgress: (callback) => {
        ipcRenderer.on('batch-progress', (event, data) => callback(data));
    },

    // Select folder dialog for push mode
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Get Android folder size
    getAndroidFolderSize: (deviceId, folderPath) => ipcRenderer.invoke('get-android-folder-size', deviceId, folderPath)
});
