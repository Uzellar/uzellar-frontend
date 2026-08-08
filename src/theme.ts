import type { CSSProperties } from "react";

// Design tokens extraídos do site institucional (ulrik.com.br) — usar
// esses valores em vez de repetir cores/fontes soltas em cada tela.

export const CORES = {
  fundo: "#0a0a0a",
  superficie: "#141414",
  superficie2: "#1a1a1a",
  borda: "rgba(255,255,255,0.08)",
  bordaSuave: "rgba(255,255,255,0.06)",
  texto: "#ffffff",
  textoSecundario: "#a8a8a8",
  textoMuted: "#6b6b6b",
  vermelho: "#FF3B3B",
  vermelhoSuave: "rgba(255,59,59,0.10)",
  vermelhoBorda: "rgba(255,59,59,0.20)",
};

export const FONTES = {
  titulo: "'Inter Tight', 'Inter', sans-serif",
  corpo: "'Inter', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

// Cartão com efeito de vidro fosco (glassmorphism), usado no site
// institucional em painéis, badges e destaques.
export const estiloCartaoVidro: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${CORES.borda}`,
  borderRadius: 20,
  backdropFilter: "blur(18px) saturate(140%)",
};

// Botão principal — pílula vermelha com brilho, igual ao "Solicitar
// Diagnóstico" do site institucional.
export const estiloBotaoPrimario: CSSProperties = {
  background: CORES.vermelho,
  color: "#fff",
  border: "none",
  borderRadius: 9999,
  fontFamily: FONTES.corpo,
  fontWeight: 600,
  boxShadow: "0 12px 40px -6px rgba(255,59,59,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset",
  cursor: "pointer",
};

export const estiloBotaoSecundario: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${CORES.borda}`,
  color: CORES.texto,
  borderRadius: 9999,
  fontFamily: FONTES.corpo,
  fontWeight: 600,
  backdropFilter: "blur(10px)",
  cursor: "pointer",
};

// Selo pequeno com pontinho vermelho pulsante + texto mono maiúsculo,
// igual ao badge "Segurança Inteligente" do hero do site institucional.
export const estiloBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 9999,
  padding: "6px 14px",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${CORES.bordaSuave}`,
  backdropFilter: "blur(12px)",
  fontFamily: FONTES.mono,
  fontSize: 10,
  letterSpacing: "0.28em",
  textTransform: "uppercase" as const,
  color: CORES.textoSecundario,
};
