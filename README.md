# FreeDroid - Bidirectional Mac ↔ Android File Transfer

A beautiful, standalone macOS application for transferring files between your Mac and Android devices via USB. Transfer files **to** Android (push) or **from** Android (pull) with an intuitive interface.

## Features

🎨 **Modern UI** - Beautiful dark-mode interface with tab-based navigation  
📁 **Bidirectional Transfer** - Send files to Android OR pull files from Android  
🗂️ **File Browser** - Navigate Android filesystem with breadcrumb navigation  
🔄 **Real-time Status** - Live device connection detection  

## Installation

### Download

Download the latest release from **[GitHub Releases](https://github.com/arsalxan/FreeDroid/releases)**:
- `FreeDroid-1.0.0.dmg` - macOS disk image (recommended)
- `FreeDroid-1.0.0-mac.zip` - Zipped app bundle

### Install on macOS

1. Download `FreeDroid-1.0.0.dmg` from releases
2. Open the DMG file
3. Drag **FreeDroid** to your **Applications** folder

### ⚠️ First Launch (Important!)

Since FreeDroid is not signed with an Apple Developer certificate, macOS Gatekeeper will block it. **Run this command once** to allow it:

```bash
sudo xattr -d com.apple.quarantine /Applications/FreeDroid.app
```

Then double-click to open normally. You'll only need to do this once!

<details>
<summary>💡 Why is this needed?</summary>

Apple requires developers to pay $99/year for code signing certificates. Without this, macOS blocks apps from "unidentified developers" by default. The command above tells macOS you trust this app.
</details>

## Usage

### Step 1: Enable USB Debugging on Android

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times to enable Developer Options
3. Go to **Settings** → **Developer Options**
4. Enable **USB Debugging**

### Step 2: Connect Your Device

1. Connect your Android device to your Mac via USB cable
2. On your Android device, authorize the USB debugging connection when prompted
3. Wait for the "Device Connected" indicator to turn green in the app

### Step 3: Transfer Files

#### Push Mode: Mac → Android

1. Launch FreeDroid (default mode is Push)
2. Either:
   - Drag and drop files into the app window
   - Click "Select Files" to browse for files
3. Click "Send to Android"
4. Files will appear in your Android's **Download** folder

#### Pull Mode: Android → Mac

1. Click the "Pull from Android" tab
2. Select your device from the dropdown (auto-selected if only one device)
3. Browse through your Android filesystem:
   - Click folders to navigate into them
   - Use breadcrumb navigation to go back
4. Click on a file to select it
5. Click "Pull Selected File"
6. Files will be saved to **~/Pulled/** folder on your Mac

## Building from Source

### Prerequisites

- Node.js 16 or higher
- npm or yarn
- macOS (for building .app and .dmg)

### Steps

```bash
# Navigate to the app directory
cd FreeDroidApp

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production (creates DMG)
npm run build:mac
```

The built files will be in the `dist` folder:
- `FreeDroid-1.0.0.dmg` - Installer image for distribution
- `FreeDroid-1.0.0-mac.zip` - App bundle archive

### Testing in Development

```bash
# Run with DevTools open
npm run dev
```

## Technical Details

- **Frontend**: Electron + HTML/CSS/JavaScript
- **Backend**: Node.js (main process)
- **Transfer Protocol**: ADB (Android Debug Bridge)
- **Push Target**: `/sdcard/Download/` on Android
- **Pull Target**: `~/Pulled/` on Mac
- **Distribution**: DMG (macOS disk image) for easy installation

## Troubleshooting

### "No Device" showing

- Ensure USB debugging is enabled on your Android device
- Try unplugging and reconnecting the USB cable
- On Android, check if the USB debugging authorization dialog appeared
- Try a different USB cable (some cables are charge-only)

### Transfer fails

- Make sure your Android device has enough storage space
- Check that the target folder is accessible on your device
- Try restarting both the app and your Android device

### Pull mode shows "No devices found"

- Verify USB debugging is enabled
- Check that the device appears in Push mode
- Try switching tabs to refresh device list
- Reconnect your device

### Files not appearing after pull

- Check the `~/Pulled/` folder in your home directory
- Verify you selected a file (not a folder) before clicking Pull
- Check console for error messages

## License

MIT License - feel free to use and modify!
