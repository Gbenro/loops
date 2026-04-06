import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { initializeNative } from './lib/capacitor.js';
import { EncryptionProvider } from './lib/EncryptionContext.jsx';
import AppWithOnboarding from './App.jsx';

// Initialize Capacitor native plugins
if (Capacitor.isNativePlatform()) {
  initializeNative();
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
