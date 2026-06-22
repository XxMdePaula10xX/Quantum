// Cabeçalho da tela de jogo (PRD seção 4.2): formato, progresso, pontuação,
// combo e (no timer) tempo restante.
export default function GameHeader({ session, def, onExit, onHelp }) {
  const { formatInfo, roundNumber, totalRounds, totalScore, combo, timeLeft, timeTotal } = session;
  const pct =
    formatInfo.id === 'timer'
      ? (timeLeft / timeTotal) * 100
      : totalRounds
      ? (roundNumber / totalRounds) * 100
      : null;

  return (
    <div className="gamehead">
      <div className="line">
        <button className="btn ghost small" onClick={onExit}>
          ← Sair
        </button>
        <span className="muted">
          {def.icon} {def.name} · {formatInfo.name}
        </span>
        <span className="row">
          {onHelp && (
            <button className="btn ghost small" onClick={onHelp} aria-label="Como jogar">?</button>
          )}
          <span className="score">{totalScore} pts</span>
        </span>
      </div>

      <div className="line">
        <span className="muted">
          {formatInfo.id === 'timer'
            ? `Rodada ${roundNumber}`
            : totalRounds
            ? `Rodada ${roundNumber}/${totalRounds}`
            : `Rodada ${roundNumber}`}
        </span>
        {combo > 1 && <span className="combo">🔥 combo x{combo}</span>}
        {formatInfo.id === 'timer' && (
          <span className={`timer ${timeLeft <= 10 ? 'low' : ''}`}>{timeLeft.toFixed(1)}s</span>
        )}
      </div>

      {pct != null && (
        <div className="progressbar">
          <div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
      )}
    </div>
  );
}
