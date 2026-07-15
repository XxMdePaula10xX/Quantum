import { MINIGAMES } from '../minigames/registry.js';
import { hasPlayedDaily } from '../state/storage.js';
import { todayKey } from '../engine/dailyQueue.js';
import { USING_SAMPLE_DATA } from '../data/index.js';

export default function MenuScreen({ user, uid, onPlay, onOpenRanking, onOpenLogin, onOpenSources }) {
  const date = todayKey();
  return (
    <div className="app">
      <div className="topbar">
        <h1 className="brand">Quant<span>um</span></h1>
        <div className="row">
          <button className="btn small ghost" onClick={onOpenRanking}>🏆 Ranking</button>
          <button className="btn small ghost" onClick={onOpenLogin}>
            {user ? `👤 ${user.displayName || 'Conta'}` : '👤 Entrar'}
          </button>
        </div>
      </div>

      {USING_SAMPLE_DATA && (
        <div className="banner">
          Usando base de <strong>exemplo</strong> (dados de dev). Rode <code>npm run data:build</code> para
          gerar a base real do Wikidata.
        </div>
      )}

      <p className="muted" style={{ margin: 0 }}>Escolha um minigame e um formato:</p>

      <div className="grid">
        {MINIGAMES.map((m) => {
          const played = hasPlayedDaily(m.id, date, uid);
          return (
            <div className="card game-card" key={m.id}>
              <div className="icon">{m.icon}</div>
              <div className="gc-body">
                <div className="name">{m.name}</div>
                <div className="blurb">{m.blurb}</div>
                <div className="formats">
                  <button
                    className={`btn small action ${played ? 'ghost' : 'primary'}`}
                    onClick={() => onPlay(m.id, 'daily')}
                  >
                    {played ? 'Diário ✓ · Ver resultado' : 'Diário'}
                  </button>
                  <button
                    className="btn small action"
                    aria-label={`Jogar ${m.name} no modo infinito`}
                    onClick={() => onPlay(m.id, 'infinite')}
                  >
                    ∞
                  </button>
                  <button
                    className="btn small action"
                    aria-label={`Jogar ${m.name} no modo contra o tempo`}
                    onClick={() => onPlay(m.id, 'timer')}
                  >
                    ⏱
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn ghost block" onClick={onOpenSources}>📜 Fontes e créditos</button>
    </div>
  );
}
