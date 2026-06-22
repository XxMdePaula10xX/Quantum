import { useState } from 'react';
import { FIREBASE_ENABLED } from '../firebase/config.js';
import { loginWithEmail, registerWithEmail, signOut } from '../firebase/auth.js';

export default function LoginScreen({ user, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // login | register
  const [error, setError] = useState('');

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      onBack();
    } catch (e) {
      setError(e.message || 'Falha na autenticação.');
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">👤 Conta</div>
        <button className="btn small ghost" onClick={onBack}>Menu</button>
      </div>

      <p className="muted">Login é opcional para jogar e obrigatório para o ranking global.</p>

      {!FIREBASE_ENABLED ? (
        <div className="banner">
          Firebase não configurado neste build. Copie <code>.env.example</code> para <code>.env</code> e
          preencha as chaves para ativar login e ranking.
        </div>
      ) : user ? (
        <div className="card">
          <p>Conectado como <strong>{user.displayName || user.email}</strong>.</p>
          <button className="btn block" onClick={() => run(signOut)}>Sair da conta</button>
        </div>
      ) : (
        <>
          <div className="card">
            <label>E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label style={{ marginTop: 8 }}>Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              className="btn primary block"
              style={{ marginTop: 12 }}
              onClick={() =>
                run(() => (mode === 'login' ? loginWithEmail(email, password) : registerWithEmail(email, password)))
              }
            >
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
            <button className="btn ghost small block" style={{ marginTop: 8 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Não tem conta? Criar' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </>
      )}

      {error && <div className="banner">{error}</div>}
    </div>
  );
}
