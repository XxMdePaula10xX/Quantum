import { useEffect, useState } from 'react';

// Normaliza a URL da imagem:
//  - força https (iOS/ATS e Android/cleartext bloqueiam http://);
//  - pede um thumbnail de 640px no Special:FilePath do Commons, evitando baixar
//    o original (2–15 MB) e decodificá-lo inteiro na memória (risco de crash).
function normalizeSrc(src) {
  if (!src) return src;
  let u = src.replace(/^http:\/\//, 'https://');
  if (u.includes('Special:FilePath/') && !/[?&]width=/.test(u)) {
    u += (u.includes('?') ? '&' : '?') + 'width=640';
  }
  return u;
}

// Imagem do item com fallback gracioso (offline / URL quebrada) e suporte a
// revelação progressiva (modo "Adivinhe pela imagem").
// reveal: 0..steps. blur diminui conforme reveal aumenta.
export default function ItemImage({ src, alt, reveal = null, steps = 4, hideAlt = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]); // nova imagem => tenta de novo
  const blur =
    reveal == null ? 0 : Math.max(0, Math.round((1 - reveal / steps) * 24));
  const scale = reveal == null ? 1 : 1.05; // evita borda transparente do blur
  const url = normalizeSrc(src);

  return (
    <div className="imgwrap">
      {!failed && url ? (
        <img
          className="itemimg"
          src={url}
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
