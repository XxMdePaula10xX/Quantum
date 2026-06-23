import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Mostra o erro na tela (em vez de tela branca/infinita) — essencial para
// diagnosticar o app empacotado, onde não há console acessível.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('App crash:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <div className="banner" style={{ borderColor: 'rgba(255,122,138,.5)' }}>
            <strong>Ops, algo quebrou.</strong>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8 }}>
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          </div>
          <button className="btn primary block" onClick={() => location.reload()}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Captura erros globais (fora do React) e mostra na tela também — inclusive
// falhas de carregamento de módulo, que acontecem antes do React montar.
function showBootError(msg) {
  const el = document.getElementById('boot-error');
  if (el) {
    el.style.display = 'block';
    el.textContent = 'Erro ao iniciar: ' + msg;
  }
}
window.addEventListener('error', (e) => showBootError(e?.message || String(e)));
window.addEventListener('unhandledrejection', (e) =>
  showBootError(e?.reason?.message || String(e?.reason || e))
);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
