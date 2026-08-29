import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { initializeNative } from './lib/capacitor.js';
import { EncryptionProvider } from './lib/EncryptionContext.jsx';
import AppWithOnboarding from './App.jsx';

// Initialize Capacitor native plugins and clear stale web caches
if (Capacitor.isNativePlatform()) {
  initializeNative();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

// Auto-seed when ?seed=true is in the URL (dev convenience)
if (new URLSearchParams(window.location.search).get('seed') === 'true') {
  import('./lib/seedData.js').then(({ seedAllData }) => {
    seedAllData({ cycleCount: 3, clearExisting: true });
  });
}

const root = createRoot(document.getElementById('root'));
root.render(
  <EncryptionProvider>
    <AppWithOnboarding />
  </EncryptionProvider>
);
