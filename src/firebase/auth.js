// Autenticação (PRD seção 7): e-mail/senha. Login é OPCIONAL para jogar e
// OBRIGATÓRIO para entrar no ranking global.
import { app, FIREBASE_ENABLED } from './config.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

export async function registerWithEmail(email, password) {
  if (!auth) throw new Error('Firebase não configurado');
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signOut() {
  if (auth) await fbSignOut(auth);
}

export { auth };
