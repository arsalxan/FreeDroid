// State management
let selectedFiles = [];
let isTransferring = false;
let selectedItems = []; // Multi-select state for pull mode
let isMultiSelectMode = true; // Always enabled in pull mode

// DOM Elements - Push Mode
const dropZone = document.getElementById('dropZone');
const fileListContainer = document.getElementById('fileListContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const selectFilesBtn = document.getElementById('selectFilesBtn');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const transferBtn = document.getElementById('transferBtn');
const transferResults = document.getElementById('transferResults');
const resultsList = document.getElementById('resultsList');
const newTransferBtn = document.getElementById('newTransferBtn');
const deviceStatus = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');
const toastContainer = document.getElementById('toastContainer');

// DOM Elements - Tabs & Modes
const pushTab = document.getElementById('pushTab');
const pullTab = document.getElementById('pullTab');
const pushMode = document.getElementById('pushMode');
const pullMode = document.getElementById('pullMode');
const deviceSelect = document.getElementById('deviceSelect');
const fileBrowser = document.getElementById('fileBrowser');
const breadcrumb = document.getElementById('breadcrumb');

// DOM Elements - Pull Mode Multi-Select
const selectAllBtn = document.getElementById('selectAllBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const selectionCount = document.getElementById('selectionCount');
const selectedItemsPanel = document.getElementById('selectedItemsPanel');
const selectedItemsList = document.getElementById('selectedItemsList');
const selectedItemCount = document.getElementById('selectedItemCount');
const selectedItemSize = document.getElementById('selectedItemSize');
const pullSelectedBtn = document.getElementById('pullSelectedBtn');
const pullSelectedBtnTop = document.getElementById('pullSelectedBtnTop');
const closePanelBtn = document.getElementById('closePanelBtn');
const previewModal = document.getElementById('previewModal');
const previewTitle = document.getElementById('previewTitle');
const previewBody = document.getElementById('previewBody');
const previewMetadata = document.getElementById('previewMetadata');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const selectFolderBtnInitial = document.getElementById('selectFolderBtnInitial');
const selectMoreFilesBtn = document.getElementById('selectMoreFilesBtn');
const totalFileSize = document.getElementById('totalFileSize');

// Initialize
init();

function init() {
    checkDeviceConnection();
    setupEventListeners();

    // Check device status every 5 seconds
    setInterval(checkDeviceConnection, 5000);
}

function setupEventListeners() {
    // File selection
    selectFilesBtn.addEventListener('click', selectFiles);
    if (selectMoreFilesBtn) selectMoreFilesBtn.addEventListener('click', selectFiles);
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('.drop-zone-content')) {
            selectFiles();
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Actions
    clearFilesBtn.addEventListener('click', clearFiles);
    transferBtn.addEventListener('click', transferFiles);
    newTransferBtn.addEventListener('click', resetApp);

    // Tab switching
    if (pushTab) pushTab.addEventListener('click', switchToPushMode);
    if (pullTab) pullTab.addEventListener('click', switchToPullMode);

    // Device selection
    if (deviceSelect) {
        deviceSelect.addEventListener('change', (e) => {
            currentDevice = e.target.value;
            if (currentDevice) {
                currentPath = '/sdcard';
                loadAndroidFiles(currentPath);
            }
        });
    }

    // Progress listener
    window.electronAPI.onTransferProgress((data) => {
        console.log('Progress:', data);
    });

    // Multi-select event listeners for pull mode
    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllItems);
    if (clearSelectionBtn) clearSelectionBtn.addEventListener('click', clearAllSelections);
    if (pullSelectedBtn) pullSelectedBtn.addEventListener('click', pullMultipleItems);
    if (pullSelectedBtnTop) pullSelectedBtnTop.addEventListener('click', pullMultipleItems);
    if (closePanelBtn) closePanelBtn.addEventListener('click', () => {
        if (selectedItemsPanel) selectedItemsPanel.style.display = 'none';
    });
    if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreview);
    if (selectFolderBtn) selectFolderBtn.addEventListener('click', selectFolder);
    if (selectFolderBtnInitial) selectFolderBtnInitial.addEventListener('click', selectFolder);

    // Listen for batch progress
    window.electronAPI.onBatchProgress((data) => {
        updateBatchProgress(data);
    });
}

