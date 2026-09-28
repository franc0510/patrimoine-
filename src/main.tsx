import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PatrimoineProvider } from './store/usePatrimoine';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PatrimoineProvider>
      <App />
    </PatrimoineProvider>
  </StrictMode>,
);
