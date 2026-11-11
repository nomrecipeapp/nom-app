import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UIHost, OfflineBanner } from './ui'

// iOS only shows :active (pressed) styles once the page has a touch listener
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <UIHost />
    <OfflineBanner />
  </StrictMode>,
)
