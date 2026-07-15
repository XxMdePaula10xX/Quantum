import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FORMATS,
  makeDailyRoundsFromPool,
  makeRandomRoundFromPool,
  resolveRound,
} from '../engine/session.js';
import { itemsForMinigame } from '../minigames/registry.js';
import { ROUNDS_PER_DAY } from '../engine/dailyQueue.js';

// Hook que dirige uma sessão de jogo nos 3 formatos.
//  - daily:    5 rodadas fixas; ao fim, status 'finished'.
//  - infinite: rodadas ilimitadas; encerra quando o jogador sai.
//  - timer:    tempo total (def.timerSeconds); encerra quando zera.
//
// `pool` é a base JÁ carregada do minigame (carga sob demanda — ver
// data/index.js loadPool). O componente só monta este hook depois do tutorial
// e com o pool pronto, então o timer pode começar na montagem.
export function useGameSession(def, format, { date, pool }) {
  const isDaily = format === 'daily';
  const isTimer = format === 'timer';
  const timeTotal = def.timerSeconds || 60;

  // Filtra o pool UMA vez (não a cada rodada). O pool já costuma vir filtrado
  // do arquivo por minigame, mas itemsForMinigame é idempotente e garante a
  // mesma ordem determinística usada pelo servidor.
  const filteredPool = useMemo(() => itemsForMinigame(pool, def), [pool, def]);
  const poolRef = useRef(filteredPool);
  poolRef.current = filteredPool;

  const [rounds, setRounds] = useState(() =>
    isDaily ? makeDailyRoundsFromPool(def, filteredPool, date) : [makeRandomRoundFromPool(def, filteredPool)]
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('playing'); // playing | answered | finished
  const [totalScore, setTotalScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [breakdown, setBreakdown] = useState([]); // [{points, basePoints, correct, ...}]
  const [lastResult, setLastResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timeTotal);

  const comboRef = useRef(0);
  const timeLeftRef = useRef(timeTotal);
  timeLeftRef.current = timeLeft;
  // fim absoluto (wall-clock): o cronômetro é ancorado UMA vez, então mudar de
  // fase (playing<->answered) a cada rodada não reancora o intervalo nem soma
  // folga (drift que favorecia o jogador e afastava do cálculo do servidor).
  const endTsRef = useRef(null);

  const current = rounds[index];

  // Contagem regressiva do modo timer.
  useEffect(() => {
    if (!isTimer || phase === 'finished') return undefined;
    if (endTsRef.current == null) endTsRef.current = Date.now() + timeTotal * 1000;
    const tick = () => {
      const left = Math.max(0, (endTsRef.current - Date.now()) / 1000);
      setTimeLeft(Math.round(left * 10) / 10);
      if (left <= 0) setPhase('finished');
    };
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [isTimer, phase, timeTotal]);

  const submit = useCallback(
    (input) => {
      if (phase !== 'playing' || !current) return null;
      const res = resolveRound(def, current, input, {
        combo: comboRef.current,
        format,
        timeRemaining: timeLeftRef.current,
        timeTotal,
      });
      comboRef.current = res.combo;
      setCombo(res.combo);
      setTotalScore((s) => s + res.points);
      // guarda input bruto, id do item, salt e tempo restante para que o
      // servidor reconstrua e revalide a rodada (ver functions/index.js).
      const entry = {
        ...res,
        input,
        itemId: current.item.id,
        salt: current.salt ?? 0,
        timeRemaining: timeLeftRef.current,
        // par do "Maior ou menor": deixa o servidor detectar base divergente
        // (o oponente muda se o items.json da Function estiver defasado).
        pairIds:
          current.data && current.data.a && current.data.b
            ? [current.data.a.id, current.data.b.id]
            : undefined,
      };
      setBreakdown((b) => [...b, entry]);
      setLastResult(entry);
      setPhase('answered');
      return res;
    },
    [phase, current, def, format, timeTotal]
  );

  const next = useCallback(() => {
    setLastResult(null);
    if (isDaily) {
      if (index + 1 >= ROUNDS_PER_DAY) {
        setPhase('finished');
        return;
      }
      setIndex((i) => i + 1);
      setPhase('playing');
      return;
    }
    // infinite / timer: gera próxima rodada aleatória
    if (isTimer && timeLeftRef.current <= 0) {
      setPhase('finished');
      return;
    }
    setRounds((r) => [...r, makeRandomRoundFromPool(def, poolRef.current)]);
    setIndex((i) => i + 1);
    setPhase('playing');
  }, [isDaily, isTimer, index, def]);

  const finish = useCallback(() => setPhase('finished'), []);

  return {
    formatInfo: FORMATS[format],
    current,
    index,
    roundNumber: index + 1,
    totalRounds: isDaily ? ROUNDS_PER_DAY : null,
    phase,
    totalScore,
    combo,
    breakdown,
    lastResult,
    timeLeft,
    timeTotal,
    submit,
    next,
    finish,
  };
}
