// Texto de compartilhamento estilo Wordle (PRD seção 4.3).
// Emojis representam o desempenho de cada rodada sem revelar respostas.
import { PONTOS_MAX } from './scoring.js';

function blockFor(points) {
  const r = points / PONTOS_MAX;
  if (r >= 0.9) return '🟩';
  if (r >= 0.6) return '🟨';
  if (r >= 0.3) return '🟧';
  if (r > 0) return '🟥';
  return '⬛';
}

/**
 * @param {object} p
 * @param {string} p.minigameName
 * @param {string} p.date
 * @param {number[]} p.pointsPerRound
 * @param {number} p.total
 */
export function buildShareText({ minigameName, date, pointsPerRound, total }) {
  const blocks = pointsPerRound.map(blockFor).join('');
  return `Quantum · ${minigameName} · ${date}\n${blocks}\n${total} pts\nquantum.app`;
}
