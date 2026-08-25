import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { APP_BASENAME } from './app/appLocation';
import { PersistenceStatusBanner } from './components/PersistenceStatusBanner';
import './features/dashboard/mobile-home-shell.css';
import './theme/runtimeTheme';

const MobileHomeOverlay = lazy(() => import('./features/dashboard/MobileHomeOverlay').then((module) => ({
  default: module.MobileHomeOverlay,
})));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={APP_BASENAME}>
      <App />
      <Suspense fallback={null}><MobileHomeOverlay /></Suspense>
      <PersistenceStatusBanner />
    </BrowserRouter>
  </React.StrictMode>,
);
