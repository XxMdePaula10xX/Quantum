import { useState } from 'react';
import { MINIGAME_HOWTO, FORMAT_RULES } from '../minigames/tutorials.js';

// Mini-tutorial mostrado ao iniciar cada modo de jogo: como jogar o minigame
// + regras do formato + dica de pontuação. Botão grande "Começar".
// `overlay`: renderiza por cima da partida (botão "?"), sem desmontá-la.
export default function Tutorial({ def, format, onStart, onExit, overlay = false, startLabel = 'Começar ▶' }) {
  const [dontShow, setDontShow] = useState(false);
  const howto = MINIGAME_HOWTO[def.id];
  const fmt = FORMAT_RULES[format];

  return (
    <div className={overlay ? 'tut-overlay' : 'app tutorial-screen'}>
      <div className="tut-card pop-in">
        <button className="btn ghost small tut-close" onClick={onExit} aria-label="Sair">✕</button>

        <div className="tut-hero">
          <div className="tut-icon">{def.icon}</div>
          <h1 className="tut-title">{def.name}</h1>
          <p className="tut-tagline">{howto?.tagline}</p>
          <span className="pill-badge">{fmt.badge}</span>
        </div>

        <div className="tut-section">
          <h3>Como jogar</h3>
          <ol className="tut-steps">
            {howto?.steps.map((s, i) => (
              <li key={i}><span className="step-num">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </div>

        <div className="tut-section">
          <h3>Neste modo</h3>
          <ul className="tut-rules">
            {fmt.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        <label className="tut-dontshow">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          Não mostrar de novo neste modo
        </label>

        <button className="btn primary block big glow" onClick={() => onStart(dontShow)}>
          {startLabel}
        </button>
      </div>
    </div>
  );
}
