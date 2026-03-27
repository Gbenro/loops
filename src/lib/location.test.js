import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedLocation,
  cacheLocation,
  hemisphereFromLat,
  detectLocation,
} from './location.js';

describe('location.js', () => {
  let mockStorage = {};

  beforeEach(() => {
    // Create a working localStorage mock
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(
      (key) => mockStorage[key] || null
    );
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => {
      delete mockStorage[key];
    });
    vi.spyOn(window.localStorage, 'clear').mockImplementation(() => {
      mockStorage = {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hemisphereFromLat', () => {
    it('returns north for positive latitudes', () => {
      expect(hemisphereFromLat(45)).toBe('north');
      expect(hemisphereFromLat(90)).toBe('north');
      expect(hemisphereFromLat(1)).toBe('north');
    });

    it('returns north for zero latitude (equator)', () => {
      expect(hemisphereFromLat(0)).toBe('north');
    });

    it('returns south for negative latitudes', () => {
      expect(hemisphereFromLat(-45)).toBe('south');
      expect(hemisphereFromLat(-90)).toBe('south');
      expect(hemisphereFromLat(-1)).toBe('south');
    });
  });

  describe('cacheLocation', () => {
    it('stores location in localStorage with timestamp', () => {
      const location = {
        latitude: 37.7749,
        longitude: -122.4194,
        hemisphere: 'north',
        timezone: 'America/Los_Angeles',
      };

      cacheLocation(location);

      const stored = JSON.parse(mockStorage['luna_location_v1']);
      expect(stored.latitude).toBe(37.7749);
      expect(stored.longitude).toBe(-122.4194);
      expect(stored.hemisphere).toBe('north');
      expect(stored.timezone).toBe('America/Los_Angeles');
      expect(stored.savedAt).toBeDefined();
      expect(typeof stored.savedAt).toBe('number');
    });

    it('handles localStorage errors gracefully', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      const location = { latitude: 37.7749, longitude: -122.4194 };
      expect(() => cacheLocation(location)).not.toThrow();
    });
  });

  describe('getCachedLocation', () => {
    it('returns null when no location is cached', () => {
      expect(getCachedLocation()).toBeNull();
    });

    it('returns cached location when fresh', () => {
      const location = {
        latitude: 51.5074,
        longitude: -0.1278,
        hemisphere: 'north',
        timezone: 'Europe/London',
        savedAt: Date.now(),
      };
      mockStorage['luna_location_v1'] = JSON.stringify(location);

      const result = getCachedLocation();
      expect(result.latitude).toBe(51.5074);
      expect(result.longitude).toBe(-0.1278);
      expect(result.hemisphere).toBe('north');
    });

    it('returns null when cached location is expired (older than 7 days)', () => {
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const location = {
        latitude: 35.6762,
        longitude: 139.6503,
        hemisphere: 'north',
        savedAt: eightDaysAgo,
      };
      mockStorage['luna_location_v1'] = JSON.stringify(location);

      expect(getCachedLocation()).toBeNull();
    });

    it('returns location when cached less than 7 days ago', () => {
      const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
      const location = {
        latitude: -33.8688,
        longitude: 151.2093,
        hemisphere: 'south',
        savedAt: sixDaysAgo,
      };
      mockStorage['luna_location_v1'] = JSON.stringify(location);

      const result = getCachedLocation();
      expect(result).not.toBeNull();
      expect(result.latitude).toBe(-33.8688);
    });

    it('returns null when localStorage contains invalid JSON', () => {
      mockStorage['luna_location_v1'] = 'invalid json';
      expect(getCachedLocation()).toBeNull();
    });
  });

  describe('detectLocation', () => {
    let mockGeolocation;

    beforeEach(() => {
      mockGeolocation = {
        getCurrentPosition: vi.fn(),
      };
      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
        configurable: true,
      });
    });

    it('resolves null when geolocation is not available', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await detectLocation();
      expect(result).toBeNull();
    });

    it('resolves with location data on success', async () => {
      const mockPosition = {
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
        },
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) =>
        success(mockPosition)
      );

      const result = await detectLocation();
      expect(result.latitude).toBe(40.7128);
      expect(result.longitude).toBe(-74.006);
      expect(result.hemisphere).toBe('north');
      expect(result.timezone).toBeDefined();
    });

    it('resolves null when user denies location access', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) =>
        error({ code: 1, message: 'User denied' })
      );

      const result = await detectLocation();
      expect(result).toBeNull();
    });

    it('caches location on successful detection', async () => {
      const mockPosition = {
        coords: {
          latitude: -23.5505,
          longitude: -46.6333,
        },
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) =>
        success(mockPosition)
      );

      await detectLocation();

      const cached = getCachedLocation();
      expect(cached).not.toBeNull();
      expect(cached.latitude).toBe(-23.5505);
      expect(cached.hemisphere).toBe('south');
    });

    it('correctly determines hemisphere for southern latitude', async () => {
      const mockPosition = {
        coords: {
          latitude: -34.6037,
          longitude: -58.3816,
        },
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) =>
        success(mockPosition)
      );

      const result = await detectLocation();
      expect(result.hemisphere).toBe('south');
    });
  });
});
