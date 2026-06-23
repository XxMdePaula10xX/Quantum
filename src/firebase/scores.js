// Ranking (PRD seção 7). Nível "defendido": o cliente envia as RESPOSTAS
// (não a pontuação) para a Cloud Function `submitDailyScore`, que recalcula
// e grava. Aqui ficam os wrappers de leitura/escrita.
import { app, FIREBASE_ENABLED } from './config.js';
import {
  initializeFirestore,
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  where,
  getCountFromServer,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// experimentalForceLongPolling: o transporte padrão do Firestore (WebChannel)
// NÃO funciona dentro do WKWebView do iOS (Capacitor) — as leituras ficam
// "carregando" para sempre. Long polling resolve.
let db = null;
if (FIREBASE_ENABLED && app) {
  try {
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
  } catch {
    db = getFirestore(app); // já inicializado
  }
}
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

// Posição (rank) do usuário = nº de pontuações maiores + 1.
async function rankByField(col, field, value) {
  const snap = await getCountFromServer(query(col, where(field, '>', value)));
  return snap.data().count + 1;
}

/** Resultado do PRÓPRIO usuário no diário (score + posição), mesmo fora do top. */
export async function getMyDailyEntry(minigameId, date, uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, 'dailyScores', date, minigameId, uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const rank = await rankByField(collection(db, 'dailyScores', date, minigameId), 'score', data.score);
  return { uid, ...data, rank };
}

/** Recorde do PRÓPRIO usuário no Contra o tempo (score + posição). */
export async function getMyTimerEntry(minigameId, uid) {
  if (!db || !uid) return null;
  const snap = await getDoc(doc(db, 'timerScores', minigameId, 'scores', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const rank = await rankByField(collection(db, 'timerScores', minigameId, 'scores'), 'bestScore', data.bestScore);
  return { uid, ...data, rank };
}

export { db };
