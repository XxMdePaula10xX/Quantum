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

// Mostra erro SÓ quando o app não renderizou nada (tela branca / falha de
// boot). Se o app já montou (root tem filhos), um erro assíncrono solto NÃO
// deve desfigurar a tela com um "script error" vermelho — vai só pro console,
// e cada tela trata seu próprio erro (ex.: o ranking mostra o motivo real).
function showBootError(msg) {
  const root = document.getElementById('root');
  if (root && root.childElementCount > 0) {
    // eslint-disable-next-line no-console
    console.error('Erro em runtime (app já montado):', msg);
    return;
  }
  const el = document.getElementById('boot-error');
  if (el) {
    el.style.display = 'block';
    el.textContent = 'Erro ao iniciar: ' + msg;
  }
}
window.addEventListener('error', (e) => {
  const where = e?.filename ? ` (${e.filename}:${e.lineno})` : '';
  showBootError((e?.message || String(e)) + where);
});
window.addEventListener('unhandledrejection', (e) =>
  showBootError(e?.reason?.stack || e?.reason?.message || String(e?.reason || e))
);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
