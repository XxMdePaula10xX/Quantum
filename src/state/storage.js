// Persistência local de progresso (PRD seção 1 / 4): recordes, dias jogados,
// preferências. Usa localStorage no app Vite empacotado (permitido e esperado).
// Tudo é tolerante a ambientes sem localStorage (ex.: SSR/testes).

const PREFIX = 'quantum:v1:';

function safeGet(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(PREFIX + key) : null;
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PREFIX + key, value);
  } catch {
    /* ignore (modo privado, quota, etc.) */
  }
}

function readJSON(key, fallback) {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  safeSet(key, JSON.stringify(value));
}

// ---- Resultado do diário (1 por minigame por dia, travado) -----------------

const dailyKey = (minigameId, date) => `daily:${minigameId}:${date}`;

export function getDailyResult(minigameId, date) {
  return readJSON(dailyKey(minigameId, date), null);
}
export function saveDailyResult(minigameId, date, result) {
  writeJSON(dailyKey(minigameId, date), result);
}
export function hasPlayedDaily(minigameId, date) {
  return getDailyResult(minigameId, date) != null;
}

// ---- Recordes do modo Infinito e Contra o tempo ----------------------------

export function getBest(mode, minigameId) {
  return readJSON(`best:${mode}:${minigameId}`, 0);
}
export function setBest(mode, minigameId, score) {
  const cur = getBest(mode, minigameId);
  if (score > cur) {
    writeJSON(`best:${mode}:${minigameId}`, score);
    return true;
  }
  return false;
}

// ---- Preferências -----------------------------------------------------------

export function getPrefs() {
  return readJSON('prefs', { sound: true });
}
export function setPrefs(prefs) {
  writeJSON('prefs', prefs);
}

// ---- Tutoriais (mostrar ao iniciar cada modo) ------------------------------
// Guardamos quando o jogador marcou "não mostrar de novo" para um par
// minigame+formato. Por padrão o tutorial aparece (valor false).

const tutKey = (minigameId, format) => `tut-dismissed:${minigameId}:${format}`;

export function isTutorialDismissed(minigameId, format) {
  return readJSON(tutKey(minigameId, format), false) === true;
}
export function setTutorialDismissed(minigameId, format, dismissed) {
  writeJSON(tutKey(minigameId, format), dismissed === true);
}
