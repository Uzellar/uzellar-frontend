import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CORES, FONTES } from "../theme";

// Seletor de condomínio com barra de pesquisa — substitui a fileira de
// botões (um por condomínio), que ficava enorme com dezenas de
// condomínios. Usado em Dashboard, Solicitações, Cadastro de
// condomínios, Visita da supervisão, Dashboard de supervisão e
// Relatório de visitas.

interface CondominioOpcao {
  id: string;
  nome: string;
}

// Ignora maiúsculas e acentos na pesquisa ("vincita" acha "Vincitá").
export function normalizarBusca(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export default function SeletorCondominio({
  condominios,
  valor,
  onChange,
  marginBottom = 20,
  extra,
  opcaoTodos,
}: {
  condominios: CondominioOpcao[];
  valor: string | null;
  onChange: (id: string) => void;
  marginBottom?: number;
  extra?: ReactNode; // botão opcional ao lado (ex.: excluir condomínio)
  // Opcional: primeira opção "todos" (ex.: Dashboard de supervisão).
  // Quando escolhida, onChange recebe "" e valor deve ser "".
  opcaoTodos?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixaRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const selecionado = condominios.find((c) => c.id === valor);
  const todosSelecionado = !!opcaoTodos && valor === "";

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    const ordenados = [...condominios].sort((a, b) => a.nome.trim().localeCompare(b.nome.trim(), "pt-BR"));
    if (!termo) return ordenados;
    return ordenados.filter((c) => normalizarBusca(c.nome).includes(termo));
  }, [condominios, busca]);

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
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom, flexWrap: "wrap" }}>
      <div ref={caixaRef} style={{ position: "relative", width: "100%", maxWidth: 420 }}>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          style={{
            width: "100%",
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "0 14px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${aberto ? CORES.vermelhoBorda : CORES.borda}`,
            color: "#fff",
            fontSize: 13,
            fontFamily: FONTES.corpo,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 10, color: CORES.textoMuted, letterSpacing: 0.4 }}>CONDOMÍNIO</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selecionado ? selecionado.nome.trim() : todosSelecionado ? opcaoTodos : "Selecione um condomínio"}
            </span>
          </span>
          <span style={{ color: CORES.textoSecundario, fontSize: 11 }}>{aberto ? "▲" : "▼"}</span>
        </button>

        {aberto && (
          <div
            style={{
              position: "absolute",
              top: 46,
              left: 0,
              right: 0,
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
                  if (e.key === "Enter" && filtrados.length > 0) escolher(filtrados[0].id);
                  if (e.key === "Escape") setAberto(false);
                }}
                placeholder="🔍 Pesquisar condomínio..."
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
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {opcaoTodos && !busca.trim() && (
                <button
                  type="button"
                  onClick={() => escolher("")}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 14px",
                    background: todosSelecionado ? CORES.vermelhoSuave : "transparent",
                    color: todosSelecionado ? "#fff" : "#ccc",
                    border: "none",
                    borderLeft: todosSelecionado ? `3px solid ${CORES.vermelho}` : "3px solid transparent",
                    borderBottom: `1px solid ${CORES.bordaSuave}`,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: FONTES.corpo,
                    cursor: "pointer",
                  }}
                >
                  {opcaoTodos}
                </button>
              )}
              {filtrados.length === 0 ? (
                <p style={{ fontSize: 12, color: CORES.textoMuted, padding: "10px 14px", margin: 0 }}>
                  Nenhum condomínio encontrado.
                </p>
              ) : (
                filtrados.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => escolher(c.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 14px",
                      background: c.id === valor ? CORES.vermelhoSuave : "transparent",
                      color: c.id === valor ? "#fff" : "#ccc",
                      border: "none",
                      borderLeft: c.id === valor ? `3px solid ${CORES.vermelho}` : "3px solid transparent",
                      fontSize: 13,
                      fontFamily: FONTES.corpo,
                      cursor: "pointer",
                    }}
                  >
                    {c.nome.trim()}
                  </button>
                ))
              )}
            </div>
            <p style={{ fontSize: 11, color: CORES.textoMuted, margin: 0, padding: "6px 14px", borderTop: `1px solid ${CORES.bordaSuave}` }}>
              {condominios.length} condomínio{condominios.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
      {extra}
    </div>
  );
}
