const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Disable DNS-over-HTTPS to prevent SSL certificate errors in console
// FreeDroid uses local USB/ADB connections and doesn't need internet networking
app.commandLine.appendSwitch('disable-features', 'DnsOverHttps');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('src/index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Get the path to ADB executable
function getAdbPath() {
  if (app.isPackaged) {
    // In production, ADB is in resources
    return path.join(process.resourcesPath, 'platform-tools', 'mac', 'adb');
  } else {
    // In development
    return path.join(__dirname, 'resources', 'platform-tools', 'mac', 'adb');
  }
}

// Check if Android device is connected
ipcMain.handle('check-device', async () => {
  return new Promise((resolve) => {
    const adbPath = getAdbPath();

    // Check if ADB exists
    if (!fs.existsSync(adbPath)) {
      resolve({ success: false, error: 'ADB not found. Please ensure platform-tools are installed.' });
      return;
    }

    const adb = spawn(adbPath, ['devices']);
    let output = '';

    adb.stdout.on('data', (data) => {
      output += data.toString();
    });

    adb.on('close', (code) => {
      const lines = output.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
      const deviceConnected = lines.some(line => line.includes('device') && !line.includes('offline'));

      if (deviceConnected) {
        resolve({ success: true, message: 'Device connected' });
      } else {
        resolve({ success: false, error: 'No device found. Please connect your Android device with USB debugging enabled.' });
      }
    });

    adb.on('error', (err) => {
      resolve({ success: false, error: `ADB error: ${err.message}` });
    });
  });
});

// Select files using native dialog
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'Select files to transfer'
  });

  if (result.canceled) {
    return { canceled: true };
  }

  return {
    canceled: false,
    files: result.filePaths.map(filePath => ({
      path: filePath,
      name: path.basename(filePath),
      size: fs.statSync(filePath).size
    }))
  };
});

// Helper function to calculate folder size recursively
function getFolderSize(folderPath) {
  let totalSize = 0;

  function calculateSize(dirPath) {
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          calculateSize(fullPath);
        } else {
          totalSize += stat.size;
        }
      }
    } catch (error) {
      // Skip directories we can't access
      console.error(`Error reading directory ${dirPath}:`, error.message);
    }
  }

  calculateSize(folderPath);
  return totalSize;
}

// Select folder using native dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select folder to transfer'
  });

  if (result.canceled) {
    return { canceled: true };
  }

  const folderPath = result.filePaths[0];
  const folderSize = getFolderSize(folderPath);

  return {
    canceled: false,
    folderPath: folderPath,
    name: path.basename(folderPath),
    size: folderSize
  };
});

// Transfer files to Android device
ipcMain.handle('transfer-files', async (event, filePaths) => {
  const adbPath = getAdbPath();
  const remoteDir = '/sdcard/Download/';
  const results = [];

  for (const filePath of filePaths) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        results.push({
          file: path.basename(filePath),
          success: false,
          error: 'File not found'
        });
        continue;
      }

      // Transfer file
      const result = await new Promise((resolve) => {
        const adb = spawn(adbPath, ['push', filePath, remoteDir]);
        let output = '';
        let error = '';

        adb.stdout.on('data', (data) => {
          output += data.toString();
          // Send progress updates
          event.sender.send('transfer-progress', {
            file: path.basename(filePath),
            progress: output
          });
        });

        adb.stderr.on('data', (data) => {
          error += data.toString();
        });

        adb.on('close', (code) => {
          if (code === 0) {
            resolve({
              file: path.basename(filePath),
              success: true,
              message: `Transferred to ${remoteDir}`
            });
          } else {
            resolve({
              file: path.basename(filePath),
              success: false,
              error: error || 'Transfer failed'
            });
          }
        });

        adb.on('error', (err) => {
          resolve({
            file: path.basename(filePath),
            success: false,
            error: err.message
          });
        });
      });

      results.push(result);
    } catch (err) {
      results.push({
        file: path.basename(filePath),
        success: false,
        error: err.message
      });
    }
  }

  return results;
});

