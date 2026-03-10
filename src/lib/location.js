// Location detection and hemisphere derivation

const LOCATION_KEY = 'luna_location_v1';

export function getCachedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const loc = JSON.parse(raw);
    // Expire after 7 days — user might travel
    if (Date.now() - loc.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return loc;
  } catch {
    return null;
  }
}

export function cacheLocation(loc) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ ...loc, savedAt: Date.now() }));
  } catch {}
}

export function hemisphereFromLat(latitude) {
  return latitude >= 0 ? 'north' : 'south';
}

export function detectLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          hemisphere: hemisphereFromLat(pos.coords.latitude),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        cacheLocation(loc);
        resolve(loc);
      },
      () => resolve(null), // denied or unavailable
      { timeout: 8000, maximumAge: 60 * 60 * 1000 } // accept cached GPS up to 1 hour old
    );
  });
}
