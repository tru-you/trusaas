import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import MobileDevice from './components/MobileDevice.tsx';
import './index.css';
import { registerServiceWorker } from './lib/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MobileDevice>
        <App />
      </MobileDevice>
    </ErrorBoundary>
  </StrictMode>,
);

// Register the PWA service worker after first paint so it never delays render.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}
