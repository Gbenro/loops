import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { EncryptionProvider } from './lib/EncryptionContext.jsx'

// Import seed data for development/testing (exposes window.seedData)
import { seedAllData } from './lib/seedData.js'

// Auto-seed when ?seed=true is in the URL (dev convenience)
if (new URLSearchParams(window.location.search).get('seed') === 'true') {
  seedAllData({ cycleCount: 3, clearExisting: true });
  // Clean the URL so refresh doesn't re-seed
  const url = new URL(window.location);
  url.searchParams.delete('seed');
  window.history.replaceState({}, '', url);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EncryptionProvider>
      <App />
    </EncryptionProvider>
  </StrictMode>
)
