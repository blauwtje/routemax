import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('index.html has no #root element');

createRoot(rootElement).render(
  <StrictMode>
    <h1 className="p-4 text-lg font-semibold">routemax</h1>
  </StrictMode>,
);