async function checkDeviceConnection() {
    const usbDebugBanner = document.getElementById('usbDebugBanner');

    try {
        const result = await window.electronAPI.checkDevice();

        if (result.success) {
            statusIndicator.className = 'status-indicator connected';
            deviceStatus.textContent = 'Device Connected';
            // Hide USB debug banner when device is connected
            if (usbDebugBanner) usbDebugBanner.style.display = 'none';
        } else {
            statusIndicator.className = 'status-indicator disconnected';
            deviceStatus.textContent = 'No Device';
            // Show USB debug banner when no device
            if (usbDebugBanner) usbDebugBanner.style.display = 'flex';
        }
    } catch (error) {
        statusIndicator.className = 'status-indicator disconnected';
        deviceStatus.textContent = 'Error';
        console.error('Device check error:', error);
        // Show banner on error too
        if (usbDebugBanner) usbDebugBanner.style.display = 'flex';
    }
}

async function selectFiles() {
    try {
        const result = await window.electronAPI.selectFiles();

        if (!result.canceled && result.files.length > 0) {
            addFiles(result.files);
        }
    } catch (error) {
        showToast('Failed to select files', 'error');
        console.error('File selection error:', error);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).map(file => ({
        path: file.path,
        name: file.name,
        size: file.size
    }));

    if (files.length > 0) {
        addFiles(files);
    }
}

function addFiles(files) {
    // Add new files to selection (avoid duplicates)
    files.forEach(file => {
        if (!selectedFiles.some(f => f.path === file.path)) {
            selectedFiles.push(file);
        }
    });

    updateFileList();
    showFileList();
    showToast(`Added ${files.length} file(s)`, 'success');
}

function updateFileList() {
    fileCount.textContent = selectedFiles.length;
    fileList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const fileItem = createFileItem(file, index);
        fileList.appendChild(fileItem);
    });
}

function createFileItem(file, index) {
    const item = document.createElement('div');
    item.className = 'file-item';

    const ext = file.name.split('.').pop().toUpperCase().slice(0, 3);

    item.innerHTML = `
    < div class="file-icon" > ${ext}</div >
    <div class="file-info">
      <div class="file-name" title="${file.name}">${file.name}</div>
      <div class="file-size">${formatBytes(file.size)}</div>
    </div>
    <button class="file-remove" data-index="${index}">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
`;

    item.querySelector('.file-remove').addEventListener('click', () => removeFile(index));

    return item;
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();

    if (selectedFiles.length === 0) {
        hideFileList();
    }
}

function clearFiles() {
    selectedFiles = [];
    hideFileList();
    showToast('Cleared all files', 'info');
}

function showFileList() {
    dropZone.style.display = 'none';
    fileListContainer.style.display = 'block';
}

function hideFileList() {
    dropZone.style.display = 'block';
    fileListContainer.style.display = 'none';
}

async function transferFiles() {
    if (selectedFiles.length === 0) {
        showToast('No files selected', 'error');
        return;
    }

    if (isTransferring) {
        return;
    }

    // Check device connection first
    const deviceCheck = await window.electronAPI.checkDevice();
    if (!deviceCheck.success) {
        showToast('No Android device connected. Please connect your device with USB debugging enabled.', 'error');
        return;
    }

    isTransferring = true;
    transferBtn.classList.add('loading');
    transferBtn.disabled = true;

    try {
        const filePaths = selectedFiles.map(f => f.path);
        const results = await window.electronAPI.transferFiles(filePaths);

        showTransferResults(results);
    } catch (error) {
        showToast('Transfer failed: ' + error.message, 'error');
        console.error('Transfer error:', error);
    } finally {
        isTransferring = false;
        transferBtn.classList.remove('loading');
        transferBtn.disabled = false;
    }
}

function showTransferResults(results) {
    resultsList.innerHTML = '';

    results.forEach(result => {
        const item = createResultItem(result);
        resultsList.appendChild(item);
    });

    fileListContainer.style.display = 'none';
    transferResults.style.display = 'block';

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    if (successCount === totalCount) {
        showToast(`Successfully transferred ${successCount} file(s)!`, 'success');
    } else {
        showToast(`Transferred ${successCount}/${totalCount} files`, 'error');
    }
}

