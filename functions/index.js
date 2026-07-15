// Cloud Functions — validação de pontuação do ranking (PRD seção 7).
//
// Princípio anti-trapaça (nível "defendido"): o cliente envia as RESPOSTAS,
// não a pontuação. O servidor RECONSTRÓI as mesmas rodadas (de forma
// determinística) e RECALCULA a pontuação com as MESMAS funções do cliente
// (src/engine), gravando no Firestore apenas o valor recalculado.
//
// A reutilização do código do cliente (importado abaixo) garante "mesma
// fórmula" sem duplicação. O build (esbuild) empacota esses módulos.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

import { getMinigame, MINIGAMES } from '../src/minigames/registry.js';
import { makeDailyRounds, resolveRound, buildRoundFor } from '../src/engine/session.js';
import { itemsForMinigame } from '../src/minigames/registry.js';
import { todayKey } from '../src/engine/dailyQueue.js';
// Mesma base ATIVA do app: cliente e servidor importam o MESMO items.json,
// para que a reconstrução determinística do diário bata exatamente.
import items from '../src/data/items.json' assert { type: 'json' };

initializeApp();
const db = getFirestore();

// Teto de rodadas no Contra o tempo: evita DoS (payload gigante => bilhões de
// operações reconstruindo rodadas). Nenhuma sessão real chega perto.
const MAX_TIMER_ROUNDS = 500;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Base divergente no "Maior ou menor": o oponente é escolhido do pool inteiro,
// então o itemId-foco pode bater mas o par mudar. Compara o PAR como conjunto.
function pairMismatch(round, ans) {
  if (!ans || !ans.pairIds || !round.data || !round.data.a || !round.data.b) return false;
  const server = [round.data.a.id, round.data.b.id].slice().sort();
  const client = ans.pairIds.slice().sort();
  return server[0] !== client[0] || server[1] !== client[1];
}

const BASE_DIVERGENTE =
  'A base do servidor está diferente do app. Rode "firebase deploy --only functions" depois de regenerar a base.';

// itemsForMinigame filtra+ordena a base inteira; memoiza por minigame (base
// fixa por deploy) para não repetir o custo a cada submit.
const poolCache = new Map();
function poolFor(def) {
  let pool = poolCache.get(def.id);
  if (!pool) {
    pool = itemsForMinigame(items, def);
    poolCache.set(def.id, pool);
  }
  return pool;
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login obrigatório para o ranking.');
  return request.auth.uid;
}

// Apelido para o ranking. O claim `name` do token pode estar vazio se o refresh
// pós-cadastro falhou (comum no WebView do iOS) — nesse caso busca o perfil.
async function displayNameFor(request, uid) {
  const fromToken = request.auth?.token?.name;
  if (fromToken) return fromToken;
  try {
    const u = await getAuth().getUser(uid);
    return u.displayName || null;
  } catch {
    return null;
  }
}

// Converte exceções inesperadas em HttpsError COM mensagem (o Firebase esconde
// a mensagem de erros não-HttpsError, virando um "internal" opaco). Também loga
// o stack completo, que aparece em `firebase functions:log`.
function asHttps(e, hint) {
  if (e instanceof HttpsError) return e;
  console.error('submit error:', e && e.stack ? e.stack : e);
  return new HttpsError('internal', `${hint}: ${e && e.message ? e.message : e}`);
}

// Recalcula a pontuação total de uma sequência de rodadas + respostas.
function recompute(def, rounds, answers, format) {
  let combo = 0;
  let total = 0;
  const breakdown = [];
  rounds.forEach((round, i) => {
    // resposta malformada não derruba o envio inteiro: vira rodada de 0 ponto
    const ans = answers[i] && typeof answers[i] === 'object' ? answers[i] : {};
    // Detecta base do servidor diferente da do app (itemId + par do oponente).
    if ((ans.itemId && round.item && ans.itemId !== round.item.id) || pairMismatch(round, ans)) {
      throw new HttpsError('failed-precondition', BASE_DIVERGENTE);
    }
    const res = resolveRound(def, round, ans, { combo, format });
    if (!Number.isFinite(res.points)) {
      throw new HttpsError('internal', `Pontuação inválida na rodada ${i + 1} (${def.id}).`);
    }
    combo = res.combo;
    total += res.points;
    breakdown.push(res.points);
  });
  return { total, breakdown };
}

