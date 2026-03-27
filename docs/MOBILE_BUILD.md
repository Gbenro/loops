# Luna Loops - Mobile Build Guide

This guide covers building and deploying the Luna Loops mobile app for iOS and Android using Capacitor.

## Prerequisites

### General Requirements
- Node.js 18+ and npm
- Git

### iOS Requirements
- macOS (required)
- Xcode 15+ (from Mac App Store)
- Xcode Command Line Tools: `xcode-select --install`
- CocoaPods: `sudo gem install cocoapods`
- Apple Developer account (for App Store distribution)

### Android Requirements
- Android Studio (latest stable)
- Android SDK (API level 24 minimum, 36 target)
- Java Development Kit (JDK) 17+
- For physical device testing: USB debugging enabled

## Quick Start

### Development Build

```bash
# Install dependencies
npm install

# Build web assets and sync to native projects
npm run cap:sync

# Open in Android Studio
npm run cap:android

# Open in Xcode (macOS only)
npm run cap:ios
```

### Full Build Commands

```bash
# Build web assets only
npm run build

# Sync web assets to native platforms
npx cap sync

# Open Android project
npx cap open android

# Open iOS project
npx cap open ios

# Run on Android emulator/device
npx cap run android

# Run on iOS simulator
npx cap run ios
```

## Project Structure

```
├── capacitor.config.json    # Capacitor configuration
├── android/                 # Android native project
│   └── app/
│       └── src/main/
│           ├── AndroidManifest.xml
│           └── res/
│               ├── mipmap-*/        # App icons
│               ├── drawable-*/      # Splash screens
│               └── values/          # Colors, strings, styles
├── ios/                     # iOS native project
│   └── App/
│       ├── App/
│       │   ├── Info.plist
│       │   ├── Assets.xcassets/     # Icons & splash
│       │   └── Base.lproj/          # Storyboards
│       └── App.xcodeproj/
└── src/
    └── lib/
        └── capacitor.js     # Native feature integration
```

## Native Features

The app uses several Capacitor plugins for native functionality:

| Plugin | Purpose |
|--------|---------|
| `@capacitor/status-bar` | Dark mode status bar styling |
| `@capacitor/splash-screen` | Launch screen management |
| `@capacitor/haptics` | Tactile feedback on interactions |
| `@capacitor/local-notifications` | Moon phase alerts |

### Using Haptic Feedback

Import from the capacitor module:

```javascript
import { hapticLight, hapticSuccess, hapticSelection } from './lib/capacitor.js';

// Button tap feedback
onClick={() => {
  hapticLight();
  // ... action
}}

// Success feedback
hapticSuccess();

// Picker/selection feedback
hapticSelection();
```

### Platform Detection

```javascript
import { isNative, platform } from './lib/capacitor.js';

if (isNative) {
  // Native-only code
  console.log(`Running on ${platform}`); // 'ios' or 'android'
}
```

## Building for Release

### Android Release Build

1. Open in Android Studio: `npx cap open android`
2. Generate signed APK/Bundle:
   - Build > Generate Signed Bundle/APK
   - Create or select your keystore
   - Choose release build variant
3. The output will be in `android/app/build/outputs/`

### iOS Release Build

1. Open in Xcode: `npx cap open ios`
2. Select your development team in Signing & Capabilities
3. Archive for distribution:
   - Product > Archive
   - Distribute App > App Store Connect

## App Store Configuration

### App Identity
- **Bundle ID**: `com.cosmicloops.app`
- **App Name**: Luna Loops
- **Version**: 1.0.0

### Required Assets
All assets are already configured in the project:

| Asset | iOS | Android |
|-------|-----|---------|
| App Icon | 1024x1024 PNG | Multiple densities (mdpi to xxxhdpi) |
| Splash Screen | 2732x2732 PNG | Multiple densities + orientations |

### Permissions (Currently Used)
- **Internet Access**: Required for Supabase sync

### Permissions (May be Required Later)
- Push Notifications: For phase alerts
- Background Refresh: For scheduled notifications

## Updating Native Assets

### Regenerating Icons

If you need to update the app icon:

1. Create a 1024x1024 PNG source icon
2. Use a tool like [capacitor-assets](https://github.com/ionic-team/capacitor-assets):
   ```bash
   npx @capacitor/assets generate --iconBackgroundColor '#040810'
   ```

### Regenerating Splash Screens

1. Create a 2732x2732 PNG source splash image
2. Generate for all platforms:
   ```bash
   npx @capacitor/assets generate --splashBackgroundColor '#040810'
   ```

## Troubleshooting

### Build Fails with "Module not found"
Run `npm install` and `npx cap sync` again.

### iOS Build Fails
- Ensure Xcode is up to date
- Try cleaning: Xcode > Product > Clean Build Folder
- Reset pods: `cd ios/App && pod install --repo-update`

### Android Build Fails
- Ensure Android SDK is properly configured
- Check `android/variables.gradle` for SDK versions
- Sync Gradle: Android Studio > File > Sync Project with Gradle Files

### Capacitor Plugin Not Working
- Verify plugin is installed: `npm ls @capacitor/[plugin-name]`
- Run `npx cap sync` to update native projects
- Check the plugin is imported correctly in JavaScript

## Theme Colors

The app uses a consistent dark cosmic theme:

| Element | Color |
|---------|-------|
| Background | `#040810` |
| Accent | `#a78bfa` |
| Text | `#f5e6c8` |
| Status Bar | Dark (light content) |

## Contact

For mobile-specific issues or questions, reach out to the Mobile Engineer.