// Get list of connected Android devices
ipcMain.handle('get-devices', async () => {
  return new Promise((resolve) => {
    const adbPath = getAdbPath();

    if (!fs.existsSync(adbPath)) {
      resolve({ success: false, error: 'ADB not found' });
      return;
    }

    const adb = spawn(adbPath, ['devices']);
    let output = '';

    adb.stdout.on('data', (data) => {
      output += data.toString();
    });

    adb.on('close', (code) => {
      const lines = output.split('\n').filter(line => line.trim() && !line.includes('List of devices'));
      const devices = [];

      lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 2 && parts[1].includes('device')) {
          devices.push({
            id: parts[0].trim(),
            status: parts[1].trim()
          });
        }
      });

      resolve({ success: true, devices });
    });

    adb.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// List files in Android directory (optimized - single ls command)
ipcMain.handle('list-android-files', async (event, deviceId, dirPath) => {
  const adbPath = getAdbPath();
  const targetPath = dirPath || '/sdcard';

  return new Promise((resolve) => {
    // Use ls -lL to follow symlinks and get all file info in one command (without -a to hide hidden files)
    // Add trailing slash to ensure we list contents of directory, not the symlink itself
    const listPath = targetPath.endsWith('/') ? targetPath : targetPath + '/';
    const adb = spawn(adbPath, ['-s', deviceId, 'shell', `ls -lL "${listPath}" 2>/dev/null`]);
    let output = '';
    let error = '';

    adb.stdout.on('data', (data) => {
      output += data.toString();
    });

    adb.stderr.on('data', (data) => {
      error += data.toString();
    });

    adb.on('close', async (code) => {
      if (code !== 0) {
        resolve({ success: false, error: error || 'Failed to list files' });
        return;
      }

      const lines = output.split('\n').filter(line => line.trim());
      const files = [];

      // Filter out system directories we don't want to show
      const systemDirs = ['proc', 'sys', 'acct', 'config', 'd', 'dev', 'etc', 'init.rc',
        'mnt', 'odm', 'oem', 'product', 'res', 'root', 'sbin', 'vendor'];

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip "total" line
        if (trimmedLine.startsWith('total ')) continue;

        // Parse ls -la output
        // Format: drwxrwxrwx links user group size date time name [-> target]
        // Example: drwxrwx--x 5 root sdcard_rw 4096 2024-01-15 10:30 Download
        // Example: lrwxrwxrwx 1 root root 21 2024-01-15 10:30 sdcard -> /storage/self/primary
        const parts = trimmedLine.split(/\s+/);

        // Need at least 8 parts (permissions, links, user, group, size, date, time, name)
        if (parts.length < 8) continue;

        const permissions = parts[0];

        // Skip if doesn't start with file type indicator
        if (!/^[-dlbcsp]/.test(permissions)) continue;

        const sizeStr = parts[4];

        // Name starts at index 7 - but handle symlinks which have " -> target"
        let nameParts = parts.slice(7);
        let name = nameParts[0]; // Just the first part is the actual name

        // If it's a symlink, the format is "name -> target", so just take the name
        const arrowIndex = nameParts.indexOf('->');
        if (arrowIndex > 0) {
          name = nameParts.slice(0, arrowIndex).join(' ');
        } else {
          name = nameParts.join(' ');
        }

        if (!name || name === '.' || name === '..') continue;

        // Determine if it's a directory
        // 'd' = directory, 'l' = symlink (treat as what it points to)
        let isDir = permissions.startsWith('d');
        const isSymlink = permissions.startsWith('l');

        const fullPath = path.posix.join(targetPath, name);

        // For symlinks, check if target is a directory
        if (isSymlink) {
          const isDirResult = await new Promise((res) => {
            const checkDir = spawn(adbPath, ['-s', deviceId, 'shell', `test -d "${fullPath}"`]);
            checkDir.on('close', (testCode) => {
              res(testCode === 0);
            });
          });
          isDir = isDirResult;
        }

        // Skip system directories at root level
        if (targetPath === '/' && isDir && systemDirs.includes(name)) {
          continue;
        }

        // Parse size (for files this is accurate, for folders it's just the directory entry size)
        let size = parseInt(sizeStr, 10) || 0;

        files.push({
          name: name,
          path: fullPath,
          is_dir: isDir,
          size: isDir ? 0 : size  // Files get real size, folders will be calculated on-demand
        });
      }

      // Sort: directories first, then files, alphabetically
      files.sort((a, b) => {
        if (a.is_dir === b.is_dir) {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        }
        return a.is_dir ? -1 : 1;
      });

      resolve({ success: true, files });
    });

    adb.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// Pull file from Android to Mac
ipcMain.handle('pull-file', async (event, deviceId, remotePath) => {
  const adbPath = getAdbPath();
  const downloadFolder = path.join(require('os').homedir(), 'Pulled');

  // Create download folder if it doesn't exist
  if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder, { recursive: true });
  }

  const fileName = path.basename(remotePath);
  const localPath = path.join(downloadFolder, fileName);

  return new Promise((resolve) => {
    const adb = spawn(adbPath, ['-s', deviceId, 'pull', remotePath, localPath]);
    let output = '';
    let error = '';

    adb.stdout.on('data', (data) => {
      output += data.toString();
    });

    adb.stderr.on('data', (data) => {
      error += data.toString();
    });

    adb.on('close', (code) => {
      if (code === 0) {
        const summary = error.trim() || 'Pull completed';
        resolve({
          success: true,
          message: `Successfully pulled ${fileName}`,
          localPath: localPath,
          summary: summary
        });
      } else {
        resolve({
          success: false,
          error: error || `Failed to pull file (exit code ${code})`
        });
      }
    });

    adb.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
});

// Pull multiple files in batch
ipcMain.handle('pull-multiple-files', async (event, deviceId, filePaths) => {
  const adbPath = getAdbPath();
  const downloadFolder = path.join(require('os').homedir(), 'Pulled');

  if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder, { recursive: true });
  }

  const results = [];

  for (let i = 0; i < filePaths.length; i++) {
    const remotePath = filePaths[i];
    const fileName = path.basename(remotePath);
    const localPath = path.join(downloadFolder, fileName);

    // Send progress update
    event.sender.send('batch-progress', {
      current: i + 1,
      total: filePaths.length,
      currentFile: fileName,
      status: 'pulling'
    });

    const result = await new Promise((resolve) => {
      const adb = spawn(adbPath, ['-s', deviceId, 'pull', remotePath, localPath]);
      let output = '';
      let error = '';

      adb.stdout.on('data', (data) => {
        output += data.toString();
      });

      adb.stderr.on('data', (data) => {
        error += data.toString();
      });

      adb.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            file: fileName,
            localPath: localPath
          });
        } else {
          resolve({
            success: false,
            file: fileName,
            error: error || 'Pull failed'
          });
        }
      });

      adb.on('error', (err) => {
        resolve({
          success: false,
          file: fileName,
          error: err.message
        });
      });
    });

    results.push(result);
  }

  return { success: true, results };
});

