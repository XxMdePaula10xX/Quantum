import { useEffect, useMemo, useRef, useState } from 'react';
import { VIEWS } from '../minigames/components/views.jsx';
import { useGameSession } from '../formats/useGameSession.js';
import GameHeader from '../components/GameHeader.jsx';
import { saveDailyResult, setBest } from '../state/storage.js';

const TIMER_FEEDBACK_MS = 800;

// UI de uma partida em andamento. Só é montado depois do tutorial e com o
// `pool` (base do minigame) já carregado.
export default function GamePlay({ def, format, pool, date, uid, onExit, onFinish, onHelp }) {
  const session = useGameSession(def, format, { date, pool });
  const View = VIEWS[def.id];
  const finishedRef = useRef(false);
  const { phase, lastResult, breakdown, totalScore } = session;

  // Dicas reveladas (pagas) na rodada atual; zera ao trocar de rodada.
  const [hintsUsed, setHintsUsed] = useState(0);
  useEffect(() => setHintsUsed(0), [session.index]);
  // memoizado por rodada: não recalcula a cada tick do cronômetro (100ms)
  const hints = useMemo(
    () => (def.hints && session.current ? def.hints(session.current.data) : []),
    [def, session.current]
  );

  // Modo timer: mostra feedback breve e avança sozinho.
  // IMPORTANTE: usar ref para `next` e depender só de [format, phase] — senão o
  // tick do cronômetro (100ms) re-cria o efeito e reseta o timeout, e a rodada
  // nunca avança (bug relatado: timer rolava até zerar após responder).
  const nextRef = useRef(session.next);
  nextRef.current = session.next;
  useEffect(() => {
    if (format !== 'timer' || phase !== 'answered') return undefined;
    const t = setTimeout(() => nextRef.current(), TIMER_FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [format, phase]);

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
      saveDailyResult(def.id, date, result, uid);
    } else {
      result.isBest = setBest(format, def.id, totalScore);
    }
    onFinish(result);
  }, [phase, breakdown, totalScore, def, format, date, uid, onFinish, session.timeTotal]);

  if (phase === 'finished') {
    return <div className="app"><p className="center muted">Calculando resultado…</p></div>;
  }

  const showFeedback = phase === 'answered' && lastResult;
  // injeta as dicas pagas usadas no input enviado (entra na pontuação e é
  // recalculada igual no servidor).
  const submitWithHints = (input) => session.submit({ ...input, hintsUsed });
  const paidShown = Math.min(hintsUsed, Math.max(0, hints.length - 1));

  return (
    <div className="app">
      <GameHeader session={session} def={def} onExit={onExit} onHelp={onHelp} />

      {/* key={session.index}: remonta a view a cada rodada, zerando o estado
          interno (ordem da linha do tempo, revelação da imagem, etc.) e evitando
          render com dados da rodada anterior. */}
      <View
        key={session.index}
        round={session.current.data}
        onSubmit={submitWithHints}
        answered={phase === 'answered'}
        feedback={lastResult}
      />

      {hints.length > 0 && phase === 'playing' && (
        <div className="hints">
          {/* dica gratuita (sempre visível, não tira pontos) */}
          <div className="hint free">💡 {hints[0]}</div>
          {/* dicas pagas reveladas */}
          {hints.slice(1, 1 + paidShown).map((h, i) => (
            <div className="hint paid" key={i}>🔎 {h}</div>
          ))}
          {/* botão para pedir a próxima dica paga */}
          {paidShown < hints.length - 1 && (
            <button className="btn ghost small block" onClick={() => setHintsUsed((n) => n + 1)}>
              Pedir dica (−20% nos pontos) · {paidShown + 1}/{hints.length - 1}
            </button>
          )}
        </div>
      )}

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
