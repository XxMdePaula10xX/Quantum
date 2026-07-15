import { memo, useState } from 'react';
import ItemImage from '../../components/ItemImage.jsx';

// Cada view recebe { round, onSubmit, answered } e devolve o `input` esperado
// pela função evaluate do minigame (ver registry.js). Quando `answered` é true,
// os controles travam e (quando faz sentido) destacam a resposta.

function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString('pt-BR') : n;
}

// Feedback de opção NÃO só por cor (WCAG 1.4.1): prefixa ✓/✗ e dá aria-label.
function optionState(opt, answered, correctText, chosen) {
  if (!answered) return { cls: 'btn', text: opt, aria: undefined };
  if (opt === correctText) return { cls: 'btn correct', text: `✓ ${opt}`, aria: `${opt}, correto` };
  if (opt === chosen) return { cls: 'btn wrong', text: `✗ ${opt}`, aria: `${opt}, sua escolha, incorreta` };
  return { cls: 'btn', text: opt, aria: undefined };
}

// Módulo (não recriado por render): manter ItemImage montado evita recarregar
// as fotos ao responder no "Maior ou menor".
function Side({ side, item, answered, onSubmit }) {
  return (
    <button
      className="btn block"
      style={{ height: '100%', flexDirection: 'column', display: 'flex', gap: 8 }}
      disabled={answered}
      onClick={() => onSubmit({ choice: side })}
    >
      <ItemImage src={item.image} alt={item.name} />
      <strong>{item.name}</strong>
      {answered && <span className="muted">{fmtNum(item.metric)}</span>}
    </button>
  );
}

// ---- QuandoLançou ----------------------------------------------------------
// Faixa moderna: a base é de produtos/lançamentos (quase tudo pós-1900). Com o
// piso antigo (-3000) o slider ficava com resolução péssima no celular — 1990
// caía a 99% do trilho e "não passava de 1990". 1900..hoje é usável.
const YEAR_MIN = 1900;
const YEAR_MAX = new Date().getFullYear();

export function WhenLaunchedView({ round, onSubmit, answered }) {
  const [year, setYear] = useState(2000);
  // piso dinâmico: itens raros pré-1900 (ex.: 1º carro, 1886) precisam ser
  // alcançáveis para o acerto exato valer 1000 — sem estragar a resolução >=1900.
  const yearMin = Number.isFinite(round.item.year) ? Math.min(YEAR_MIN, round.item.year) : YEAR_MIN;
  const clamped = Math.max(yearMin, Math.min(YEAR_MAX, year || yearMin));
  const label = clamped;
  return (
    <div className="card">
      <ItemImage src={round.item.image} alt={round.item.name} />
      <h2 className="center" style={{ margin: '12px 0 4px' }}>{round.item.name}</h2>
      <p className="muted center" style={{ marginTop: 0 }}>Em que ano? ({round.item.category})</p>

      <div className="yeardisplay">{label}</div>

      <input
        className="slider"
        type="range"
        min={yearMin}
        max={YEAR_MAX}
        value={clamped}
        disabled={answered}
        onChange={(e) => setYear(Number(e.target.value))}
        aria-label="ano (arraste)"
      />

      <p className="muted center" style={{ margin: '6px 0 4px', fontSize: 13 }}>arraste ou digite o ano</p>
      <input
        type="number"
        value={year}
        disabled={answered}
        min={yearMin}
        max={YEAR_MAX}
        onChange={(e) => setYear(Number(e.target.value))}
        onBlur={() => setYear(clamped)}
        aria-label="ano (digite)"
        style={{ textAlign: 'center' }}
      />

      {!answered && (
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => onSubmit({ guess: clamped })}>
          Confirmar
        </button>
      )}
    </div>
  );
}

// ---- Maior ou menor --------------------------------------------------------
export function HigherLowerView({ round, onSubmit, answered }) {
  const metricType = round.metricType || round.a.metricType || 'valor';
  return (
    <div className="card">
      <p className="center muted">Qual tem mais <strong>{metricType}</strong>?</p>
      <div className="vs">
        <Side side="a" item={round.a} answered={answered} onSubmit={onSubmit} />
        <span className="or">ou</span>
        <Side side="b" item={round.b} answered={answered} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

// ---- De que país é (5 opções) ----------------------------------------------
export function WhichCountryView({ round, onSubmit, answered, feedback }) {
  const [chosen, setChosen] = useState(null);
  return (
    <div className="card">
      <ItemImage src={round.item.image} alt={round.item.name} />
      <h2 className="center" style={{ margin: '12px 0' }}>{round.item.name}</h2>
      <p className="muted center" style={{ marginTop: 0 }}>De que país é?</p>
      <div className="options">
        {round.options.map((opt) => {
          const st = optionState(opt, answered, feedback?.correctText, chosen);
          return (
            <button
              key={opt}
              className={st.cls}
              aria-label={st.aria}
              disabled={answered}
              onClick={() => {
                setChosen(opt);
                onSubmit({ choice: opt });
              }}
            >
              {st.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Adivinhe pela imagem (imagem 100% visível) ----------------------------
export function GuessImageView({ round, onSubmit, answered, feedback }) {
  const [chosen, setChosen] = useState(null);
  return (
    <div className="card">
      <ItemImage src={round.item.image} alt={round.item.name} hideAlt />
      <p className="muted center" style={{ marginTop: 10 }}>Que item é este?</p>
      <div className="options" style={{ marginTop: 4 }}>
        {round.options.map((opt) => {
          const st = optionState(opt, answered, feedback?.correctText, chosen);
          return (
            <button
              key={opt}
              className={st.cls}
              aria-label={st.aria}
              disabled={answered}
              onClick={() => {
                setChosen(opt);
                // imagem sempre visível => sem penalidade de revelação (0)
                onSubmit({ choice: opt, revealStep: 0 });
              }}
            >
              {st.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Linha do tempo --------------------------------------------------------
export function TimelineView({ round, onSubmit, answered }) {
  // A view remonta a cada rodada (key={session.index} no GamePlay), então o
  // useState já reinicializa com os itens novos — sem useEffect redundante.
  const [order, setOrder] = useState(round.items.map((it) => it.id));
  const byId = new Map(round.items.map((it) => [it.id, it]));

  const move = (i, dir) => {
    setOrder((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  return (
    <div className="card">
      <p className="center muted">Ordene do <strong>mais antigo</strong> (topo) ao <strong>mais recente</strong>.</p>
      {order.map((id, i) => {
        const it = byId.get(id);
        if (!it) return null; // proteção contra estado defasado
        return (
          <div className="timeline-item" key={id}>
            <span>{it.name}{answered ? ` (${it.year})` : ''}</span>
            <span className="reorder">
              <button className="btn small ghost" aria-label={`Mover ${it.name} para cima`} disabled={answered || i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="btn small ghost" aria-label={`Mover ${it.name} para baixo`} disabled={answered || i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
            </span>
          </div>
        );
      })}
      {!answered && (
        <button className="btn primary block" style={{ marginTop: 8 }} onClick={() => onSubmit({ orderedIds: order })}>
          Confirmar ordem
        </button>
      )}
    </div>
  );
}

// memo: no Contra o tempo o cronômetro re-renderiza o GamePlay a cada 100ms.
// Com props estáveis (round/onSubmit/answered/feedback), a view não re-renderiza
// junto — mantém o jogo fluido.
export const VIEWS = {
  whenLaunched: memo(WhenLaunchedView),
  higherLower: memo(HigherLowerView),
  whichCountry: memo(WhichCountryView),
  guessImage: memo(GuessImageView),
  timeline: memo(TimelineView),
};
