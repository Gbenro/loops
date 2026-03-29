import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  canNotify,
  requestPermission,
  getNotificationPrefs,
  saveNotificationPrefs,
  sendNotification,
  checkPhaseNotifications,
  startNotificationScheduler,
} from './notifications.js';

describe('notifications.js', () => {
  let mockStorage = {};
  let mockNotification;
  let notificationInstances = [];

  beforeEach(() => {
    // Mock localStorage
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => mockStorage[key] || null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });

    // Mock Notification API
    notificationInstances = [];
    mockNotification = vi.fn((title, options) => {
      const instance = {
        title,
        options,
        onclick: null,
        close: vi.fn(),
      };
      notificationInstances.push(instance);
      return instance;
    });

    global.Notification = mockNotification;
    global.Notification.permission = 'default';
    global.Notification.requestPermission = vi.fn(async () => 'granted');

    // Mock Date.now for consistent timestamps
    vi.spyOn(Date, 'now').mockReturnValue(1709251200000); // 2024-03-01 00:00:00 UTC
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.Notification;
  });

  describe('canNotify', () => {
    it('returns true when Notification API exists and permission granted', () => {
      global.Notification.permission = 'granted';
      expect(canNotify()).toBe(true);
    });

    it('returns false when permission is default', () => {
      global.Notification.permission = 'default';
      expect(canNotify()).toBe(false);
    });

    it('returns false when permission is denied', () => {
      global.Notification.permission = 'denied';
      expect(canNotify()).toBe(false);
    });

    it('returns false when Notification API does not exist', () => {
      delete global.Notification;
      expect(canNotify()).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('returns true if permission already granted', async () => {
      global.Notification.permission = 'granted';
      const result = await requestPermission();
      expect(result).toBe(true);
      expect(global.Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('returns false if permission denied', async () => {
      global.Notification.permission = 'denied';
      const result = await requestPermission();
      expect(result).toBe(false);
      expect(global.Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission and returns true if granted', async () => {
      global.Notification.permission = 'default';
      global.Notification.requestPermission = vi.fn(async () => 'granted');

      const result = await requestPermission();
      expect(result).toBe(true);
      expect(global.Notification.requestPermission).toHaveBeenCalled();
    });

    it('requests permission and returns false if denied', async () => {
      global.Notification.permission = 'default';
      global.Notification.requestPermission = vi.fn(async () => 'denied');

      const result = await requestPermission();
      expect(result).toBe(false);
    });

    it('returns false if Notification API does not exist', async () => {
      delete global.Notification;
      const result = await requestPermission();
      expect(result).toBe(false);
    });
  });

  describe('getNotificationPrefs', () => {
    it('returns default prefs when none stored', () => {
      const prefs = getNotificationPrefs();
      expect(prefs).toEqual({
        enabled: false,
        phaseTransitions: true,
        newCycle: true,
        thresholdPhases: true,
        flowPhases: true,
      });
    });

    it('returns stored preferences', () => {
      const storedPrefs = {
        enabled: true,
        phaseTransitions: true,
        newCycle: false,
        thresholdPhases: true,
        flowPhases: false,
      };
      mockStorage['cosmic_notifications_v1'] = JSON.stringify(storedPrefs);

      const prefs = getNotificationPrefs();
      expect(prefs).toEqual(storedPrefs);
    });

    it('returns default prefs on parse error', () => {
      mockStorage['cosmic_notifications_v1'] = 'invalid json';

      const prefs = getNotificationPrefs();
      expect(prefs).toEqual({ enabled: false });
    });
  });

  describe('saveNotificationPrefs', () => {
    it('saves preferences to localStorage', () => {
      const prefs = {
        enabled: true,
        phaseTransitions: true,
        newCycle: true,
        thresholdPhases: false,
        flowPhases: true,
      };

      saveNotificationPrefs(prefs);

      const stored = JSON.parse(mockStorage['cosmic_notifications_v1']);
      expect(stored).toEqual(prefs);
    });

    it('handles save errors gracefully', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      saveNotificationPrefs({ enabled: true });

      expect(consoleWarn).toHaveBeenCalledWith(
        'Failed to save notification prefs:',
        expect.any(Error)
      );

      consoleWarn.mockRestore();
    });
  });

  describe('sendNotification', () => {
    it('sends notification when permission granted', () => {
      global.Notification.permission = 'granted';

      const result = sendNotification('Test Title', 'Test Body', 'test-tag');

      expect(result).toBe(true);
      expect(mockNotification).toHaveBeenCalledWith('Test Title', {
        body: 'Test Body',
        tag: 'test-tag',
        icon: '/moon-icon.png',
        badge: '/moon-badge.png',
        silent: false,
      });
    });

    it('does not send notification when permission not granted', () => {
      global.Notification.permission = 'default';

      const result = sendNotification('Test Title', 'Test Body', 'test-tag');

      expect(result).toBe(false);
      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('sets onclick handler to focus window and close notification', () => {
      global.Notification.permission = 'granted';
      const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {});

      sendNotification('Test', 'Body', 'tag');

      const notification = notificationInstances[0];
      expect(notification.onclick).toBeInstanceOf(Function);

      notification.onclick();

      expect(focusSpy).toHaveBeenCalled();
      expect(notification.close).toHaveBeenCalled();

      focusSpy.mockRestore();
    });

    it('handles notification errors gracefully', () => {
      global.Notification.permission = 'granted';
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockNotification.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      const result = sendNotification('Test', 'Body', 'tag');

      expect(result).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith(
        'Failed to send notification:',
        expect.any(Error)
      );

      consoleWarn.mockRestore();
    });
  });

  describe('checkPhaseNotifications', () => {
    beforeEach(() => {
      global.Notification.permission = 'granted';
      mockStorage['cosmic_notifications_v1'] = JSON.stringify({
        enabled: true,
        phaseTransitions: true,
        newCycle: true,
        thresholdPhases: true,
        flowPhases: true,
      });
    });

    it('does not send notification if not enabled', () => {
      mockStorage['cosmic_notifications_v1'] = JSON.stringify({ enabled: false });

      const lunarData = {
        isApproaching: true,
        nextPhase: 'Full Moon',
        remainingHours: 5.5,
        phase: { key: 'waxing-gibbous' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('does not send notification if not approaching phase', () => {
      const lunarData = {
        isApproaching: false,
        nextPhase: 'Full Moon',
        remainingHours: 50,
        phase: { key: 'waxing-gibbous' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('sends new cycle notification', () => {
      const lunarData = {
        isApproaching: true,
        isNewCycleApproaching: true,
        nextPhase: 'New Moon',
        nextSymbol: '🌑',
        remainingHours: 3.5,
        phase: { key: 'waning-crescent' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).toHaveBeenCalledWith(
        '🌑 New Lunar Cycle Approaching',
        expect.objectContaining({
          body: expect.stringContaining('3.5h until the New Moon'),
          tag: 'waning-crescent_to_New Moon',
        })
      );
    });

    it('sends threshold phase notification', () => {
      const lunarData = {
        isApproaching: true,
        nextPhase: 'Full Moon',
        nextPhaseType: 'threshold',
        nextSymbol: '🌕',
        remainingHours: 2.0,
        phase: { key: 'waxing-gibbous' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).toHaveBeenCalledWith(
        '🌕 Full Moon Approaching',
        expect.objectContaining({
          body: expect.stringContaining('2.0h until this threshold moment'),
          tag: 'waxing-gibbous_to_Full Moon',
        })
      );
    });

    it('sends flow phase notification', () => {
      const lunarData = {
        isApproaching: true,
        nextPhase: 'Waxing Crescent',
        nextPhaseType: 'flow',
        nextSymbol: '🌒',
        remainingHours: 4.8,
        phase: { key: 'new' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).toHaveBeenCalledWith(
        '🌒 Waxing Crescent Approaching',
        expect.objectContaining({
          body: expect.stringContaining('4.8h until this flow phase begins'),
          tag: 'new_to_Waxing Crescent',
        })
      );
    });

    it('respects newCycle preference', () => {
      mockStorage['cosmic_notifications_v1'] = JSON.stringify({
        enabled: true,
        newCycle: false,
      });

      const lunarData = {
        isApproaching: true,
        isNewCycleApproaching: true,
        nextPhase: 'New Moon',
        remainingHours: 3,
        phase: { key: 'waning-crescent' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('respects thresholdPhases preference', () => {
      mockStorage['cosmic_notifications_v1'] = JSON.stringify({
        enabled: true,
        thresholdPhases: false,
      });

      const lunarData = {
        isApproaching: true,
        nextPhase: 'Full Moon',
        nextPhaseType: 'threshold',
        remainingHours: 2,
        phase: { key: 'waxing-gibbous' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('respects flowPhases preference', () => {
      mockStorage['cosmic_notifications_v1'] = JSON.stringify({
        enabled: true,
        flowPhases: false,
      });

      const lunarData = {
        isApproaching: true,
        nextPhase: 'Waxing Crescent',
        nextPhaseType: 'flow',
        remainingHours: 4,
        phase: { key: 'new' },
      };

      checkPhaseNotifications(lunarData);

      expect(mockNotification).not.toHaveBeenCalled();
    });

    it('does not send duplicate notifications within 12 hours', () => {
      const lunarData = {
        isApproaching: true,
        nextPhase: 'Full Moon',
        nextPhaseType: 'threshold',
        nextSymbol: '🌕',
        remainingHours: 2,
        phase: { key: 'waxing-gibbous' },
      };

      // First notification succeeds
      checkPhaseNotifications(lunarData);
      expect(mockNotification).toHaveBeenCalledTimes(1);

      // Second attempt (within 12 hours) is blocked
      mockNotification.mockClear();
      checkPhaseNotifications(lunarData);
      expect(mockNotification).not.toHaveBeenCalled();

      // After 12 hours, notification allowed again
      mockNotification.mockClear();
      Date.now.mockReturnValue(1709251200000 + 13 * 60 * 60 * 1000); // 13 hours later
      checkPhaseNotifications(lunarData);
      expect(mockNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('startNotificationScheduler', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('checks notifications immediately on start', () => {
      const getLunarData = vi.fn(() => ({
        isApproaching: false,
        phase: { key: 'new' },
      }));

      startNotificationScheduler(getLunarData);

      expect(getLunarData).toHaveBeenCalledTimes(1);
    });

    it('checks notifications every 15 minutes', () => {
      const getLunarData = vi.fn(() => ({
        isApproaching: false,
        phase: { key: 'new' },
      }));

      startNotificationScheduler(getLunarData);

      // Initial check
      expect(getLunarData).toHaveBeenCalledTimes(1);

      // After 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);
      expect(getLunarData).toHaveBeenCalledTimes(2);

      // After 30 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);
      expect(getLunarData).toHaveBeenCalledTimes(3);
    });

    it('returns cleanup function that stops scheduler', () => {
      const getLunarData = vi.fn(() => ({
        isApproaching: false,
        phase: { key: 'new' },
      }));

      const cleanup = startNotificationScheduler(getLunarData);

      expect(getLunarData).toHaveBeenCalledTimes(1);

      // Stop scheduler
      cleanup();

      // Should not check after cleanup
      vi.advanceTimersByTime(15 * 60 * 1000);
      expect(getLunarData).toHaveBeenCalledTimes(1);
    });
  });
});