function createResultItem(result) {
    const item = document.createElement('div');
    item.className = 'result-item';

    const iconClass = result.success ? 'success' : 'error';
    const icon = result.success
        ? '<path d="M5 10L8 13L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<path d="M6 6L14 14M6 14L14 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

    const message = result.success ? result.message : result.error;
    const messageClass = result.success ? '' : 'error';

    item.innerHTML = `
    <div class="result-icon ${iconClass}">
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
        ${icon}
      </svg>
    </div>
    <div class="result-info">
      <div class="result-name">${result.file}</div>
      <div class="result-message ${messageClass}">${message}</div>
    </div>
  `;

    return item;
}

function resetApp() {
    selectedFiles = [];
    transferResults.style.display = 'none';
    showFileList();
    hideFileList();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<path d="M5 10L8 13L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        error: '<path d="M6 6L14 14M6 14L14 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        info: '<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 6V10M10 12V14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    };

    toast.innerHTML = `
    <div class="toast-icon">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        ${icons[type] || icons.info}
      </svg>
    </div>
    <div class="toast-message">${message}</div>
  `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlide 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    // Use decimal units (1000) to match Android file managers
    const k = 1000;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ============ PULL MODE FUNCTIONALITY ============

// Pull mode state
let currentDevice = null;
let currentPath = '/sdcard';
let selectedFile = null;
let androidFiles = [];

// Pull mode DOM elements are declared at top of file (lines 21-37)

// Tab switching functions
function switchToPushMode() {
    pushTab.classList.add('active');
    pullTab.classList.remove('active');
    pushMode.style.display = 'block';
    pullMode.style.display = 'none';
}

function switchToPullMode() {
    pullTab.classList.add('active');
    pushTab.classList.remove('active');
    pushMode.style.display = 'none';
    pullMode.style.display = 'block';

    // Load devices when switching to pull mode
    loadDevices();
}

// Load available devices
async function loadDevices() {
    const usbDebugBannerPull = document.getElementById('usbDebugBannerPull');

    try {
        const result = await window.electronAPI.getDevices();

        deviceSelect.innerHTML = '';

        if (result.success && result.devices.length > 0) {
            // Hide banner when devices are found
            if (usbDebugBannerPull) usbDebugBannerPull.style.display = 'none';

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Select a device...';
            deviceSelect.appendChild(placeholderOption);

            // Add device options
            result.devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = `${device.id} (${device.status})`;
                deviceSelect.appendChild(option);
            });

            // Auto-select if only one device
            if (result.devices.length === 1) {
                deviceSelect.value = result.devices[0].id;
                currentDevice = result.devices[0].id;
                currentPath = '/sdcard';
                loadAndroidFiles(currentPath);
            }
        } else {
            // Show banner when no devices found
            if (usbDebugBannerPull) usbDebugBannerPull.style.display = 'flex';

            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No devices found';
            deviceSelect.appendChild(option);

            showBrowserMessage('No Android devices connected', 'Connect a device with USB debugging enabled');
        }
    } catch (error) {
        console.error('Failed to load devices:', error);
        showToast('Failed to load devices', 'error');
        // Show banner on error
        if (usbDebugBannerPull) usbDebugBannerPull.style.display = 'flex';
    }
}

// Load Android files for current path
async function loadAndroidFiles(path) {
    if (!currentDevice) {
        showBrowserMessage('No device selected', 'Please select a device from the dropdown');
        return;
    }

    showBrowserLoading();
    updateBreadcrumb(path);

    try {
        const result = await window.electronAPI.listAndroidFiles(currentDevice, path);

        if (result.success) {
            androidFiles = result.files;
            selectedFile = null;
            displayAndroidFiles(result.files);
        } else {
            showBrowserMessage('Failed to load files', result.error || 'Unknown error');
            showToast(result.error || 'Failed to load files', 'error');
        }
    } catch (error) {
        console.error('Failed to load Android files:', error);
        showBrowserMessage('Error loading files', error.message);
        showToast('Failed to load files', 'error');
    }
}

