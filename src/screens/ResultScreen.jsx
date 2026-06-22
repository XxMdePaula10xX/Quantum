import { useState } from 'react';
import { buildShareText } from '../engine/share.js';
import { FIREBASE_ENABLED } from '../firebase/config.js';
import { submitDailyScore, submitTimerScore } from '../firebase/scores.js';

export default function ResultScreen({ result, user, onBackToMenu, onOpenRanking }) {
  const [shared, setShared] = useState(false);
  const [submitState, setSubmitState] = useState('idle'); // idle|sending|done|error
  const ranked = result.format === 'daily' || result.format === 'timer';

  const shareText = buildShareText({
    minigameName: result.minigameName,
    date: result.date,
    pointsPerRound: result.pointsPerRound,
    total: result.total,
  });

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setShared(true);
      }
    } catch {
      /* cancelado */
    }
  };

  const sendToRanking = async () => {
    setSubmitState('sending');
    try {
      if (result.format === 'daily') {
        await submitDailyScore({
          minigameId: result.minigameId,
          date: result.date,
          answers: result.answers,
        });
      } else {
        // timer: o servidor reconstrói cada rodada por seed/salt e recalcula.
        await submitTimerScore({
          minigameId: result.minigameId,
          rounds: result.breakdown.map((b) => ({
            itemId: b.itemId,
            salt: b.salt,
            input: b.input,
            timeRemaining: b.timeRemaining,
            timeTotal: result.timeTotal,
          })),
        });
      }
      setSubmitState('done');
    } catch {
      setSubmitState('error');
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

      <button className="btn primary block" onClick={share}>
        📤 Compartilhar {shared ? '(copiado!)' : ''}
      </button>

      {ranked && (
        FIREBASE_ENABLED ? (
          user ? (
            <button className="btn block" disabled={submitState !== 'idle'} onClick={sendToRanking}>
              {submitState === 'idle' && '🏆 Enviar ao ranking'}
              {submitState === 'sending' && 'Enviando…'}
              {submitState === 'done' && '✓ Enviado (validado no servidor)'}
              {submitState === 'error' && 'Erro — tentar de novo'}
            </button>
          ) : (
            <div className="banner">Entre na sua conta para enviar ao ranking global.</div>
          )
        ) : (
          <div className="banner">Ranking global indisponível (Firebase não configurado neste build).</div>
        )
      )}

      <button className="btn ghost block" onClick={onOpenRanking}>Ver ranking</button>
      <button className="btn ghost block" onClick={onBackToMenu}>Voltar ao menu</button>
    </div>
  );
}
