import { useCallback, useEffect, useRef, useState } from 'react';
import { buildShareText } from '../engine/share.js';
import { FIREBASE_ENABLED } from '../firebase/config.js';
import { submitDailyScore, submitTimerScore } from '../firebase/scores.js';

export default function ResultScreen({ result, fresh, user, onBackToMenu, onOpenRanking }) {
  const [shared, setShared] = useState(false);
  const [submitState, setSubmitState] = useState('idle'); // idle|sending|done|error|skipped
  const [submitMsg, setSubmitMsg] = useState('');
  const submittedRef = useRef(false); // trava SÓ após sucesso (permite retry)
  const sendingRef = useRef(false); // evita envios concorrentes (ex.: StrictMode)
  const aliveRef = useRef(true);
  const ranked = result.format === 'daily' || result.format === 'timer';

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Envio ao ranking. Reutilizado pelo envio automático e pelo botão "Tentar
  // novamente". submittedRef só trava em caso de SUCESSO — assim uma falha de
  // rede não perde a pontuação para sempre (era um bug: dado perdido).
  const doSubmit = useCallback(async () => {
    if (submittedRef.current || sendingRef.current) return;
    if (!FIREBASE_ENABLED || !user) {
      setSubmitState('skipped');
      return;
    }
    sendingRef.current = true;
    setSubmitState('sending');
    try {
      if (result.format === 'daily') {
        await submitDailyScore({
          minigameId: result.minigameId,
          date: result.date,
          // itemId + pairIds por rodada: servidor detecta base desatualizada
          answers: result.breakdown.map((b) => ({ ...b.input, itemId: b.itemId, pairIds: b.pairIds })),
        });
      } else {
        await submitTimerScore({
          minigameId: result.minigameId,
          rounds: result.breakdown.map((b) => ({
            itemId: b.itemId,
            salt: b.salt,
            input: b.input,
            pairIds: b.pairIds,
            timeRemaining: b.timeRemaining,
            timeTotal: result.timeTotal,
          })),
        });
      }
      submittedRef.current = true; // sucesso: não reenvia
      if (aliveRef.current) setSubmitState('done');
    } catch (e) {
      if (aliveRef.current) {
        setSubmitState('error');
        setSubmitMsg(e?.message || 'Não foi possível enviar agora.');
      }
    } finally {
      sendingRef.current = false;
    }
  }, [user, result]);

  // Envio AUTOMÁTICO ao ranking: só em partida recém-terminada e ranqueada.
  useEffect(() => {
    if (!fresh || !ranked) return;
    doSubmit();
  }, [fresh, ranked, doSubmit]);

  const shareText = buildShareText({
    minigameName: result.minigameName,
    date: result.date,
    pointsPerRound: result.pointsPerRound,
    total: result.total,
  });

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setShared(true);
        return;
      }
      // WKWebView sem share nem clipboard: fallback que sempre funciona
      window.prompt('Copie seu resultado:', shareText);
    } catch {
      // share cancelado OU clipboard bloqueado: oferece o texto para copiar à mão
      try {
        window.prompt('Copie seu resultado:', shareText);
      } catch {
        /* sem prompt disponível */
      }
    }
  };

  const blocks = result.pointsPerRound
    .map((p) => (p >= 900 ? '🟩' : p >= 600 ? '🟨' : p >= 300 ? '🟧' : p > 0 ? '🟥' : '⬛'))
    .join('');

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">Resultado</div>
        <button className="btn small ghost" onClick={onBackToMenu}>Menu</button>
      </div>

      <div className="card center">
        <p className="muted" style={{ marginTop: 0 }}>{result.minigameName} · {result.format} · {result.date}</p>
        <div className="result-blocks">{blocks}</div>
        <h1 style={{ fontSize: 44, margin: '8px 0' }}>{result.total} <span className="muted" style={{ fontSize: 18 }}>pts</span></h1>
        {result.isBest && <p className="combo">🎉 Novo recorde!</p>}
      </div>

      {/* Status do envio automático ao ranking */}
      {ranked && fresh && (
        <RankingStatus state={submitState} msg={submitMsg} firebase={FIREBASE_ENABLED} loggedIn={!!user} />
      )}
      {ranked && fresh && submitState === 'error' && (
        <button className="btn ghost block" onClick={doSubmit}>🔄 Tentar enviar de novo</button>
      )}

      <button className="btn primary block big" onClick={share}>
        📤 Compartilhar {shared ? '(copiado!)' : ''}
      </button>
      <button className="btn ghost block" onClick={onOpenRanking}>Ver ranking</button>
      <button className="btn ghost block" onClick={onBackToMenu}>Voltar ao menu</button>
    </div>
  );
}

function RankingStatus({ state, msg, firebase, loggedIn }) {
  if (state === 'sending') return <div className="banner">🏆 Enviando ao ranking…</div>;
  if (state === 'done') return <div className="banner">✓ Enviado ao ranking (validado no servidor).</div>;
  if (state === 'error') return <div className="banner">⚠️ Não enviado: {msg}</div>;
  if (state === 'skipped') {
    if (!firebase) return <div className="banner">Ranking global indisponível (Firebase não configurado).</div>;
    if (!loggedIn) return <div className="banner">Entre na sua conta para que sua pontuação vá ao ranking.</div>;
  }
  return null;
}