// Pull folder recursively
ipcMain.handle('pull-folder-recursive', async (event, deviceId, folderPath) => {
  const adbPath = getAdbPath();
  const folderName = path.basename(folderPath);
  const downloadFolder = path.join(require('os').homedir(), 'Pulled', folderName);

  // Get list of all files in folder recursively
  const listFiles = await new Promise((resolve) => {
    const adb = spawn(adbPath, ['-s', deviceId, 'shell', `find "${folderPath}" -type f`]);
    let output = '';
    let error = '';

    adb.stdout.on('data', (data) => {
      output += data.toString();
    });

    adb.stderr.on('data', (data) => {
      error += data.toString();
    });

    adb.on('close', (code) => {
      if (code === 0) {
        const files = output.split('\n').filter(f => f.trim());
        resolve({ success: true, files });
      } else {
        resolve({ success: false, error: error || 'Failed to list files' });
      }
    });

    adb.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });

  if (!listFiles.success) {
    return { success: false, error: listFiles.error };
  }

  const files = listFiles.files;
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const remotePath = files[i];
    // Calculate relative path within the folder
    const relativePath = remotePath.replace(folderPath, '');
    const localPath = path.join(downloadFolder, relativePath);

    // Create directory structure
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    // Send progress update
    event.sender.send('batch-progress', {
      current: i + 1,
      total: files.length,
      currentFile: path.basename(remotePath),
      status: 'pulling'
    });

    const result = await new Promise((resolve) => {
      const adb = spawn(adbPath, ['-s', deviceId, 'pull', remotePath, localPath]);
      let error = '';

      adb.stderr.on('data', (data) => {
        error += data.toString();
      });

      adb.on('close', (code) => {
        resolve({
          success: code === 0,
          file: path.basename(remotePath),
          error: code !== 0 ? (error || 'Pull failed') : null
        });
      });

      adb.on('error', (err) => {
        resolve({ success: false, file: path.basename(remotePath), error: err.message });
      });
    });

    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: true,
    totalFiles: files.length,
    successCount,
    failedCount: files.length - successCount,
    localPath: downloadFolder,
    results
  };
});

