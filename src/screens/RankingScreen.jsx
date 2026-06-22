import { useEffect, useState } from 'react';
import { MINIGAMES } from '../minigames/registry.js';
import { todayKey } from '../engine/dailyQueue.js';
import { FIREBASE_ENABLED } from '../firebase/config.js';
import { getDailyLeaderboard, getTimerLeaderboard } from '../firebase/scores.js';

export default function RankingScreen({ onBack }) {
  const [tab, setTab] = useState('daily'); // daily | timer
  const [minigameId, setMinigameId] = useState(MINIGAMES[0].id);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const date = todayKey();

  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    let alive = true;
    setLoading(true);
    setError('');
    const p = tab === 'daily' ? getDailyLeaderboard(minigameId, date) : getTimerLeaderboard(minigameId);
    p.then((r) => alive && setRows(r))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setError(e?.message || 'Falha ao ler o ranking.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tab, minigameId, date]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">🏆 Ranking</div>
        <button className="btn small ghost" onClick={onBack}>Menu</button>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'daily' ? 'active' : ''}`} onClick={() => setTab('daily')}>Diário (hoje)</div>
        <div className={`tab ${tab === 'timer' ? 'active' : ''}`} onClick={() => setTab('timer')}>Contra o tempo</div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        {MINIGAMES.map((m) => (
          <button
            key={m.id}
            className={`btn small ${minigameId === m.id ? 'primary' : 'ghost'}`}
            onClick={() => setMinigameId(m.id)}
          >
            {m.icon} {m.name}
          </button>
        ))}
      </div>

      {!FIREBASE_ENABLED ? (
        <div className="banner">
          Ranking global indisponível: configure o Firebase (veja <code>.env.example</code> e o README) para
          ativar login e rankings validados no servidor.
        </div>
      ) : loading ? (
        <p className="muted center">Carregando…</p>
      ) : error ? (
        <div className="banner">⚠️ {error}</div>
      ) : rows.length === 0 ? (
        <p className="muted center">Sem pontuações ainda. Seja o primeiro!</p>
      ) : (
        <div>
          {rows.map((r, i) => (
            <div className="lb-row" key={r.uid}>
              <span className="pos">{i + 1}</span>
              <span>{r.displayName || r.uid.slice(0, 6)}</span>
              <span className="pts">{tab === 'daily' ? r.score : r.bestScore} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
