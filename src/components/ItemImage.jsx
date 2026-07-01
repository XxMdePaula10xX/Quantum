import { useState } from 'react';

// Imagem do item com fallback gracioso (offline / URL quebrada) e suporte a
// revelação progressiva (modo "Adivinhe pela imagem").
// reveal: 0..steps. blur diminui conforme reveal aumenta.
export default function ItemImage({ src, alt, reveal = null, steps = 4, hideAlt = false }) {
  const [failed, setFailed] = useState(false);
  const blur =
    reveal == null ? 0 : Math.max(0, Math.round((1 - reveal / steps) * 24));
  const scale = reveal == null ? 1 : 1.05; // evita borda transparente do blur

  return (
    <div className="imgwrap">
      {!failed && src ? (
        <img
          className="itemimg"
          src={src}
          alt={hideAlt ? '' : alt}
          // eager + no-referrer: no WKWebView do iOS o lazy e o Referer da
          // Wikimedia às vezes impedem a imagem de carregar ("não aparece").
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{ filter: blur ? `blur(${blur}px)` : 'none', transform: `scale(${scale})` }}
        />
      ) : (
        <div className="itemimg" />
      )}
      {(failed || !src) && (
        <div className="fallback">{hideAlt ? '🖼️ (imagem oculta)' : `🖼️ ${alt}`}</div>
      )}
    </div>
  );
}
