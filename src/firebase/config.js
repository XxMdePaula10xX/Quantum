// Inicialização do Firebase (PRD seção 7). É TOTALMENTE OPCIONAL: se as
// variáveis VITE_FIREBASE_* não estiverem definidas, o app roda offline
// (login e ranking global ficam desabilitados, jogo local funciona normal).

import { initializeApp } from 'firebase/app';

const cfg = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID,
};

// `let` exportado: vira live binding — se a init falhar, vira false p/ todos.
export let FIREBASE_ENABLED = Boolean(cfg.apiKey && cfg.projectId);

let app = null;
if (FIREBASE_ENABLED) {
  try {
    app = initializeApp(cfg);
  } catch (e) {
    // não derruba o app: segue em modo offline
    // eslint-disable-next-line no-console
    console.error('Firebase init falhou — seguindo offline:', e);
    app = null;
    FIREBASE_ENABLED = false;
  }
}

export { app, cfg };
