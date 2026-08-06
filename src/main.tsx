import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './theme/tokens.css';
import './theme/global.css';
import './theme/auth.css';
import './theme/auth-selected-fidelity.css';
import './theme/uniformity.css';
import './theme/ios-form-fix.css';
import './theme/quick-add-disclosure.css';
import './theme/modal-interactions.css';
import './theme/quick-add-interactions';
import './theme/dashboard-hierarchy.css';
import './theme/checkin-history.css';
import './theme/journal-checkin-links';
import './theme/checkin-reminder-navigation';
import './theme/weekly-reflection';
import './theme/weekly-intention';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
