import { useEffect, useMemo, useRef, useState } from "react";
import { CORES, FONTES } from "../theme";
import { normalizarBusca } from "./SeletorCondominio";
import { estiloRotulo, type Uniforme } from "../lib/estoque";

// Campo "Uniforme e tamanho" com barra de pesquisa (telas de Entradas e
// Saídas do estoque). Substitui o <select> comum, que ficava longo e com
// a lista de opções branca no Windows, difícil de ler.
// A pesquisa ignora maiúsculas e acentos e procura no nome e no tamanho
// ("camisa g" acha "Camisa operacional · G").

export default function SeletorUniforme({
  rotulo,
  uniformes,
  valor,
  onChange,
}: {
  rotulo: string;
  uniformes: Uniforme[];
  valor: string;
  onChange: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixaRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const selecionado = uniformes.find((u) => u.id === valor);

  // Mesma ordem da lista anterior: agrupado por nome, na ordem em que vem do servidor.
  const filtrados = useMemo(() => {
    const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
    const lista = termos.length
      ? uniformes.filter((u) => {
          const texto = normalizarBusca(`${u.nome} ${u.tamanho}`);
          return termos.every((t) => texto.includes(t));
        })
      : uniformes;
    const mapa = new Map<string, Uniforme[]>();
    for (const u of lista) mapa.set(u.nome, [...(mapa.get(u.nome) ?? []), u]);
    return [...mapa.entries()];
  }, [uniformes, busca]);

  const primeiro = filtrados.length > 0 ? filtrados[0][1][0] : undefined;

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  useEffect(() => {
    if (aberto) {
      setBusca("");
      setTimeout(() => buscaRef.current?.focus(), 0);
    }
  }, [aberto]);

  const escolher = (id: string) => {
    onChange(id);
    setAberto(false);
  };

  return (
    <div style={{ display: "block" }}>
      <span style={estiloRotulo}>{rotulo}</span>
      <div ref={caixaRef} style={{ position: "relative", width: "100%" }}>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          style={{
            width: "100%",
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "0 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${aberto ? CORES.vermelhoBorda : "rgba(255,255,255,0.08)"}`,
            color: selecionado ? "#fff" : CORES.textoSecundario,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
            textAlign: "left",
            boxSizing: "border-box",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {selecionado ? `${selecionado.nome} · ${selecionado.tamanho} (saldo ${selecionado.saldo})` : "Escolha..."}
          </span>
          <span style={{ color: CORES.textoSecundario, fontSize: 10, flexShrink: 0 }}>{aberto ? "▲" : "▼"}</span>
        </button>

        {aberto && (
          <div
            style={{
              position: "absolute",
              top: 42,
              left: 0,
              right: 0,
              minWidth: 260,
              zIndex: 50,
              background: CORES.superficie2,
              border: `1px solid ${CORES.borda}`,
              borderRadius: 10,
              boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: 8, borderBottom: `1px solid ${CORES.bordaSuave}` }}>
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (primeiro) escolher(primeiro.id);
                  }
                  if (e.key === "Escape") setAberto(false);
                }}
                placeholder="🔍 Pesquisar uniforme ou tamanho..."
                style={{
                  width: "100%",
                  height: 34,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${CORES.borda}`,
                  color: "#fff",
                  padding: "0 10px",
                  fontSize: 13,
                  fontFamily: FONTES.corpo,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {filtrados.length === 0 ? (
                <p style={{ fontSize: 12, color: CORES.textoSecundario, padding: "10px 14px", margin: 0 }}>
                  Nenhum uniforme encontrado.
                </p>
              ) : (
                filtrados.map(([nome, itens]) => (
                  <div key={nome}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: CORES.textoSecundario,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        margin: 0,
                        padding: "8px 14px 4px",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      {nome}
                    </p>
                    {itens.map((u) => {
                      const ativo = u.id === valor;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => escolher(u.id)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 14px 8px 22px",
                            background: ativo ? CORES.vermelhoSuave : "transparent",
                            color: "#fff",
                            border: "none",
                            borderLeft: ativo ? `3px solid ${CORES.vermelho}` : "3px solid transparent",
                            fontSize: 13,
                            fontFamily: FONTES.corpo,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                          onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span>Tamanho {u.tamanho}</span>
                          <span style={{ color: u.saldo <= 0 ? "#f87171" : CORES.textoSecundario, fontSize: 12, flexShrink: 0 }}>
                            saldo {u.saldo}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
            <p style={{ fontSize: 11, color: CORES.textoSecundario, margin: 0, padding: "6px 14px", borderTop: `1px solid ${CORES.bordaSuave}` }}>
              {uniformes.length} uniforme{uniformes.length === 1 ? "" : "s"} cadastrado{uniformes.length === 1 ? "" : "s"} · Enter escolhe o primeiro
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
