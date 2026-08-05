import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './theme/tokens.css';
import './theme/global.css';
import './theme/uniformity.css';
import './theme/ios-form-fix.css';
import './theme/quick-add-disclosure.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
