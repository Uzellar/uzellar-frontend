import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { instalarTratamentoDeLoginVencido } from './lib/api';

instalarTratamentoDeLoginVencido();

// Permite instalar o Uzellar como app (tela inicial do celular/PC).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Sem service worker o sistema funciona normalmente — só não oferece "Instalar".
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
