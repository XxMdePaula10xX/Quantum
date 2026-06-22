import { useEffect, useRef } from 'react';
import { VIEWS } from '../minigames/components/views.jsx';
import { useGameSession } from '../formats/useGameSession.js';
import GameHeader from '../components/GameHeader.jsx';
import { saveDailyResult, setBest } from '../state/storage.js';

const TIMER_FEEDBACK_MS = 1100;

// UI de uma partida em andamento. Só é montado depois do tutorial e com o
// `pool` (base do minigame) já carregado.
export default function GamePlay({ def, format, pool, date, onExit, onFinish, onHelp }) {
  const session = useGameSession(def, format, { date, pool });
  const View = VIEWS[def.id];
  const finishedRef = useRef(false);
  const { phase, lastResult, breakdown, totalScore } = session;

  // Modo timer: mostra feedback breve e avança sozinho.
  useEffect(() => {
    if (format !== 'timer' || phase !== 'answered') return undefined;
    const t = setTimeout(() => session.next(), TIMER_FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [format, phase, session]);

  // Encerramento: persiste e devolve o resultado (uma única vez).
  useEffect(() => {
    if (phase !== 'finished' || finishedRef.current) return;
    finishedRef.current = true;
    const pointsPerRound = breakdown.map((b) => b.points);
    const result = {
      minigameId: def.id,
      minigameName: def.name,
      format,
      date,
      total: totalScore,
      pointsPerRound,
      breakdown,
      answers: breakdown.map((b) => b.input),
      timeTotal: session.timeTotal,
    };
    if (format === 'daily') {
      saveDailyResult(def.id, date, result);
    } else {
      result.isBest = setBest(format, def.id, totalScore);
    }
    onFinish(result);
  }, [phase, breakdown, totalScore, def, format, date, onFinish, session.timeTotal]);

  if (phase === 'finished') {
    return <div className="app"><p className="center muted">Calculando resultado…</p></div>;
  }

  const showFeedback = phase === 'answered' && lastResult;

  return (
    <div className="app">
      <GameHeader session={session} def={def} onExit={onExit} onHelp={onHelp} />

      <View round={session.current.data} onSubmit={session.submit} answered={phase === 'answered'} feedback={lastResult} />

      {showFeedback && (
        <div className={`feedback ${lastResult.correct ? 'good' : 'bad'}`}>
          <div className="pts">+{lastResult.points} pts</div>
          <div>Resposta: <strong>{lastResult.correctText}</strong></div>
          <div className="muted">{lastResult.detail}</div>
          {format !== 'timer' && (
            <button className="btn primary block" style={{ marginTop: 10 }} onClick={session.next}>
              {format === 'daily' && session.roundNumber >= session.totalRounds ? 'Ver resultado' : 'Próxima'}
            </button>
          )}
        </div>
      )}

      {format === 'infinite' && phase === 'playing' && session.index > 0 && (
        <button className="btn ghost block" onClick={session.finish}>Encerrar sessão</button>
      )}
    </div>
  );
}
