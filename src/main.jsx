import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { EncryptionProvider } from './lib/EncryptionContext.jsx'

// Import seed data for development/testing (exposes window.seedData)
import './lib/seedData.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EncryptionProvider>
      <App />
    </EncryptionProvider>
  </StrictMode>
)
