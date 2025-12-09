const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * afterPack hook for electron-builder
 * Fixes permissions on bundled binaries (like ADB) after packaging
 */
exports.default = async function (context) {
    const appPath = context.appOutDir;
    const platform = context.electronPlatformName;

    if (platform !== 'darwin') {
        console.log('Skipping afterPack - not macOS');
        return;
    }

    console.log('Running afterPack hook for macOS...');
    console.log('App output directory:', appPath);

    // Find the .app bundle
    const appName = context.packager.appInfo.productFilename + '.app';
    const appBundlePath = path.join(appPath, appName);

    if (!fs.existsSync(appBundlePath)) {
        console.error('App bundle not found at:', appBundlePath);
        return;
    }

    console.log('App bundle path:', appBundlePath);

    // Path to platform-tools inside the app bundle
    const platformToolsPath = path.join(
        appBundlePath,
        'Contents',
        'Resources',
        'platform-tools'
    );

    // Fix ADB binary permissions
    const adbPath = path.join(platformToolsPath, 'adb');

    if (fs.existsSync(adbPath)) {
        console.log('Fixing ADB permissions at:', adbPath);
        try {
            // Make ADB executable
            execSync(`chmod +x "${adbPath}"`, { stdio: 'inherit' });
            console.log('✓ ADB permissions fixed');

            // Sign ADB with ad-hoc signature
            console.log('Signing ADB with ad-hoc signature...');
            execSync(`codesign --force --deep --sign - "${adbPath}"`, { stdio: 'inherit' });
            console.log('✓ ADB signed');
        } catch (error) {
            console.error('Error fixing ADB:', error.message);
        }
    } else {
        console.log('ADB not found at:', adbPath);
        // Try alternate locations
        const altPaths = [
            path.join(platformToolsPath, 'mac', 'adb'),
            path.join(appBundlePath, 'Contents', 'Resources', 'app', 'resources', 'platform-tools', 'adb'),
            path.join(appBundlePath, 'Contents', 'Resources', 'app', 'resources', 'platform-tools', 'mac', 'adb'),
        ];

        for (const altPath of altPaths) {
            if (fs.existsSync(altPath)) {
                console.log('Found ADB at alternate path:', altPath);
                try {
                    execSync(`chmod +x "${altPath}"`, { stdio: 'inherit' });
                    execSync(`codesign --force --deep --sign - "${altPath}"`, { stdio: 'inherit' });
                    console.log('✓ ADB at alternate path fixed and signed');
                } catch (error) {
                    console.error('Error fixing ADB at alternate path:', error.message);
                }
                break;
            }
        }
    }

    // Deep sign the entire app bundle
    console.log('Deep signing the entire app bundle...');
    try {
        execSync(`codesign --force --deep --sign - "${appBundlePath}"`, { stdio: 'inherit' });
        console.log('✓ App bundle signed');
    } catch (error) {
        console.error('Error signing app bundle:', error.message);
    }

    // Verify the signature
    console.log('Verifying signature...');
    try {
        execSync(`codesign --verify --deep --verbose=2 "${appBundlePath}"`, { stdio: 'inherit' });
        console.log('✓ Signature verified');
    } catch (error) {
        console.warn('Signature verification warning:', error.message);
    }

    console.log('afterPack hook completed');
};
