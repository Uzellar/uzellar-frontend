import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { CORES, FONTES } from "../theme";
import { normalizarBusca } from "./SeletorCondominio";
import { estiloCampo, estiloRotulo } from "../lib/estoque";

// Campos com barra de pesquisa usados na Nova requisição de uniformes:
// - SeletorPesquisa: escolher uma opção de uma lista (ex.: nome do uniforme);
// - CampoContrato: digitar o contrato, com sugestões dos contratos já usados
//   (continua aceitando um nome novo, que o sistema cadastra).
// A pesquisa ignora maiúsculas e acentos e aceita várias palavras.

const estiloCaixaLista = {
  position: "absolute" as const,
  top: 42,
  left: 0,
  right: 0,
  minWidth: 240,
  zIndex: 50,
  background: CORES.superficie2,
  border: `1px solid ${CORES.borda}`,
  borderRadius: 10,
  boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
  overflow: "hidden",
};

const estiloBusca = {
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
  boxSizing: "border-box" as const,
};

function estiloItem(ativo: boolean) {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    width: "100%",
    textAlign: "left" as const,
    padding: "9px 14px",
    background: ativo ? CORES.vermelhoSuave : "transparent",
    color: "#fff",
    border: "none",
    borderLeft: ativo ? `3px solid ${CORES.vermelho}` : "3px solid transparent",
    fontSize: 13,
    fontFamily: FONTES.corpo,
    cursor: "pointer",
  };
}

function bate(texto: string, busca: string) {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return true;
  const alvo = normalizarBusca(texto);
  return termos.every((t) => alvo.includes(t));
}

// Fecha a caixa ao clicar fora dela.
function useFecharFora(aberto: boolean, ref: RefObject<HTMLDivElement>, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto, ref, fechar]);
}

export interface OpcaoPesquisa {
  valor: string;
  rotulo: string;
  detalhe?: ReactNode;
}

export function SeletorPesquisa({
  rotulo,
  opcoes,
  valor,
  onChange,
  placeholderBusca = "🔍 Pesquisar...",
  vazio = "Nada encontrado.",
}: {
  rotulo: string;
  opcoes: OpcaoPesquisa[];
  valor: string;
  onChange: (valor: string) => void;
  placeholderBusca?: string;
  vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixaRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const fechar = useMemo(() => () => setAberto(false), []);
  useFecharFora(aberto, caixaRef, fechar);

  const selecionada = opcoes.find((o) => o.valor === valor);
  const filtradas = useMemo(() => opcoes.filter((o) => bate(o.rotulo, busca)), [opcoes, busca]);

  useEffect(() => {
    if (aberto) {
      setBusca("");
      setTimeout(() => buscaRef.current?.focus(), 0);
    }
  }, [aberto]);

  const escolher = (v: string) => {
    onChange(v);
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
            ...estiloCampo,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
            color: selecionada ? "#fff" : CORES.textoSecundario,
            border: `1px solid ${aberto ? CORES.vermelhoBorda : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {selecionada ? selecionada.rotulo : "Escolha..."}
          </span>
          <span style={{ color: CORES.textoSecundario, fontSize: 10, flexShrink: 0 }}>{aberto ? "▲" : "▼"}</span>
        </button>

        {aberto && (
          <div style={estiloCaixaLista}>
            <div style={{ padding: 8, borderBottom: `1px solid ${CORES.bordaSuave}` }}>
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtradas.length > 0) escolher(filtradas[0].valor);
                  }
                  if (e.key === "Escape") setAberto(false);
                }}
                autoFocus
                placeholder={placeholderBusca}
                style={estiloBusca}
              />
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {filtradas.length === 0 ? (
                <p style={{ fontSize: 12, color: CORES.textoSecundario, padding: "10px 14px", margin: 0 }}>{vazio}</p>
              ) : (
                filtradas.map((o) => (
                  <button key={o.valor} type="button" onClick={() => escolher(o.valor)} style={estiloItem(o.valor === valor)}>
                    <span>{o.rotulo}</span>
                    {o.detalhe && <span style={{ fontSize: 11, flexShrink: 0 }}>{o.detalhe}</span>}
                  </button>
                ))
              )}
            </div>
            <p style={{ fontSize: 11, color: CORES.textoSecundario, margin: 0, padding: "6px 14px", borderTop: `1px solid ${CORES.bordaSuave}` }}>
              {opcoes.length} opç{opcoes.length === 1 ? "ão" : "ões"} · Enter escolhe o primeiro
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function CampoContrato({
  rotulo,
  valor,
  onChange,
  contratos,
}: {
  rotulo: string;
  valor: string;
  onChange: (nome: string) => void;
  contratos: { id: string; nome: string; setor: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const fechar = useMemo(() => () => setAberto(false), []);
  useFecharFora(aberto, caixaRef, fechar);

  const ordenados = useMemo(
    () => [...contratos].sort((a, b) => a.nome.trim().localeCompare(b.nome.trim(), "pt-BR")),
    [contratos],
  );
  const sugestoes = useMemo(() => ordenados.filter((c) => bate(c.nome, valor)), [ordenados, valor]);
  const existeIgual = contratos.some((c) => normalizarBusca(c.nome) === normalizarBusca(valor));

  return (
    <div style={{ display: "block" }}>
      <span style={estiloRotulo}>{rotulo}</span>
      <div ref={caixaRef} style={{ position: "relative", width: "100%" }}>
        <input
          value={valor}
          onChange={(e) => {
            onChange(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Tab") setAberto(false);
          }}
          placeholder="🔍 Pesquise ou digite o nome do contrato"
          maxLength={150}
          autoComplete="off"
          style={{ ...estiloCampo, width: "100%", border: `1px solid ${aberto ? CORES.vermelhoBorda : "rgba(255,255,255,0.08)"}` }}
        />
        {aberto && contratos.length > 0 && (
          <div style={estiloCaixaLista}>
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {sugestoes.length === 0 ? (
                <p style={{ fontSize: 12, color: CORES.textoSecundario, padding: "10px 14px", margin: 0 }}>
                  Nenhum contrato encontrado. Ao enviar, "{valor.trim()}" será cadastrado como contrato novo.
                </p>
              ) : (
                sugestoes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(c.nome);
                      setAberto(false);
                    }}
                    style={estiloItem(normalizarBusca(c.nome) === normalizarBusca(valor))}
                  >
                    <span>{c.nome}</span>
                    <span style={{ fontSize: 11, color: CORES.textoSecundario, flexShrink: 0 }}>
                      {c.setor === "PUBLICO" ? "Público" : c.setor === "PRIVADO" ? "Privado" : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
            <p style={{ fontSize: 11, color: CORES.textoSecundario, margin: 0, padding: "6px 14px", borderTop: `1px solid ${CORES.bordaSuave}` }}>
              {valor.trim() && !existeIgual && sugestoes.length > 0
                ? "Não achou? Continue digitando: um nome novo vira contrato novo."
                : `${contratos.length} contrato${contratos.length === 1 ? "" : "s"} já usado${contratos.length === 1 ? "" : "s"}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
