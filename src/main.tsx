import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { APP_BASENAME } from './app/appLocation';
import { PersistenceStatusBanner } from './components/PersistenceStatusBanner';
import './theme/base-path-assets';
import './theme/tokens.css';
import './theme/global.css';
import './theme/design-system.css';
import './theme/auth.css';
import './theme/auth-selected-fidelity.css';
import './theme/uniformity.css';
import './theme/ios-form-fix.css';
import './theme/quick-add-disclosure.css';
import './theme/modal-interactions.css';
import './theme/work-modal-interactions';
import './theme/dashboard-hierarchy.css';
import './theme/v03-ux-correctness.css';
import './theme/v03-accessibility.css';
import './theme/checkin-history.css';
import './theme/journal-checkin-links';
import './theme/checkin-reminder-navigation';
import './theme/weekly-reflection';
import './theme/weekly-intention';
import './theme/persistence-status.css';
import './theme/sync-confidence.css';
import './theme/v031-mobile-polish.css';
import './theme/v04-home.css';
import './theme/v04-home-refinement.css';
import './theme/v04-home-device-pass.css';
import './theme/v04-work';
import './theme/v04-work-polish';

void import('./theme/work-hub-fixes');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={APP_BASENAME}>
      <App />
      <PersistenceStatusBanner />
    </BrowserRouter>
  </React.StrictMode>,
);