// Handle file/folder click
function handleFileClick(file, itemElement) {
    if (file.is_dir) {
        // Navigate into folder
        currentPath = file.path;
        loadAndroidFiles(currentPath);
    } else {
        // File clicks now just toggle checkbox - old single-file selection removed
    }
}

// Update breadcrumb navigation
function updateBreadcrumb(path) {
    breadcrumb.innerHTML = '';

    // Define the base path (minimum navigable path)
    const basePath = '/sdcard';

    // Add back button if not at base path
    if (path !== basePath && path !== basePath + '/') {
        const backBtn = document.createElement('span');
        backBtn.className = 'breadcrumb-back';
        backBtn.innerHTML = '← Back';
        backBtn.addEventListener('click', () => {
            // Go to parent directory, but not above /sdcard
            const parentPath = path.split('/').slice(0, -1).join('/') || basePath;
            const safePath = parentPath.startsWith(basePath) ? parentPath : basePath;
            currentPath = safePath;
            loadAndroidFiles(safePath);
        });
        breadcrumb.appendChild(backBtn);

        // Separator after back button
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = ' | ';
        breadcrumb.appendChild(separator);
    }

    // Start from /sdcard, not root
    const parts = path.split('/').filter(p => p);

    // Find where /sdcard starts in the path
    const sdcardIndex = parts.indexOf('sdcard');
    const displayParts = sdcardIndex >= 0 ? parts.slice(sdcardIndex) : parts;

    // sdcard as home
    const homeItem = document.createElement('span');
    homeItem.className = 'breadcrumb-item';
    const homeLink = document.createElement('span');
    homeLink.className = path === basePath || path === basePath + '/' ? 'breadcrumb-current' : 'breadcrumb-link';
    homeLink.textContent = '📱 Storage';
    if (path !== basePath && path !== basePath + '/') {
        homeLink.addEventListener('click', () => {
            currentPath = basePath;
            loadAndroidFiles(basePath);
        });
    }
    homeItem.appendChild(homeLink);
    breadcrumb.appendChild(homeItem);

    // Path segments after sdcard
    let accumulatedPath = basePath;
    displayParts.slice(1).forEach((part, index, arr) => {
        accumulatedPath += '/' + part;

        // Separator
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '/';
        breadcrumb.appendChild(separator);

        const item = document.createElement('span');
        item.className = 'breadcrumb-item';

        if (index === arr.length - 1) {
            // Current directory
            const current = document.createElement('span');
            current.className = 'breadcrumb-current';
            current.textContent = part;
            item.appendChild(current);
        } else {
            // Navigable directory
            const link = document.createElement('span');
            link.className = 'breadcrumb-link';
            link.textContent = part;
            const pathToNavigate = accumulatedPath;
            link.addEventListener('click', () => {
                currentPath = pathToNavigate;
                loadAndroidFiles(pathToNavigate);
            });
            item.appendChild(link);
        }

        breadcrumb.appendChild(item);
    });
}

// Pull selected file from Android - DEPRECATED: now using pullMultipleItems
// This function is kept for backward compatibility but not used in new UI
async function pullSelectedFile() {
    // Redirect to multi-select pull
    pullMultipleItems();
}

// Show loading state in browser
function showBrowserLoading() {
    fileBrowser.innerHTML = `
        <div class="browser-loading">
            <div class="spinner"></div>
            <p>Loading files...</p>
        </div>
    `;
}

