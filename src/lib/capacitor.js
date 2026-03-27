// Luna Loops - Capacitor Native Integration
// Platform-specific features for iOS and Android

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Check if running as native app
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

// Theme colors matching the app's dark cosmic theme
const THEME = {
  backgroundColor: '#040810',
  statusBarStyle: Style.Dark,
};

/**
 * Initialize native features on app startup
 * Call this once in main.jsx or App.jsx after mount
 */
export async function initializeNative() {
  if (!isNative) return;

  try {
    // Configure status bar for dark theme
    await configureStatusBar();

    // Hide splash screen after app is ready
    // Give React time to render initial content
    await hideSplashScreen();
  } catch (error) {
    console.warn('Native initialization warning:', error);
  }
}

/**
 * Configure status bar appearance
 */
async function configureStatusBar() {
  if (!isNative) return;

  try {
    // Set status bar style to light content (for dark backgrounds)
    await StatusBar.setStyle({ style: THEME.statusBarStyle });

    // Set background color on Android
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: THEME.backgroundColor });
    }

    // Ensure status bar is visible
    await StatusBar.show();
  } catch (error) {
    console.warn('StatusBar configuration warning:', error);
  }
}

/**
 * Hide splash screen with fade animation
 */
async function hideSplashScreen() {
  if (!isNative) return;

  try {
    await SplashScreen.hide({
      fadeOutDuration: 300,
    });
  } catch (error) {
    console.warn('SplashScreen hide warning:', error);
  }
}

/**
 * Show splash screen (useful for heavy loading states)
 */
export async function showSplash() {
  if (!isNative) return;

  try {
    await SplashScreen.show({
      autoHide: false,
    });
  } catch (error) {
    console.warn('SplashScreen show warning:', error);
  }
}

// ===== Haptic Feedback =====

/**
 * Light haptic feedback - for UI interactions like button taps
 */
export async function hapticLight() {
  if (!isNative) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    // Silently fail - haptics are non-critical
  }
}

/**
 * Medium haptic feedback - for confirming actions
 */
export async function hapticMedium() {
  if (!isNative) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Heavy haptic feedback - for significant events
 */
export async function hapticHeavy() {
  if (!isNative) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Success notification haptic - for completed actions
 */
export async function hapticSuccess() {
  if (!isNative) return;

  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Warning notification haptic - for destructive or important actions
 */
export async function hapticWarning() {
  if (!isNative) return;

  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Error notification haptic - for failed actions
 */
export async function hapticError() {
  if (!isNative) return;

  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    // Silently fail
  }
}

/**
 * Selection changed haptic - for picker/selection changes
 */
export async function hapticSelection() {
  if (!isNative) return;

  try {
    await Haptics.selectionChanged();
  } catch (error) {
    // Silently fail
  }
}

// ===== Status Bar Controls =====

/**
 * Hide status bar (for immersive experiences)
 */
export async function hideStatusBar() {
  if (!isNative) return;

  try {
    await StatusBar.hide();
  } catch (error) {
    console.warn('StatusBar hide warning:', error);
  }
}

/**
 * Show status bar
 */
export async function showStatusBar() {
  if (!isNative) return;

  try {
    await StatusBar.show();
    await configureStatusBar();
  } catch (error) {
    console.warn('StatusBar show warning:', error);
  }
}

// ===== Safe Area Utilities =====

/**
 * Get safe area insets for proper layout on notched devices
 * Returns CSS environment variable values or fallbacks
 */
export function getSafeAreaInsets() {
  return {
    top: 'env(safe-area-inset-top, 0px)',
    right: 'env(safe-area-inset-right, 0px)',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 'env(safe-area-inset-left, 0px)',
  };
}

/**
 * CSS styles for safe area padding
 */
export const safeAreaStyles = {
  paddingTop: 'env(safe-area-inset-top, 0px)',
  paddingRight: 'env(safe-area-inset-right, 0px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  paddingLeft: 'env(safe-area-inset-left, 0px)',
};
