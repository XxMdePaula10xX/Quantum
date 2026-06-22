import { useEffect, useState } from 'react';
import ItemImage from '../../components/ItemImage.jsx';

// Cada view recebe { round, onSubmit, answered } e devolve o `input` esperado
// pela função evaluate do minigame (ver registry.js). Quando `answered` é true,
// os controles travam e (quando faz sentido) destacam a resposta.

function fmtNum(n) {
  return typeof n === 'number' ? n.toLocaleString('pt-BR') : n;
}

// ---- QuandoLançou ----------------------------------------------------------
const YEAR_MIN = -3000;
const YEAR_MAX = new Date().getFullYear();

export function WhenLaunchedView({ round, onSubmit, answered }) {
  const [year, setYear] = useState(1990);
  const clamped = Math.max(YEAR_MIN, Math.min(YEAR_MAX, year || 0));
  const label = year < 0 ? `${Math.abs(year)} a.C.` : year;
  return (
    <div className="card">
      <ItemImage src={round.item.image} alt={round.item.name} />
      <h2 className="center" style={{ margin: '12px 0 4px' }}>{round.item.name}</h2>
      <p className="muted center" style={{ marginTop: 0 }}>Em que ano? ({round.item.category})</p>

      <div className="yeardisplay">{label}</div>

      <input
        className="slider"
        type="range"
        min={YEAR_MIN}
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
        min={YEAR_MIN}
        max={YEAR_MAX}
        onChange={(e) => setYear(Number(e.target.value))}
        aria-label="ano (digite)"
        style={{ textAlign: 'center' }}
      />

      {!answered && (
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => onSubmit({ guess: year })}>
          Confirmar
        </button>
      )}
    </div>
  );
}

// ---- Maior ou menor --------------------------------------------------------
export function HigherLowerView({ round, onSubmit, answered }) {
  const metricType = round.metricType || round.a.metricType || 'valor';
  const Side = ({ side, item }) => (
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
  return (
    <div className="card">
      <p className="center muted">Qual tem mais <strong>{metricType}</strong>?</p>
      <div className="vs">
        <Side side="a" item={round.a} />
        <span className="or">ou</span>
        <Side side="b" item={round.b} />
      </div>
    </div>
  );
}

// ---- De que país é (lista pesquisável) -------------------------------------
function normalize(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function WhichCountryView({ round, onSubmit, answered, feedback }) {
  const [chosen, setChosen] = useState(null);
  const [query, setQuery] = useState('');

  const filtered = answered
    ? []
    : round.countries.filter((c) => normalize(c).includes(normalize(query.trim()))).slice(0, 8);

  return (
    <div className="card">
      <ItemImage src={round.item.image} alt={round.item.name} />
      <h2 className="center" style={{ margin: '12px 0' }}>{round.item.name}</h2>
      <p className="muted center" style={{ marginTop: 0 }}>De que país é? Busque e selecione.</p>

      {answered ? (
        <div className="options">
          <div className={`btn ${feedback?.correct ? 'correct' : 'wrong'}`}>
            {chosen || '—'} {feedback?.correct ? '' : `→ certo: ${feedback?.correctText}`}
          </div>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o país…"
            autoFocus
          />
          <div className="options country-list" style={{ marginTop: 10 }}>
            {filtered.length === 0 && <p className="muted center">Nenhum país encontrado.</p>}
            {filtered.map((c) => (
              <button
                key={c}
                className="btn ghost"
                onClick={() => {
                  setChosen(c);
                  onSubmit({ choice: c });
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Adivinhe pela imagem --------------------------------------------------
export function GuessImageView({ round, onSubmit, answered, feedback }) {
  const [reveal, setReveal] = useState(0);
  const [chosen, setChosen] = useState(null);
  const steps = round.steps;
  return (
    <div className="card">
      <ItemImage src={round.item.image} alt={round.item.name} reveal={answered ? steps : reveal} steps={steps} hideAlt />
      <p className="muted center">Revelação {answered ? steps : reveal}/{steps}</p>
      {!answered && reveal < steps && (
        <button className="btn ghost block" onClick={() => setReveal((r) => r + 1)}>
          Revelar mais (vale menos pontos)
        </button>
      )}
      <div className="options" style={{ marginTop: 10 }}>
        {round.options.map((opt) => {
          let cls = 'btn';
          if (answered) {
            if (opt === feedback?.correctText) cls += ' correct';
            else if (opt === chosen) cls += ' wrong';
          }
          return (
            <button
              key={opt}
              className={cls}
              disabled={answered}
              onClick={() => {
                setChosen(opt);
                onSubmit({ choice: opt, revealStep: reveal });
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Linha do tempo --------------------------------------------------------
export function TimelineView({ round, onSubmit, answered }) {
  const [order, setOrder] = useState(round.items.map((it) => it.id));
  useEffect(() => setOrder(round.items.map((it) => it.id)), [round]);
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
        return (
          <div className="timeline-item" key={id}>
            <span>{it.name}{answered ? ` (${it.year})` : ''}</span>
            <span className="reorder">
              <button className="btn small ghost" disabled={answered || i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="btn small ghost" disabled={answered || i === order.length - 1} onClick={() => move(i, 1)}>↓</button>
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

export const VIEWS = {
  whenLaunched: WhenLaunchedView,
  higherLower: HigherLowerView,
  whichCountry: WhichCountryView,
  guessImage: GuessImageView,
  timeline: TimelineView,
};
