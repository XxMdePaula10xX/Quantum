// Autenticação (PRD seção 7): e-mail/senha. Login é OPCIONAL para jogar e
// OBRIGATÓRIO para entrar no ranking global.
import { app, FIREBASE_ENABLED } from './config.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';

let auth = null;
if (FIREBASE_ENABLED && app) {
  try {
    auth = getAuth(app);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('getAuth falhou — login indisponível:', e);
    auth = null;
  }
}

export function onAuth(cb) {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function loginWithEmail(email, password) {
  if (!auth) throw new Error('Firebase não configurado');
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

// `displayName` é o apelido que aparece no ranking. Gravamos no perfil do
// Firebase Auth (vira o claim `name` no token, lido pela Cloud Function) e
// forçamos o refresh do token para o apelido já valer no primeiro envio.
export async function registerWithEmail(email, password, displayName) {
  if (!auth) throw new Error('Firebase não configurado');

  let user;
  try {
    ({ user } = await createUserWithEmailAndPassword(auth, email, password));
  } catch (e) {
    // RECUPERAÇÃO: se o e-mail já existe (ex.: uma tentativa anterior já criou
    // a conta), em vez de bloquear, tenta ENTRAR com a mesma senha digitada.
    // Resolve o caso clássico de "toda hora diz que o e-mail já existe".
    if (e?.code === 'auth/email-already-in-use') {
      let existing;
      try {
        ({ user: existing } = await signInWithEmailAndPassword(auth, email, password));
      } catch {
        const err = new Error(
          'Esse e-mail já tem uma conta. Entre com sua senha (ou use "Esqueci minha senha").'
        );
        err.code = 'quantum/email-in-use';
        throw err;
      }
      // conta antiga sem apelido: aproveita o que foi digitado agora
      if (displayName && !existing.displayName) {
        try {
          await updateProfile(existing, { displayName });
          await existing.getIdToken(true);
        } catch {
          /* best-effort */
        }
      }
      return existing;
    }
    throw e;
  }

  // A conta JÁ está criada e logada aqui. updateProfile/getIdToken são
  // "best-effort": no WebView do iOS às vezes falham; se lançássemos o erro, o
  // usuário acharia que o cadastro falhou e tentaria de novo.
  if (displayName) {
    try {
      await updateProfile(user, { displayName });
      await user.getIdToken(true); // refresh para o claim `name` entrar no token
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Apelido não gravado agora (entra no próximo login):', e?.message || e);
    }
  }
  return user;
}

export async function resetPassword(email) {
  if (!auth) throw new Error('Firebase não configurado');
  await sendPasswordResetEmail(auth, email);
}

// Atualiza o apelido (displayName) de quem já está logado. Reflete no ranking
// nos próximos envios (refresh do token para o claim `name`).
export async function updateNickname(displayName) {
  if (!auth || !auth.currentUser) throw new Error('Você não está conectado.');
  await updateProfile(auth.currentUser, { displayName });
  // refresh do token é best-effort: o apelido JÁ foi salvo acima; se o refresh
  // falhar no WebView do iOS, não deve aparecer como "erro ao salvar".
  try {
    await auth.currentUser.getIdToken(true);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Token não atualizado agora (entra no próximo envio):', e?.message || e);
  }
  return auth.currentUser;
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

export { auth };
