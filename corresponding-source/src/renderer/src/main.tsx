import './styles/index.css'
import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { FloatingPanel } from './screens/FloatingPanel'
import { ReasonPicker } from './screens/ReasonPicker'
import { CaptureBox } from './screens/CaptureBox'
import './store/appearance'

const hash = window.location.hash
// Small auxiliary windows do not need to load Stats and the full main interface.
const App = lazy(() => import('./App').then(module => ({ default: module.App })))
const view = hash === '#panel' ? 'panel' : hash === '#reasons' ? 'reasons' : hash === '#capture' ? 'capture' : 'main'

if (view !== 'main') {
  // The panel, the reason picker and the capture box are transparent windows; their cards draw their own background.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Suspense fallback={null}>{view === 'panel' ? <FloatingPanel /> : view === 'reasons' ? <ReasonPicker /> : view === 'capture' ? <CaptureBox /> : <App />}</Suspense></StrictMode>
)
