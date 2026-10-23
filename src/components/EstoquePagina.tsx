import type { ReactNode } from "react";
import NavAdmin from "./NavAdmin";
import { CORES, FONTES } from "../theme";
import { estiloRotulo } from "../lib/estoque";

// Moldura comum das telas do Estoque de uniformes (menu + título).
export default function EstoquePagina({
  titulo,
  subtitulo,
  acoes,
  children,
  largura = 960,
}: {
  titulo: string;
  subtitulo?: string;
  acoes?: ReactNode;
  children: ReactNode;
  largura?: number;
}) {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#fff", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: largura, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
                  {titulo}
                </p>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 999, padding: "3px 10px" }}>
                  👕 Estoque
                </span>
              </div>
              {subtitulo && <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>{subtitulo}</p>}
            </div>
            {acoes}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Campo de formulário com rótulo em cima.
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={estiloRotulo}>{rotulo}</span>
      {children}
    </label>
  );
}
