import { useEffect, useState } from 'react';
import { loadCredits, USING_SAMPLE_DATA } from '../data/index.js';

// Tela de Fontes/Créditos (PRD seção 4.6 / 9): cumprimento das licenças CC-BY.
// Os créditos são carregados sob demanda (arquivo separado), só ao abrir aqui.
export default function SourcesScreen({ onBack }) {
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    let alive = true;
    loadCredits().then((c) => alive && setCredits(c)).catch(() => alive && setCredits([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">📜 Fontes</div>
        <button className="btn small ghost" onClick={onBack}>Menu</button>
      </div>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          Dados de <strong>Wikidata</strong> (CC0). Imagens do <strong>Wikimedia Commons</strong>, em domínio
          público ou sob licenças CC-BY/CC-BY-SA — cada crédito é exibido abaixo conforme exigido.
        </p>
        {USING_SAMPLE_DATA && (
          <div className="banner">
            Build atual usa base de <strong>exemplo</strong>: imagens são placeholders e os créditos abaixo são
            marcados como <code>PLACEHOLDER (dev)</code>. A base real preenche licença e autor por imagem.
          </div>
        )}
      </div>

      <div className="card">
        {credits == null ? (
          <p className="muted center">Carregando créditos…</p>
        ) : credits.length === 0 ? (
          <p className="muted center">Sem imagens nesta base.</p>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>{credits.length} imagens creditadas.</p>
            {credits.slice(0, 500).map((c) => (
              <div key={c.id} className="lb-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <strong>{c.name}</strong>
                <span className="muted" style={{ fontSize: 13 }}>Licença: {c.license} · Autor: {c.author}</span>
              </div>
            ))}
            {credits.length > 500 && (
              <p className="muted center">…e mais {credits.length - 500}. (Lista completa no app empacotado.)</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