// Show message in browser
function showBrowserMessage(title, message) {
    fileBrowser.innerHTML = `
        <div class="empty-state">
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

// ============ MULTI-SELECT & PREVIEW FUNCTIONALITY ============

// Multi-select DOM elements and state variables are declared at top of file
// Event listeners are set up in init() function

// Update displayAndroidFiles to include checkboxes
function displayAndroidFiles(files) {
    fileBrowser.innerHTML = '';

    if (files.length === 0) {
        showBrowserMessage('Empty folder', 'This folder contains no files or directories');
        return;
    }

    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'browser-item';
        item.dataset.path = file.path;
        item.dataset.isDir = file.is_dir;
        item.dataset.name = file.name;
        item.dataset.size = file.size || 0;

        const iconClass = file.is_dir ? 'folder' : 'file';
        const iconSymbol = file.is_dir ? '📁' : '📄';
        const typeText = file.is_dir ? 'Folder' : 'File';
        // Show actual size for files, loading indicator for folders
        const sizeText = file.is_dir ? '...' : formatBytes(file.size || 0);

        // Check if already selected
        const isSelected = selectedItems.some(si => si.path === file.path);

        item.innerHTML = `
            <input type="checkbox" class="browser-item-checkbox" ${isSelected ? 'checked' : ''}>
            <div class="browser-item-icon ${iconClass}">${iconSymbol}</div>
            <div class="browser-item-info">
                <div class="browser-item-name">${file.name}</div>
                <div class="browser-item-meta">
                    <span class="browser-item-type">${typeText}</span>
                    <span class="browser-item-size" data-path="${file.path}">${sizeText}</span>
                </div>
            </div>
        `;

        const checkbox = item.querySelector('.browser-item-checkbox');
        const info = item.querySelectorAll('.browser-item-icon, .browser-item-info');

        // Checkbox handling
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            // Get the current size from the item's dataset (may have been updated async)
            const currentSize = parseInt(item.dataset.size, 10) || 0;
            handleCheckboxChange({ ...file, size: currentSize }, checkbox.checked);
        });

        // Click on file/folder name
        info.forEach(el => {
            el.addEventListener('click', () => {
                if (file.is_dir) {
                    currentPath = file.path;
                    loadAndroidFiles(currentPath);
                } else {
                    // Toggle selection - get current size from item's dataset
                    checkbox.checked = !checkbox.checked;
                    const currentSize = parseInt(item.dataset.size, 10) || 0;
                    handleCheckboxChange({ ...file, size: currentSize }, checkbox.checked);
                }
            });
        });

        fileBrowser.appendChild(item);

        // Load folder sizes asynchronously in background
        if (file.is_dir && currentDevice) {
            loadFolderSizeAsync(file.path, item);
        }
    });

    updateSelectionUI();
}

// Load folder size asynchronously and update the display
async function loadFolderSizeAsync(folderPath, itemElement) {
    try {
        const sizeResult = await window.electronAPI.getAndroidFolderSize(currentDevice, folderPath);
        if (sizeResult.success) {
            const sizeSpan = itemElement.querySelector('.browser-item-size');
            if (sizeSpan) {
                sizeSpan.textContent = formatBytes(sizeResult.size);
                itemElement.dataset.size = sizeResult.size;
            }
        }
    } catch (error) {
        console.error('Failed to load folder size:', error);
    }
}

// Handle checkbox state change
function handleCheckboxChange(file, isChecked) {
    if (isChecked) {
        // Add to selection - size is already available from file listing
        if (!selectedItems.some(si => si.path === file.path)) {
            selectedItems.push({
                path: file.path,
                name: file.name,
                is_dir: file.is_dir,
                size: file.size || 0
            });
        }
    } else {
        // Remove from selection
        selectedItems = selectedItems.filter(si => si.path !== file.path);
    }

    updateSelectionUI();
}

// Select all items in current view
function selectAllItems() {
    const checkboxes = fileBrowser.querySelectorAll('.browser-item-checkbox');

    checkboxes.forEach(cb => {
        if (!cb.checked) {
            cb.checked = true;
            const item = cb.closest('.browser-item');
            const file = {
                path: item.dataset.path,
                name: item.dataset.name,
                is_dir: item.dataset.isDir === 'true',
                size: parseInt(item.dataset.size, 10) || 0  // Use size from data attribute
            };
            if (!selectedItems.some(si => si.path === file.path)) {
                selectedItems.push(file);
            }
        }
    });

    updateSelectionUI();
}

// Clear all selections
function clearAllSelections() {
    selectedItems = [];
    const checkboxes = fileBrowser.querySelectorAll('.browser-item-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    updateSelectionUI();
}

// Update selection count and panel
function updateSelectionUI() {
    const count = selectedItems.length;
    selectionCount.textContent = `${count} selected`;

    // Show/hide the top pull button
    if (pullSelectedBtnTop) {
        pullSelectedBtnTop.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    if (count > 0) {
        selectedItemsPanel.style.display = 'flex';
        selectedItemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;

        // Calculate actual total size from selected items
        const totalSize = selectedItems.reduce((sum, item) => sum + (item.size || 0), 0);
        selectedItemSize.textContent = formatBytes(totalSize);

        // Update selected items list
        renderSelectedItemsList();
    } else {
        selectedItemsPanel.style.display = 'none';
    }
}

// Render selected items in sidebar
function renderSelectedItemsList() {
    selectedItemsList.innerHTML = '';

    selectedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'selected-item';

        const iconClass = item.is_dir ? 'folder' : 'file';
        const iconSymbol = item.is_dir ? '📁' : '📄';
        const sizeText = formatBytes(item.size || 0);

        div.innerHTML = `
            <div class="selected-item-icon ${iconClass}">${iconSymbol}</div>
            <div class="selected-item-info">
                <div class="selected-item-name" title="${item.name}">${item.name}</div>
                <div class="selected-item-meta">
                    <span class="selected-item-type">${item.is_dir ? 'Folder' : 'File'}</span>
                    <span class="selected-item-size">${sizeText}</span>
                </div>
            </div>
            <div class="selected-item-actions">
                <button class="btn-icon preview-btn" title="Preview">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7z" stroke="currentColor" stroke-width="2"/>
                        <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
                <button class="btn-icon remove-btn" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
            </div>
        `;

        // Preview button
        div.querySelector('.preview-btn').addEventListener('click', () => {
            previewFile(item.path, item.name, true);
        });

        // Remove button
        div.querySelector('.remove-btn').addEventListener('click', () => {
            removeFromSelection(item.path);
        });

        selectedItemsList.appendChild(div);
    });
}

// Remove item from selection
function removeFromSelection(path) {
    selectedItems = selectedItems.filter(si => si.path !== path);

    // Uncheck checkbox if visible
    const checkbox = fileBrowser.querySelector(`[data-path="${path}"] .browser-item-checkbox`);
    if (checkbox) checkbox.checked = false;

    updateSelectionUI();
}

// Pull multiple selected items
async function pullMultipleItems() {
    if (selectedItems.length === 0) {
        showToast('No items selected', 'error');
        return;
    }

    if (!currentDevice) {
        showToast('No device selected', 'error');
        return;
    }

    pullSelectedBtn.classList.add('loading');
    pullSelectedBtn.disabled = true;

    showBatchProgress('Preparing to pull files...');

    try {
        const files = selectedItems.filter(item => !item.is_dir);
        const folders = selectedItems.filter(item => item.is_dir);

        let allResults = [];

        // Pull files
        if (files.length > 0) {
            const filePaths = files.map(f => f.path);
            const fileResult = await window.electronAPI.pullMultipleFiles(currentDevice, filePaths);
            if (fileResult.success) {
                allResults = allResults.concat(fileResult.results);
            }
        }

        // Pull folders recursively
        for (const folder of folders) {
            const folderResult = await window.electronAPI.pullFolderRecursive(currentDevice, folder.path);
            if (folderResult.success) {
                allResults.push({
                    success: true,
                    file: folder.name + ` (${folderResult.successCount}/${folderResult.totalFiles} files)`,
                    localPath: folderResult.localPath
                });
            } else {
                allResults.push({
                    success: false,
                    file: folder.name,
                    error: folderResult.error
                });
            }
        }

        hideBatchProgress();

        const successCount = allResults.filter(r => r.success).length;
        if (successCount === allResults.length) {
            showToast(`Successfully pulled ${selectedItems.length} item(s) to ~/Pulled/`, 'success');
        } else {
            showToast(`Pulled ${successCount}/${allResults.length} items`, 'error');
        }

        // Clear selection
        clearAllSelections();

    } catch (error) {
        console.error('Pull error:', error);
        showToast('Failed to pull items: ' + error.message, 'error');
        hideBatchProgress();
    } finally {
        pullSelectedBtn.classList.remove('loading');
        pullSelectedBtn.disabled = false;
    }
}

// Preview file functionality
async function previewFile(filePath, fileName, isAndroid) {
    previewModal.style.display = 'flex';
    previewTitle.textContent = fileName;
    previewBody.innerHTML = '<div class="preview-loading"><div class="spinner"></div><p>Loading preview...</p></div>';
    previewMetadata.innerHTML = '';

    try {
        const result = await window.electronAPI.getFilePreview(
            isAndroid ? currentDevice : null,
            filePath,
            isAndroid
        );

        if (result.success) {
            // Display metadata
            if (result.metadata) {
                const metaHtml = `
                    <span>📦 ${formatBytes(result.metadata.size)}</span>
                    <span>📄 ${result.metadata.type}</span>
                    <span>🕐 ${new Date(result.metadata.modified).toLocaleDateString()}</span>
                `;
                previewMetadata.innerHTML = metaHtml;
            }

            // Display preview
            if (result.preview) {
                if (result.preview.type === 'image') {
                    previewBody.innerHTML = `<img src="file://${result.preview.path}" class="preview-image" alt="${fileName}">`;
                } else if (result.preview.type === 'text') {
                    previewBody.innerHTML = `<div class="preview-text">${escapeHtml(result.preview.content)}</div>`;
                } else {
                    previewBody.innerHTML = '<div class="empty-state"><p>Preview not available for this file type</p></div>';
                }
            } else {
                // Show metadata only
                previewBody.innerHTML = `
                    <div class="preview-metadata-display">
                        <div class="metadata-item">
                            <div class="metadata-label">Name</div>
                            <div class="metadata-value">${result.metadata.name}</div>
                        </div>
                        <div class="metadata-item">
                            <div class="metadata-label">Size</div>
                            <div class="metadata-value">${formatBytes(result.metadata.size)}</div>
                        </div>
                        <div class="metadata-item">
                            <div class="metadata-label">Type</div>
                            <div class="metadata-value">${result.metadata.type}</div>
                        </div>
                        <div class="metadata-item">
                            <div class="metadata-label">Modified</div>
                            <div class="metadata-value">${new Date(result.metadata.modified).toLocaleString()}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            previewBody.innerHTML = `<div class="empty-state"><p>Failed to load preview: ${result.error}</p></div>`;
        }
    } catch (error) {
        console.error('Preview error:', error);
        previewBody.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
    }
}

