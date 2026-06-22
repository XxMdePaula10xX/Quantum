import { useEffect, useState } from 'react';
import { getMinigame } from '../minigames/registry.js';
import { todayKey } from '../engine/dailyQueue.js';
import { loadPool } from '../data/index.js';
import Tutorial from '../components/Tutorial.jsx';
import GamePlay from './GamePlay.jsx';
import { isTutorialDismissed, setTutorialDismissed } from '../state/storage.js';

// Orquestra a partida: mostra o tutorial, CARREGA SOB DEMANDA a base do
// minigame (chunk separado) e só então monta o GamePlay. O tutorial inicial
// roda antes do GamePlay (o timer não corre durante ele); o botão "?" reabre o
// tutorial como sobreposição, sem desmontar a partida (não perde o progresso).
export default function GameScreen({ minigameId, format, onExit, onFinish }) {
  const def = getMinigame(minigameId);
  const date = todayKey();
  const [started, setStarted] = useState(() => isTutorialDismissed(minigameId, format));
  const [helpOpen, setHelpOpen] = useState(false);
  const [pool, setPool] = useState(null);
  const [error, setError] = useState(null);

  // Pré-carrega a base do minigame (já durante o tutorial).
  useEffect(() => {
    let alive = true;
    loadPool(minigameId)
      .then((p) => alive && setPool(p))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [minigameId]);

  // Tutorial inicial (antes da partida montar).
  if (!started) {
    return (
      <Tutorial
        def={def}
        format={format}
        onExit={onExit}
        onStart={(dontShow) => {
          if (dontShow) setTutorialDismissed(minigameId, format, true);
          setStarted(true);
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="banner">Não foi possível carregar os dados: {error}</div>
        <button className="btn ghost block" onClick={onExit}>Voltar ao menu</button>
      </div>
    );
  }

  if (!pool) {
    return <div className="app"><p className="center muted">Carregando {def.name}…</p></div>;
  }

  return (
    <>
      <GamePlay
        def={def}
        format={format}
        pool={pool}
        date={date}
        onExit={onExit}
        onFinish={onFinish}
        onHelp={format !== 'timer' ? () => setHelpOpen(true) : null}
      />
      {helpOpen && (
        <Tutorial
          def={def}
          format={format}
          overlay
          startLabel="Voltar ao jogo ▶"
          onExit={() => setHelpOpen(false)}
          onStart={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}
