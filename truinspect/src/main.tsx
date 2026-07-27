import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { registerTruInspectServiceWorker } from './lib/pwa';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Register PWA service worker after first paint
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerTruInspectServiceWorker();
  });
}