// Close preview modal
function closePreview() {
    previewModal.style.display = 'none';
}

// Close preview on backdrop click
if (previewModal) {
    const backdrop = previewModal.querySelector('.preview-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', closePreview);
    }
}

// Escape HTML for safe display
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Batch progress overlay
let batchProgressOverlay = null;

function showBatchProgress(title) {
    if (!batchProgressOverlay) {
        batchProgressOverlay = document.createElement('div');
        batchProgressOverlay.className = 'batch-progress-overlay';
        batchProgressOverlay.innerHTML = `
            <div class="batch-progress-content">
                <div class="batch-progress-title" id="batchProgressTitle">${title}</div>
                <div class="batch-progress-bar">
                    <div class="batch-progress-fill" id="batchProgressFill" style="width: 0%"></div>
                </div>
                <div class="batch-progress-text" id="batchProgressText">Preparing...</div>
                <div class="batch-progress-file" id="batchProgressFile"></div>
            </div>
        `;
        document.body.appendChild(batchProgressOverlay);
    } else {
        batchProgressOverlay.style.display = 'flex';
        document.getElementById('batchProgressTitle').textContent = title;
        document.getElementById('batchProgressFill').style.width = '0%';
        document.getElementById('batchProgressText').textContent = 'Preparing...';
        document.getElementById('batchProgressFile').textContent = '';
    }
}

