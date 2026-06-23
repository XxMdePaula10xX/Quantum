import { useCallback, useEffect, useState } from 'react';
import { MINIGAMES } from '../minigames/registry.js';
import { todayKey } from '../engine/dailyQueue.js';
import { FIREBASE_ENABLED } from '../firebase/config.js';
import {
  getDailyLeaderboard,
  getTimerLeaderboard,
  getMyDailyEntry,
  getMyTimerEntry,
} from '../firebase/scores.js';

export default function RankingScreen({ user, initial, onBack }) {
  const [tab, setTab] = useState(initial?.format === 'timer' ? 'timer' : 'daily');
  const [minigameId, setMinigameId] = useState(initial?.minigameId || MINIGAMES[0].id);
  const [rows, setRows] = useState([]);
  const [mine, setMine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const date = todayKey();
  const uid = user?.uid || null;

  const load = useCallback(async () => {
    if (!FIREBASE_ENABLED) return;
    setLoading(true);
    setError('');
    try {
      const work = Promise.all([
        tab === 'daily' ? getDailyLeaderboard(minigameId, date) : getTimerLeaderboard(minigameId),
        tab === 'daily' ? getMyDailyEntry(minigameId, date, uid) : getMyTimerEntry(minigameId, uid),
      ]);
      // rede travada não deixa o ranking carregando para sempre
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Tempo esgotado ao ler o ranking. Toque em 🔄 para tentar.')), 12000)
      );
      const [list, my] = await Promise.race([work, timeout]);
      setRows(list);
      setMine(my);
    } catch (e) {
      setRows([]);
      setMine(null);
      setError(e?.message || 'Falha ao ler o ranking.');
    } finally {
      setLoading(false);
    }
  }, [tab, minigameId, date, uid]);

  // Carrega automaticamente ao entrar e ao trocar aba/minigame.
  useEffect(() => {
    load();
  }, [load]);

  const scoreOf = (r) => (tab === 'daily' ? r.score : r.bestScore);
  const inTop = mine && rows.some((r) => r.uid === mine.uid);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">🏆 Ranking</div>
        <div className="row">
          <button className="btn small ghost" onClick={load} aria-label="Atualizar">🔄</button>
          <button className="btn small ghost" onClick={onBack}>Menu</button>
        </div>
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

      {/* Seu resultado, mesmo fora do top */}
      {FIREBASE_ENABLED && mine && (
        <div className="card" style={{ padding: 12 }}>
          <div className="lb-row" style={{ margin: 0, background: 'var(--grad-soft)', borderColor: 'rgba(180,107,255,0.4)' }}>
            <span className="pos">{mine.rank}º</span>
            <span><strong>Você</strong> {inTop ? '' : '(fora do top)'}</span>
            <span className="pts">{scoreOf(mine)} pts</span>
          </div>
        </div>
      )}

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
          {rows.map((r, i) => {
            const me = r.uid === uid;
            return (
              <div className="lb-row" key={r.uid} style={me ? { borderColor: 'var(--accent-2)' } : undefined}>
                <span className="pos">{i + 1}</span>
                <span>{r.displayName || r.uid.slice(0, 6)}{me ? ' (você)' : ''}</span>
                <span className="pts">{scoreOf(r)} pts</span>
              </div>
            );
          })}
        </div>
      )}

      {FIREBASE_ENABLED && !uid && (
        <div className="banner">Entre na sua conta para enviar pontuações e ver sua posição.</div>
      )}
    </div>
  );
}