// Get file preview/metadata
ipcMain.handle('get-file-preview', async (event, deviceId, filePath, isAndroid) => {
  if (!isAndroid) {
    // Local Mac file preview
    try {
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();

      let preview = null;
      const textExtensions = ['.txt', '.log', '.json', '.md', '.js', '.css', '.html', '.xml', '.csv'];
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

      if (textExtensions.includes(ext)) {
        // Read text content (first 50KB)
        const content = fs.readFileSync(filePath, 'utf8', { flag: 'r' });
        preview = {
          type: 'text',
          content: content.substring(0, 50000)
        };
      } else if (imageExtensions.includes(ext)) {
        // For images, return path to render in frontend
        preview = {
          type: 'image',
          path: filePath
        };
      }

      return {
        success: true,
        metadata: {
          name: path.basename(filePath),
          size: stats.size,
          modified: stats.mtime,
          type: ext.replace('.', '').toUpperCase()
        },
        preview
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  } else {
    // Android file preview
    const adbPath = getAdbPath();

    // Get file metadata
    const metadataResult = await new Promise((resolve) => {
      const adb = spawn(adbPath, ['-s', deviceId, 'shell', `stat -c '%s %Y' "${filePath}"`]);
      let output = '';

      adb.stdout.on('data', (data) => {
        output += data.toString();
      });

      adb.on('close', (code) => {
        if (code === 0) {
          const [size, mtime] = output.trim().split(' ');
          resolve({
            success: true,
            size: parseInt(size),
            modified: new Date(parseInt(mtime) * 1000)
          });
        } else {
          resolve({ success: false });
        }
      });
    });

    if (!metadataResult.success) {
      return { success: false, error: 'Failed to get file metadata' };
    }

    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = ['.txt', '.log', '.json', '.md', '.xml', '.csv'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

    let preview = null;

    // For small text files, read content
    if (textExtensions.includes(ext) && metadataResult.size < 100000) {
      const contentResult = await new Promise((resolve) => {
        const adb = spawn(adbPath, ['-s', deviceId, 'shell', `cat "${filePath}"`]);
        let content = '';

        adb.stdout.on('data', (data) => {
          content += data.toString();
        });

        adb.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, content: content.substring(0, 50000) });
          } else {
            resolve({ success: false });
          }
        });
      });

      if (contentResult.success) {
        preview = {
          type: 'text',
          content: contentResult.content
        };
      }
    } else if (imageExtensions.includes(ext) && metadataResult.size < 10000000) {
      // For images, pull to temp location
      const tempDir = path.join(require('os').tmpdir(), 'freedroid-preview');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempPath = path.join(tempDir, path.basename(filePath));

      const pullResult = await new Promise((resolve) => {
        const adb = spawn(adbPath, ['-s', deviceId, 'pull', filePath, tempPath]);

        adb.on('close', (code) => {
          resolve({ success: code === 0, path: tempPath });
        });
      });

      if (pullResult.success) {
        preview = {
          type: 'image',
          path: tempPath
        };
      }
    }

    return {
      success: true,
      metadata: {
        name: path.basename(filePath),
        size: metadataResult.size,
        modified: metadataResult.modified,
        type: ext.replace('.', '').toUpperCase()
      },
      preview
    };
  }
});

// Transfer folder to Android
ipcMain.handle('transfer-folder', async (event, folderPath) => {
  const adbPath = getAdbPath();
  const folderName = path.basename(folderPath);
  const remoteBase = `/sdcard/Download/${folderName}`;

  // Get all files in folder recursively
  function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }

  const allFiles = getAllFiles(folderPath);
  const results = [];

  for (let i = 0; i < allFiles.length; i++) {
    const localFilePath = allFiles[i];
    const relativePath = path.relative(folderPath, localFilePath);
    const remotePath = path.posix.join(remoteBase, relativePath.split(path.sep).join('/'));
    const remoteDir = path.posix.dirname(remotePath);

    // Create remote directory if needed
    await new Promise((resolve) => {
      const mkdir = spawn(adbPath, ['shell', `mkdir -p "${remoteDir}"`]);
      mkdir.on('close', () => resolve());
    });

    // Send progress update
    event.sender.send('batch-progress', {
      current: i + 1,
      total: allFiles.length,
      currentFile: path.basename(localFilePath),
      status: 'pushing'
    });

    // Push file
    const result = await new Promise((resolve) => {
      const adb = spawn(adbPath, ['push', localFilePath, remotePath]);
      let error = '';

      adb.stderr.on('data', (data) => {
        error += data.toString();
      });

      adb.on('close', (code) => {
        resolve({
          success: code === 0,
          file: path.basename(localFilePath),
          error: code !== 0 ? (error || 'Push failed') : null
        });
      });

      adb.on('error', (err) => {
        resolve({ success: false, file: path.basename(localFilePath), error: err.message });
      });
    });

    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: true,
    totalFiles: allFiles.length,
    successCount,
    failedCount: allFiles.length - successCount,
    remotePath: remoteBase,
    results
  };
});

// Get Android folder size recursively (fast using du)
ipcMain.handle('get-android-folder-size', async (event, deviceId, folderPath) => {
  const adbPath = getAdbPath();

  return new Promise((resolve) => {
    // Use du to get folder size (fast)
    const duCmd = spawn(adbPath, ['-s', deviceId, 'shell', `du -s "${folderPath}" 2>/dev/null | cut -f1`]);
    let output = '';

    duCmd.stdout.on('data', (data) => {
      output += data.toString();
    });

    duCmd.on('close', () => {
      const sizeInKb = parseInt(output.trim(), 10);
      if (!isNaN(sizeInKb) && sizeInKb > 0) {
        // du returns size in KB, convert to bytes
        resolve({ success: true, size: sizeInKb * 1024 });
      } else {
        resolve({ success: false, size: 0, error: 'Could not determine folder size' });
      }
    });

    duCmd.on('error', (err) => {
      resolve({ success: false, size: 0, error: err.message });
    });
  });
});