// ---- Diário (totalmente defendido / determinístico) ------------------------
export const submitDailyScore = onCall(async (request) => {
  try {
    const uid = requireAuth(request);
    const { minigameId, date, answers } = request.data || {};
    if (!minigameId || !date || !Array.isArray(answers)) {
      throw new HttpsError('invalid-argument', 'Payload inválido.');
    }
    // date entra no path do documento e na reconstrução do diário: valida o
    // formato (bloqueia barras/segmentos extras) e exige que seja HOJE (UTC),
    // senão dá para pré-enviar dias futuros ou reenviar dias passados.
    if (!DATE_RE.test(date)) {
      throw new HttpsError('invalid-argument', 'Data inválida.');
    }
    if (date !== todayKey()) {
      throw new HttpsError('failed-precondition', 'Só é possível enviar o diário de hoje.');
    }
    const def = getMinigame(minigameId);

    // 1 envio por dia por minigame.
    const ref = db.doc(`dailyScores/${date}/${minigameId}/${uid}`);
    if ((await ref.get()).exists) {
      throw new HttpsError('already-exists', 'Você já enviou o diário de hoje.');
    }

    // Reconstrói as MESMAS 5 rodadas determinísticas da data.
    const rounds = makeDailyRounds(def, items, date);
    if (answers.length !== rounds.length) {
      throw new HttpsError('invalid-argument', 'Número de respostas incompatível.');
    }

    const { total, breakdown } = recompute(def, rounds, answers, 'daily');
    await ref.set({
      uid, // permite limpar os dados do usuário em "Excluir conta"
      score: total,
      breakdown,
      displayName: await displayNameFor(request, uid),
      submittedAt: FieldValue.serverTimestamp(),
    });
    return { score: total, breakdown };
  } catch (e) {
    throw asHttps(e, 'Falha ao enviar o diário');
  }
});

// ---- Contra o tempo (defendido via reconstrução por seed) ------------------
// O cliente envia, por rodada, { itemId, salt, input, timeRemaining, timeTotal }.
// O servidor rebuilda cada rodada com buildRoundFor(def, pool, item, salt) —
// determinístico — e recalcula com o bônus de tempo.
export const submitTimerScore = onCall(async (request) => {
  try {
    const uid = requireAuth(request);
    const { minigameId, rounds: clientRounds } = request.data || {};
    if (!minigameId || !Array.isArray(clientRounds)) {
      throw new HttpsError('invalid-argument', 'Payload inválido.');
    }
    if (clientRounds.length > MAX_TIMER_ROUNDS) {
      throw new HttpsError('invalid-argument', 'Rodadas demais.');
    }
    const def = getMinigame(minigameId);
    const pool = poolFor(def);
    const byId = new Map(pool.map((it) => [it.id, it]));
    // tempo é CANÔNICO do minigame; não confia no timeTotal do cliente (que
    // poderia inflar o bônus). timeRemaining é clampado a [0, timeTotal].
    const timeTotal = def.timerSeconds || 60;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    let combo = 0;
    let total = 0;
    for (const r of clientRounds) {
      const item = byId.get(r.itemId);
      if (!item) {
        // itemId veio da base do cliente; se o servidor não o conhece, as bases
        // divergem — avisa em vez de gravar um placar silenciosamente baixo.
        throw new HttpsError('failed-precondition', BASE_DIVERGENTE);
      }
      // salt do cliente = Math.floor(rnd*1e9). Usa o MESMO inteiro (sem truncar
      // p/ int32 como `| 0` faria), senão a reconstrução por seed divergiria.
      const salt = Number.isFinite(r.salt) ? Math.trunc(r.salt) : 0;
      const round = buildRoundFor(def, pool, item, salt);
      if (pairMismatch(round, r)) {
        throw new HttpsError('failed-precondition', BASE_DIVERGENTE);
      }
      const timeRemaining = clamp(Number(r.timeRemaining) || 0, 0, timeTotal);
      const res = resolveRound(def, round, r.input || {}, {
        combo,
        format: 'timer',
        timeRemaining,
        timeTotal,
      });
      if (!Number.isFinite(res.points)) continue;
      combo = res.combo;
      total += res.points;
    }

    const ref = db.doc(`timerScores/${minigameId}/scores/${uid}`);
    const prev = await ref.get();
    const best = Math.max(total, prev.exists ? prev.data().bestScore || 0 : 0);
    await ref.set(
      {
        uid, // permite limpar os dados do usuário em "Excluir conta"
        bestScore: best,
        displayName: await displayNameFor(request, uid),
        achievedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { score: total, bestScore: best };
  } catch (e) {
    throw asHttps(e, 'Falha ao enviar a pontuação');
  }
});

// ---- Excluir conta (exigência da App Store 5.1.1) --------------------------
// Apaga os dados de ranking do usuário e remove a conta do Firebase Auth.
// A limpeza dos dados é "best-effort" (logada se falhar); a remoção da conta
// é o passo que PRECISA acontecer. Tudo via Admin SDK, autenticado pelo token.
export const deleteAccount = onCall(async (request) => {
  try {
    const uid = requireAuth(request);

    // 1) Apaga as pontuações do diário (uma subcoleção por minigame) e do
    //    Contra o tempo (collectionGroup 'scores'), filtrando pelo campo uid.
    const groups = [...MINIGAMES.map((m) => m.id), 'scores'];
    for (const g of groups) {
      try {
        const snap = await db.collectionGroup(g).where('uid', '==', uid).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      } catch (e) {
        // não bloqueia a exclusão da conta (ex.: índice ausente)
        console.error(`limpeza de ${g} falhou:`, e && e.message ? e.message : e);
      }
    }

    // 2) Perfil opcional do usuário.
    try {
      await db.doc(`users/${uid}`).delete();
    } catch (e) {
      console.error('limpeza de users falhou:', e && e.message ? e.message : e);
    }

    // 3) Remove a conta do Auth (passo obrigatório).
    await getAuth().deleteUser(uid);
    return { ok: true };
  } catch (e) {
    throw asHttps(e, 'Falha ao excluir a conta');
  }
});
