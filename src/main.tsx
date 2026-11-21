import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { connectDialogHistory } from './lib/dialog'
import { isNativeApp } from './lib/nativeApp'
import { installNativeShell } from './lib/nativeShell'
import { TEXT_SIZE_KEY, applyTextSize, textSizeFromStored } from './lib/prefs'

// The saved text size, before the first paint, so the page does not open at one size and jump to another.
try { applyTextSize(document.documentElement, textSizeFromStored(localStorage.getItem(TEXT_SIZE_KEY))) } catch { /* private mode: normal size */ }

// The Back button (Android's, a browser's) answers a question box on screen as canceled, instead of leaving it open.
connectDialogHistory(window)

// In the Windows and Android apps only: no browser-window behavior (find bar, reload, Save as, pull-to-refresh ...).
if (isNativeApp(location)) installNativeShell(window, document.documentElement)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
