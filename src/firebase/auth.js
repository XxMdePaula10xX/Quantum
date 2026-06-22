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

const auth = FIREBASE_ENABLED ? getAuth(app) : null;

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
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(user, { displayName });
    await user.getIdToken(true); // refresh para o claim `name` entrar no token
  }
  return user;
}

export async function resetPassword(email) {
  if (!auth) throw new Error('Firebase não configurado');
  await sendPasswordResetEmail(auth, email);
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

export { auth };
