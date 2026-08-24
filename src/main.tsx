import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { APP_BASENAME } from './app/appLocation';
import { PersistenceStatusBanner } from './components/PersistenceStatusBanner';
import './theme/runtimeTheme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={APP_BASENAME}>
      <App />
      <PersistenceStatusBanner />
    </BrowserRouter>
  </React.StrictMode>,
);
