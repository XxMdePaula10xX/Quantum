import { useEffect, useState } from 'react';
import MenuScreen from './screens/MenuScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import RankingScreen from './screens/RankingScreen.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import SourcesScreen from './screens/SourcesScreen.jsx';
import { onAuth } from './firebase/auth.js';
import { FIREBASE_ENABLED } from './firebase/config.js';
import { getDailyResult } from './state/storage.js';
import { todayKey } from './engine/dailyQueue.js';

export default function App() {
  const [view, setView] = useState({ name: 'menu' });
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!FIREBASE_ENABLED);

  // Espera o estado de auth resolver antes de liberar o jogo, senão o uid pode
  // estar defasado (null) ao tocar no diário e a trava por conta erra.
  useEffect(
    () =>
      onAuth((u) => {
        setUser(u);
        setAuthReady(true);
      }),
    []
  );

  if (!authReady) {
    return <div className="app"><p className="center muted">Carregando…</p></div>;
  }

  const goMenu = () => setView({ name: 'menu' });

  const uid = user?.uid || null;

  const play = (minigameId, format) => {
    // Diário só pode ser jogado uma vez por dia POR CONTA: se já jogou, mostra o resultado.
    if (format === 'daily') {
      const existing = getDailyResult(minigameId, todayKey(), uid);
      if (existing) {
        // resultado já guardado (dia já jogado) — só visualização, não reenvia.
        setView({ name: 'result', result: existing, fresh: false });
        return;
      }
    }
    setView({ name: 'game', minigameId, format });
  };

  // fresh=true => partida recém-terminada: envia ao ranking automaticamente.
  const finish = (result) => setView({ name: 'result', result, fresh: true });

  switch (view.name) {
    case 'game':
      return (
        <GameScreen
          key={`${view.minigameId}:${view.format}:${uid || 'local'}`}
          minigameId={view.minigameId}
          format={view.format}
          uid={uid}
          onExit={goMenu}
          onFinish={finish}
        />
      );
    case 'result':
      return (
        <ResultScreen
          result={view.result}
          fresh={view.fresh}
          user={user}
          onBackToMenu={goMenu}
          onOpenRanking={() =>
            setView({
              name: 'ranking',
              initial: { minigameId: view.result.minigameId, format: view.result.format },
            })
          }
        />
      );
    case 'ranking':
      return <RankingScreen user={user} initial={view.initial} onBack={goMenu} />;
    case 'login':
      return <LoginScreen user={user} onBack={goMenu} />;
    case 'sources':
      return <SourcesScreen onBack={goMenu} />;
    default:
      return (
        <MenuScreen
          user={user}
          uid={uid}
          onPlay={play}
          onOpenRanking={() => setView({ name: 'ranking' })}
          onOpenLogin={() => setView({ name: 'login' })}
          onOpenSources={() => setView({ name: 'sources' })}
        />
      );
  }
}
