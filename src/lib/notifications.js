// Luna Loops - Notifications
// Web Push Notifications & Capacitor Local Notifications for phase transitions

const NOTIFICATION_KEY = 'cosmic_notifications_v1';
const LAST_NOTIFIED_KEY = 'cosmic_last_notified_v1';

let LocalNotifications = null;
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
let capacitorPermissionGranted = false;

if (isCapacitor) {
  import('@capacitor/local-notifications').then((module) => {
    LocalNotifications = module.LocalNotifications;
    LocalNotifications.checkPermissions().then((status) => {
      capacitorPermissionGranted = status.display === 'granted';
    });
  }).catch(err => {
    console.warn('Failed to load Capacitor LocalNotifications module:', err);
  });
}

// Check if notifications are supported and permitted
export function canNotify() {
  if (isCapacitor) {
    return capacitorPermissionGranted;
  }
  return 'Notification' in window && Notification.permission === 'granted';
}

// Request notification permission
export async function requestPermission() {
  if (isCapacitor) {
    try {
      if (!LocalNotifications) {
        const module = await import('@capacitor/local-notifications');
        LocalNotifications = module.LocalNotifications;
      }
      const status = await LocalNotifications.requestPermissions();
      capacitorPermissionGranted = status.display === 'granted';
      return capacitorPermissionGranted;
    } catch (e) {
      console.warn('Capacitor requestPermissions failed:', e);
      return false;
    }
  }

  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Get notification preferences
export function getNotificationPrefs() {
  try {
    const prefs = localStorage.getItem(NOTIFICATION_KEY);
    return prefs
      ? JSON.parse(prefs)
      : {
          enabled: false,
          phaseTransitions: true,
          newCycle: true,
          thresholdPhases: true,
          flowPhases: true,
        };
  } catch {
    return { enabled: false };
  }
}

// Save notification preferences
export function saveNotificationPrefs(prefs) {
  try {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save notification prefs:', e);
  }
}

// Get last notified phase to avoid duplicate notifications
function getLastNotified() {
  try {
    const data = localStorage.getItem(LAST_NOTIFIED_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Mark phase as notified
function markNotified(phaseKey, type) {
  try {
    const data = getLastNotified();
    data[`${phaseKey}_${type}`] = Date.now();
    localStorage.setItem(LAST_NOTIFIED_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save notification state:', e);
  }
}

// Check if we already notified for this phase
function wasNotified(phaseKey, type, withinMs = 12 * 60 * 60 * 1000) {
  const data = getLastNotified();
  const lastTime = data[`${phaseKey}_${type}`];
  if (!lastTime) return false;
  return Date.now() - lastTime < withinMs;
}

// Helper to generate simple hash from string tag for numeric notification ID
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

// Send a notification (synchronous signature, async schedule)
export function sendNotification(title, body, tag) {
  if (isCapacitor) {
    const numericId = Math.abs(tag ? hashString(tag) : Math.floor(Math.random() * 1000000));
    
    if (!LocalNotifications) {
      import('@capacitor/local-notifications').then((module) => {
        LocalNotifications = module.LocalNotifications;
        LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: numericId,
              extra: { tag },
            }
          ]
        }).catch(e => console.warn('Failed to schedule local notification:', e));
      }).catch(err => {
        console.warn('Failed to load Capacitor LocalNotifications module:', err);
      });
      return true;
    }

    try {
      LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: numericId,
            extra: { tag },
          }
        ]
      }).catch(e => console.warn('Failed to schedule local notification:', e));
      return true;
    } catch (e) {
      console.warn('Failed to schedule local notification:', e);
      return false;
    }
  }

  if (!canNotify()) return false;

  try {
    const notification = new Notification(title, {
      body,
      tag, // Prevents duplicate notifications with same tag
      icon: '/moon-icon.png',
      badge: '/moon-badge.png',
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (e) {
    console.warn('Failed to send notification:', e);
    return false;
  }
}

// Check and send phase transition notifications
export function checkPhaseNotifications(lunarData) {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled || !canNotify()) return;

  const { isApproaching, isNewCycleApproaching, nextPhase, nextPhaseType, remainingHours, phase } =
    lunarData;

  if (!isApproaching) return;

  // Determine notification type
  const isThreshold = nextPhaseType === 'threshold';
  const isNewCycle = isNewCycleApproaching;

  // Check preferences
  if (isNewCycle && !prefs.newCycle) return;
  if (isThreshold && !prefs.thresholdPhases) return;
  if (!isThreshold && !isNewCycle && !prefs.flowPhases) return;

  // Build notification key
  const notifyKey = `${phase.key}_to_${lunarData.nextPhase}`;

  // Check if already notified
  if (wasNotified(notifyKey, 'approaching')) return;

  // Build notification content
  let title, body;

  if (isNewCycle) {
    title = '🌑 New Lunar Cycle Approaching';
    body = `${remainingHours.toFixed(1)}h until the New Moon. A new cycle begins. What seeds will you plant?`;
  } else if (isThreshold) {
    title = `${lunarData.nextSymbol} ${nextPhase} Approaching`;
    body = `${remainingHours.toFixed(1)}h until this threshold moment. Brief and potent.`;
  } else {
    title = `${lunarData.nextSymbol} ${nextPhase} Approaching`;
    body = `${remainingHours.toFixed(1)}h until this flow phase begins. Time to settle in.`;
  }

  // Send notification
  if (sendNotification(title, body, notifyKey)) {
    markNotified(notifyKey, 'approaching');
  }
}

// Schedule periodic notification checks (call this on app load)
export function startNotificationScheduler(getLunarDataFn) {
  // Check every 15 minutes
  const checkInterval = 15 * 60 * 1000;

  const check = () => {
    const lunarData = getLunarDataFn();
    checkPhaseNotifications(lunarData);
  };

  // Initial check
  check();

  // Periodic checks
  const intervalId = setInterval(check, checkInterval);

  return () => clearInterval(intervalId);
}
