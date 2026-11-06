// Nom Admin page (nomrecipeapp.com/admin). Separate from the app: its own entry point,
// never linked from the app or the homepage. Only accounts on the admins list get any data.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import Admin from './Admin.jsx'

document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
