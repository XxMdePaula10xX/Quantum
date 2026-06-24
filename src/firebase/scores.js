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
let functions = null;
if (FIREBASE_ENABLED && app) {
  try {
    functions = getFunctions(app);
  } catch (e) {
    // não derruba o carregamento do módulo (e do app) no WebView do iOS
    // eslint-disable-next-line no-console
    console.error('getFunctions falhou — ranking indisponível:', e);
  }
}

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

/** Exclui a conta do usuário e seus dados de ranking (App Store 5.1.1). */
export async function deleteAccount() {
  if (!functions) throw new Error('Recurso indisponível (Firebase não configurado).');
  const fn = httpsCallable(functions, 'deleteAccount');
  const { data } = await fn();
  return data;
}

/** Lê o top N do ranking diário de um minigame numa data. */
export async function getDailyLeaderboard(minigameId, date, top = 50) {
  if (!db) return [];
  const col = collection(db, 'dailyScores', date, minigameId);
  const snap = await getDocs(query(col, orderBy('score', 'desc'), limit(top)));
  // uid: d.id por ÚLTIMO — um campo uid gravado no doc não pode sobrescrever o id
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
}

/** Lê o top N do ranking de Contra o tempo de um minigame. */
export async function getTimerLeaderboard(minigameId, top = 50) {
  if (!db) return [];
  const col = collection(db, 'timerScores', minigameId, 'scores');
  const snap = await getDocs(query(col, orderBy('bestScore', 'desc'), limit(top)));
  return snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
}

// Posição (rank) do usuário = nº de pontuações maiores + 1.
// getCountFromServer usa transporte de agregação que PODE travar no WKWebView
// do iOS — por isso quem chama trata a falha como "sem rank" (não-fatal).
async function rankByField(col, field, value) {
  const snap = await getCountFromServer(query(col, where(field, '>', value)));
  return snap.data().count + 1;
}

/** Resultado do PRÓPRIO usuário no diário (score + posição), mesmo fora do top. */
export async function getMyDailyEntry(minigameId, date, uid) {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'dailyScores', date, minigameId, uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    let rank = null;
    try {
      rank = await rankByField(collection(db, 'dailyScores', date, minigameId), 'score', data.score);
    } catch {
      /* contagem indisponível: mostra o score sem a posição */
    }
    return { uid, ...data, rank };
  } catch {
    return null; // leitura pessoal é opcional: nunca derruba o ranking
  }
}

/** Recorde do PRÓPRIO usuário no Contra o tempo (score + posição). */
export async function getMyTimerEntry(minigameId, uid) {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'timerScores', minigameId, 'scores', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    let rank = null;
    try {
      rank = await rankByField(collection(db, 'timerScores', minigameId, 'scores'), 'bestScore', data.bestScore);
    } catch {
      /* contagem indisponível: mostra o score sem a posição */
    }
    return { uid, ...data, rank };
  } catch {
    return null;
  }
}

export { db };
