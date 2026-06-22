import { useEffect, useState } from 'react';
import MenuScreen from './screens/MenuScreen.jsx';
import GameScreen from './screens/GameScreen.jsx';
import ResultScreen from './screens/ResultScreen.jsx';
import RankingScreen from './screens/RankingScreen.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import SourcesScreen from './screens/SourcesScreen.jsx';
import { onAuth } from './firebase/auth.js';
import { getDailyResult } from './state/storage.js';
import { todayKey } from './engine/dailyQueue.js';

export default function App() {
  const [view, setView] = useState({ name: 'menu' });
  const [user, setUser] = useState(null);

  useEffect(() => onAuth(setUser), []);

  const goMenu = () => setView({ name: 'menu' });

  const play = (minigameId, format) => {
    // Diário só pode ser jogado uma vez por dia: se já jogou, mostra o resultado.
    if (format === 'daily') {
      const existing = getDailyResult(minigameId, todayKey());
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
          key={`${view.minigameId}:${view.format}`}
          minigameId={view.minigameId}
          format={view.format}
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
          onOpenRanking={() => setView({ name: 'ranking' })}
        />
      );
    case 'ranking':
      return <RankingScreen onBack={goMenu} />;
    case 'login':
      return <LoginScreen user={user} onBack={goMenu} />;
    case 'sources':
      return <SourcesScreen onBack={goMenu} />;
    default:
      return (
        <MenuScreen
          user={user}
          onPlay={play}
          onOpenRanking={() => setView({ name: 'ranking' })}
          onOpenLogin={() => setView({ name: 'login' })}
          onOpenSources={() => setView({ name: 'sources' })}
        />
      );
  }
}
