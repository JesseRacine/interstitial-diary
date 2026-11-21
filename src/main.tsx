import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isNativeApp } from './lib/nativeApp'
import { installNativeShell } from './lib/nativeShell'

// In the Windows and Android apps only: no browser-window behavior (find bar, reload, Save as, pull-to-refresh ...).
if (isNativeApp(location)) installNativeShell(window, document.documentElement)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
