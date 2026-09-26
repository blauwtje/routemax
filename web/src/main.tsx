import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { captureToken } from './lib/api-client';
import './index.css';

if (captureToken(window.location.hash, window.sessionStorage)) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('index.html has no #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
