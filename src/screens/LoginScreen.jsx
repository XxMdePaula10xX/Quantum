import { useState } from 'react';
import { FIREBASE_ENABLED } from '../firebase/config.js';
import { loginWithEmail, registerWithEmail, resetPassword, signOut, updateNickname } from '../firebase/auth.js';

export default function LoginScreen({ user, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState('login'); // login | register
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn, { keepOpen = false } = {}) => {
    setError('');
    setInfo('');
    try {
      await fn();
      if (!keepOpen) onBack();
    } catch (e) {
      setError(traduzErro(e));
    }
  };

  const submit = () => {
    if (mode === 'register') {
      if (nickname.trim().length < 2) {
        setError('Escolha um apelido com pelo menos 2 caracteres.');
        return;
      }
      run(() => registerWithEmail(email.trim(), password, nickname.trim()));
    } else {
      run(() => loginWithEmail(email.trim(), password));
    }
  };

  const forgot = () => {
    if (!email.trim()) {
      setError('Digite seu e-mail acima para receber o link de recuperação.');
      return;
    }
    run(
      async () => {
        await resetPassword(email.trim());
        setInfo('Enviamos um link de recuperação para o seu e-mail.');
      },
      { keepOpen: true }
    );
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
        <Profile user={user} run={run} setError={setError} setInfo={setInfo} />
      ) : (
        <div className="card">
          {mode === 'register' && (
            <>
              <label>Apelido (aparece no ranking)</label>
              <input
                type="text"
                value={nickname}
                maxLength={20}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="ex.: matheus_p"
              />
            </>
          )}

          <label style={{ marginTop: mode === 'register' ? 8 : 0 }}>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label style={{ marginTop: 8 }}>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button className="btn primary block" style={{ marginTop: 12 }} onClick={submit}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          {mode === 'login' && (
            <button className="btn ghost small block" style={{ marginTop: 8 }} onClick={forgot}>
              Esqueci minha senha
            </button>
          )}

          <button
            className="btn ghost small block"
            style={{ marginTop: 8 }}
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setInfo('');
            }}
          >
            {mode === 'login' ? 'Não tem conta? Criar' : 'Já tem conta? Entrar'}
          </button>
        </div>
      )}

      {info && <div className="banner">{info}</div>}
      {error && <div className="banner" style={{ borderColor: 'rgba(255,122,138,0.5)' }}>{error}</div>}
    </div>
  );
}

// Perfil de quem está logado: vê e edita o apelido (nome do ranking).
function Profile({ user, run, setError, setInfo }) {
  const [nick, setNick] = useState(user.displayName || '');
  const save = () => {
    if (nick.trim().length < 2) {
      setError('Escolha um apelido com pelo menos 2 caracteres.');
      setInfo('');
      return;
    }
    run(
      async () => {
        await updateNickname(nick.trim());
        setInfo('Apelido atualizado! Já vale para os próximos envios ao ranking.');
      },
      { keepOpen: true }
    );
  };
  return (
    <div className="card">
      <p style={{ marginTop: 0 }}>Conectado: <strong>{user.email}</strong></p>
      <label>Seu apelido (aparece no ranking)</label>
      <div className="row">
        <input type="text" value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="ex.: matheus_p" />
        <button className="btn primary small" onClick={save}>Salvar</button>
      </div>
      {!user.displayName && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Você ainda não tem apelido — escolha um para aparecer no ranking.
        </p>
      )}
      <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => run(signOut)}>
        Sair da conta
      </button>
    </div>
  );
}

// Mensagens de erro do Firebase em português.
function traduzErro(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digite uma senha.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
  };
  return map[code] || e?.message || 'Falha na autenticação.';
}
