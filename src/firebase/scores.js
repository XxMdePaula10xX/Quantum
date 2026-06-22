// Ranking (PRD seção 7). Nível "defendido": o cliente envia as RESPOSTAS
// (não a pontuação) para a Cloud Function `submitDailyScore`, que recalcula
// e grava. Aqui ficam os wrappers de leitura/escrita.
import { app, FIREBASE_ENABLED } from './config.js';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const db = FIREBASE_ENABLED ? getFirestore(app) : null;
const functions = FIREBASE_ENABLED ? getFunctions(app) : null;

/**
 * Envia o resultado do diário para validação no servidor.
 * @param {object} payload { minigameId, date, answers: [...] }
 *   answers[i] = o objeto `input` de cada rodada (ver registry.evaluate).
 */
export async function submitDailyScore(payload) {
  if (!functions) throw new Error('Ranking indisponível (Firebase não configurado).');
  const fn = httpsCallable(functions, 'submitDailyScore');
  const { data } = await fn(payload);
  return data; // { score, breakdown }
}

/** Envia/atualiza o recorde do modo Contra o tempo. */
export async function submitTimerScore(payload) {
  if (!functions) throw new Error('Ranking indisponível (Firebase não configurado).');
  const fn = httpsCallable(functions, 'submitTimerScore');
  const { data } = await fn(payload);
  return data;
}

/** Lê o top N do ranking diário de um minigame numa data. */
export async function getDailyLeaderboard(minigameId, date, top = 50) {
  if (!db) return [];
  const col = collection(db, 'dailyScores', date, minigameId);
  const snap = await getDocs(query(col, orderBy('score', 'desc'), limit(top)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** Lê o top N do ranking de Contra o tempo de um minigame. */
export async function getTimerLeaderboard(minigameId, top = 50) {
  if (!db) return [];
  const col = collection(db, 'timerScores', minigameId, 'scores');
  const snap = await getDocs(query(col, orderBy('bestScore', 'desc'), limit(top)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export { db };
