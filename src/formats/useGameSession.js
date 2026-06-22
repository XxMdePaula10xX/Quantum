import { useCallback, useEffect, useRef, useState } from 'react';
import { ITEMS } from '../data/index.js';
import { FORMATS, makeDailyRounds, makeRandomRound, resolveRound } from '../engine/session.js';
import { ROUNDS_PER_DAY } from '../engine/dailyQueue.js';

// Hook que dirige uma sessão de jogo nos 3 formatos.
//  - daily:    5 rodadas fixas; ao fim, status 'finished'.
//  - infinite: rodadas ilimitadas; encerra quando o jogador sai.
//  - timer:    tempo total (def.timerSeconds); encerra quando zera.
export function useGameSession(def, format, { date } = {}) {
  const isDaily = format === 'daily';
  const isTimer = format === 'timer';
  const timeTotal = def.timerSeconds || 60;

  const [rounds, setRounds] = useState(() =>
    isDaily ? makeDailyRounds(def, ITEMS, date) : [makeRandomRound(def, ITEMS)]
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

  const current = rounds[index];

  // Contagem regressiva do modo timer.
  useEffect(() => {
    if (!isTimer || phase === 'finished') return undefined;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 0.1) {
          clearInterval(t);
          setPhase('finished');
          return 0;
        }
        return Math.round((s - 0.1) * 10) / 10;
      });
    }, 100);
    return () => clearInterval(t);
  }, [isTimer, phase]);

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
    setRounds((r) => [...r, makeRandomRound(def, ITEMS)]);
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
