import { useCallback, useEffect, useState } from "react";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { API_URL, authHeaders, ehAdminMaster } from "../lib/api";
import { mensagemErro } from "../lib/mapaRonda";

// Caixa de sugestões (11/2026). ANÔNIMA: o supervisor envia ideias de
// melhoria para o aplicativo e o sistema não guarda quem enviou. Só o
// Administrador Master vê a lista e marca o andamento de cada uma.

const BASE = `${API_URL}/api/sugestoes`;

const TIPOS: { valor: string; rotulo: string; icone: string }[] = [
  { valor: "MELHORIA", rotulo: "Melhoria", icone: "✨" },
  { valor: "NOVA_FUNCAO", rotulo: "Nova função", icone: "🧩" },
  { valor: "PROBLEMA", rotulo: "Problema no app", icone: "🐞" },
  { valor: "OUTRO", rotulo: "Outro", icone: "💬" },
];

const STATUS: { valor: string; rotulo: string; cor: string }[] = [
  { valor: "NOVA", rotulo: "Nova", cor: "#FF3B3B" },
  { valor: "EM_ANALISE", rotulo: "Em análise", cor: "#fbbf24" },
  { valor: "FEITA", rotulo: "Feita", cor: "#34d399" },
  { valor: "NAO_SERA_FEITA", rotulo: "Não será feita", cor: "#9ca3af" },
];

interface Sugestao {
  id: string;
  tipo: string;
  texto: string;
  status: string;
  criadoEm: string;
}

const LIMITE = 2000;

function FormularioSugestao() {
  const [tipo, setTipo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  const enviar = async () => {
    setErro(null);
    if (!tipo) return setErro("Escolha o tipo da sugestão.");
    if (!texto.trim()) return setErro("Escreva a sua sugestão.");
    setEnviando(true);
    try {
      const r = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ tipo, texto: texto.trim() }),
      });
      if (!r.ok) throw new Error(await mensagemErro(r, "Não foi possível enviar. Tente de novo."));
      setEnviada(true);
      setTipo(null);
      setTexto("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  if (enviada) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-3xl m-0">🙌</p>
        <p className="text-white font-bold mt-2 mb-1">Obrigado pela sugestão!</p>
        <p className="text-sm text-white/60 m-0">Ela foi enviada de forma anônima para a administração.</p>
        <button type="button" onClick={() => setEnviada(false)} className="mt-4 h-10 px-5 rounded-full border border-white/15 text-white/80 text-sm">
          Enviar outra sugestão
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-white mt-0 mb-3">Sobre o que é a sua sugestão?</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TIPOS.map((t) => {
          const marcado = tipo === t.valor;
          return (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              className={`h-12 rounded-xl text-sm border ${marcado ? "bg-[#FF3B3B]/15 border-[#FF3B3B]/60 text-white font-semibold" : "border-white/10 text-white/70"}`}
            >
              {t.icone} {t.rotulo}
            </button>
          );
        })}
      </div>
      <p className="text-sm font-bold text-white mt-0 mb-2">Conte para a gente</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, LIMITE))}
        rows={6}
        placeholder="Ex.: seria bom ter um botão para... / no dia a dia eu sinto falta de... / a tela X está difícil de usar porque..."
        className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60"
      />
      <p className="text-xs text-white/40 text-right mt-1 mb-3">
        {texto.length}/{LIMITE}
      </p>
      {erro && <p className="text-sm text-red-400 mt-0">{erro}</p>}
      <button
        type="button"
        disabled={enviando}
        onClick={enviar}
        className="w-full h-12 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30"
      >
        {enviando ? "Enviando..." : "Enviar sugestão"}
      </button>
      <p className="text-xs text-white/40 text-center mt-3 mb-0">🔒 Anônima: o sistema não registra quem enviou.</p>
    </div>
  );
}

function ListaSugestoes() {
  const [lista, setLista] = useState<Sugestao[] | null>(null);
  const [filtro, setFiltro] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetch(`${BASE}${filtro ? `?status=${filtro}` : ""}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(await mensagemErro(r, "Não foi possível carregar as sugestões."));
      setLista(await r.json());
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mudarStatus = async (s: Sugestao, status: string) => {
    setErro(null);
    try {
      const r = await fetch(`${BASE}/${s.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await mensagemErro(r, "Não foi possível alterar."));
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const excluir = async (s: Sugestao) => {
    if (!window.confirm("Excluir esta sugestão?")) return;
    try {
      const r = await fetch(`${BASE}/${s.id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error(await mensagemErro(r, "Não foi possível excluir."));
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {[{ valor: "", rotulo: "Todas", cor: "" }, ...STATUS].map((s) => (
          <button
            key={s.valor}
            type="button"
            onClick={() => setFiltro(s.valor)}
            className={`h-9 px-4 rounded-full text-sm border ${filtro === s.valor ? "bg-white/10 border-white/40 text-white" : "border-white/10 text-white/60"}`}
          >
            {s.rotulo}
          </button>
        ))}
      </div>
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      {lista === null && !erro && <p className="text-sm text-white/50">Carregando...</p>}
      {lista?.length === 0 && <p className="text-sm text-white/50">Nenhuma sugestão por aqui.</p>}
      <div className="flex flex-col gap-3">
        {lista?.map((s) => {
          const tipo = TIPOS.find((t) => t.valor === s.tipo);
          const status = STATUS.find((x) => x.valor === s.status);
          return (
            <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs text-white/60">
                  {tipo ? `${tipo.icone} ${tipo.rotulo}` : s.tipo} · {new Date(s.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ color: status?.cor, border: `1px solid ${status?.cor}` }}>
                  {status?.rotulo ?? s.status}
                </span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap break-words m-0">{s.texto}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <select
                  value={s.status}
                  onChange={(e) => mudarStatus(s, e.target.value)}
                  className="h-9 rounded-lg bg-white/5 border border-white/10 px-2 text-xs text-white"
                >
                  {STATUS.map((x) => (
                    <option key={x.valor} value={x.valor} style={{ color: "#000" }}>
                      {x.rotulo}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => excluir(s)} className="h-9 px-3 rounded-lg border border-red-500/40 text-red-300 text-xs">
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function Sugestoes() {
  const master = ehAdminMaster();
  const [verFormulario, setVerFormulario] = useState(false);

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            {master ? "Sugestões recebidas" : "Caixa de sugestões"}
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
            {master
              ? "Ideias anônimas dos supervisores para melhorar o aplicativo."
              : "Tem uma ideia para melhorar o aplicativo ou facilitar o seu dia a dia? Conte para a gente."}
          </p>
          {master ? (
            <>
              <button type="button" onClick={() => setVerFormulario((v) => !v)} className="mb-4 h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs">
                {verFormulario ? "Fechar formulário" : "Testar o formulário do supervisor"}
              </button>
              {verFormulario && (
                <div className="mb-6">
                  <FormularioSugestao />
                </div>
              )}
              <ListaSugestoes />
            </>
          ) : (
            <FormularioSugestao />
          )}
        </div>
      </div>
    </div>
  );
}