function updateBatchProgress(data) {
    if (!batchProgressOverlay) return;

    const percent = (data.current / data.total) * 100;
    document.getElementById('batchProgressFill').style.width = percent + '%';
    document.getElementById('batchProgressText').textContent = `${data.status === 'pulling' ? 'Pulling' : 'Pushing'}: ${data.current} of ${data.total}`;
    document.getElementById('batchProgressFile').textContent = data.currentFile;
}

function hideBatchProgress() {
    if (batchProgressOverlay) {
        batchProgressOverlay.style.display = 'none';
    }
}

// ============ PUSH MODE FOLDER SELECTION ============

async function selectFolder() {
    try {
        const result = await window.electronAPI.selectFolder();

        if (!result.canceled) {
            // Add folder to selected files list
            showToast(`Added folder: ${result.name}`, 'success');

            // Create a folder item in the list with actual size
            const folderItem = {
                path: result.folderPath,
                name: result.name,
                isFolder: true,
                size: result.size || 0  // Use the calculated folder size
            };

            // Add to UI
            addFolderToList(folderItem);
        }
    } catch (error) {
        console.error('Folder selection error:', error);
        showToast('Failed to select folder', 'error');
    }
}

function addFolderToList(folder) {
    // Show file list if hidden
    if (selectedFiles.length === 0 && fileListContainer.style.display === 'none') {
        showFileList();
    }

    // Add folder marker to selected files with actual size
    selectedFiles.push({
        path: folder.path,
        name: folder.name,
        size: folder.size || 0,  // Use the actual folder size
        isFolder: true
    });

    updateFileList();
}

