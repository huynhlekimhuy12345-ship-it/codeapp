import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './context/StoreContext';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