// Override updateFileList with enhanced version that supports folders and preview
function updateFileList() {
    fileCount.textContent = selectedFiles.length;

    // Calculate and display total size
    const totalSize = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    if (totalFileSize) {
        totalFileSize.textContent = formatBytes(totalSize);
    }

    fileList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const fileItem = createEnhancedFileItem(file, index);
        fileList.appendChild(fileItem);
    });
}

function createEnhancedFileItem(file, index) {
    const item = document.createElement('div');
    item.className = 'file-item';

    const ext = file.isFolder ? 'DIR' : (file.name.split('.').pop().toUpperCase().slice(0, 3));
    const icon = file.isFolder ? '📁' : ext;
    const sizeDisplay = file.isFolder ? formatBytes(file.size) : formatBytes(file.size);

    item.innerHTML = `
        <div class="file-icon">${icon}</div>
        <div class="file-info">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-size">${sizeDisplay}</div>
        </div>
        ${!file.isFolder ? `
        <button class="btn-icon preview-file-btn" data-index="${index}" title="Preview">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7z" stroke="currentColor" stroke-width="2"/>
                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
            </svg>
        </button>
        ` : ''}
        <button class="file-remove" data-index="${index}">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>
    `;

    // Preview button for files
    const previewBtn = item.querySelector('.preview-file-btn');
    if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            previewFile(file.path, file.name, false);
        });
    }

    // Remove button
    item.querySelector('.file-remove').addEventListener('click', () => removeFile(index));

    return item;
}

// Override transferFiles with enhanced version that supports folders
async function transferFiles() {
    if (selectedFiles.length === 0) {
        showToast('No files selected', 'error');
        return;
    }

    if (isTransferring) {
        return;
    }

    const deviceCheck = await window.electronAPI.checkDevice();
    if (!deviceCheck.success) {
        showToast('No Android device connected', 'error');
        return;
    }

    isTransferring = true;
    transferBtn.classList.add('loading');
    transferBtn.disabled = true;

    showBatchProgress('Pushing files to Android...');

    try {
        const regularFiles = selectedFiles.filter(f => !f.isFolder).map(f => f.path);
        const folders = selectedFiles.filter(f => f.isFolder);

        let allResults = [];

        // Transfer regular files
        if (regularFiles.length > 0) {
            const fileResults = await window.electronAPI.transferFiles(regularFiles);
            allResults = allResults.concat(fileResults);
        }

        // Transfer folders
        for (const folder of folders) {
            const folderResult = await window.electronAPI.transferFolder(folder.path);
            if (folderResult.success) {
                allResults.push({
                    file: folder.name + ` (${folderResult.successCount}/${folderResult.totalFiles} files)`,
                    success: true,
                    message: `Transferred to ${folderResult.remotePath}`
                });
            } else {
                allResults.push({
                    file: folder.name,
                    success: false,
                    error: 'Failed to transfer folder'
                });
            }
        }

        hideBatchProgress();
        showTransferResults(allResults);
    } catch (error) {
        hideBatchProgress();
        showToast('Transfer failed: ' + error.message, 'error');
        console.error('Transfer error:', error);
    } finally {
        isTransferring = false;
        transferBtn.classList.remove('loading');
        transferBtn.disabled = false;
    }
}
