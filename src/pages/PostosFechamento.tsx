import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { authHeaders } from "../lib/api";
import { mensagemErro } from "../lib/mapaRonda";
import { BASE_POSTOS, apiPostos, dataBr, hojeBrasilia, moeda } from "../lib/postos";

// Fechamento de FT e diárias de freelancer (11/2026) — só Admin Master.
// Sai das coberturas registradas na Confirmação de posto. Período padrão:
// dia 16 a dia 15. Valor da FT vem do padrão por função (Portaria e
// Zeladoria R$ 170, Limpeza R$ 150) e pode ser trocado em cada linha.

interface Linha {
  registroId: string;
  origem: "COBERTURA" | "APOIO";
  tipo: "FT" | "FREELANCER";
  data: string;
  re: string | null;
  nome: string;
  valor: number | null;
  valorPadrao: boolean;
  motivo: string;
  funcao: string;
  contrato: string;
  reprogramada: boolean;
  lancadoEm: string;
  registradoPorNome: string;
}

interface Pendencia {
  registroId: string;
  origem: "COBERTURA" | "APOIO";
  tipo: "FT" | "FREELANCER";
  data: string;
  nome: string;
  re: string | null;
  valor: number | null;
  motivo: string;
  contrato: string;
  situacao: string;
}

interface Resposta {
  de: string;
  ate: string;
  ft: Linha[];
  freelancers: Linha[];
  pendencias: Pendencia[];
  totais: { ft: number; valorFt: number; freelancers: number; valorFreelancers: number };
}

const campo = "h-10 rounded-lg bg-white/5 border border-white/15 px-3 text-sm text-white";

// Período de 16 a 15 que contém a data.
function periodoDe(data: string): { de: string; ate: string } {
  const [a, m, d] = data.split("-").map(Number);
  const ini = d >= 16 ? new Date(Date.UTC(a, m - 1, 16)) : new Date(Date.UTC(a, m - 2, 16));
  const fim = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 1, 15));
  return { de: ini.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
}

function moverPeriodo(de: string, meses: number) {
  const [a, m] = de.split("-").map(Number);
  return periodoDe(new Date(Date.UTC(a, m - 1 + meses, 20)).toISOString().slice(0, 10));
}

function lerValor(texto: string): number | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

function Cartao({ rotulo, valor, detalhe, cor }: { rotulo: string; valor: string | number; detalhe?: string; cor?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3" style={{ flex: "1 1 150px" }}>
      <p className="text-[11px] text-white/50 m-0">{rotulo}</p>
      <p className="text-lg font-bold m-0" style={{ color: cor ?? CORES.texto }}>
        {valor}
      </p>
      {detalhe && <p className="text-[11px] text-white/50 m-0">{detalhe}</p>}
    </div>
  );
}

// Campo de valor que salva ao sair do campo (ou Enter).
function CampoValor({ linha, onSalvo }: { linha: Linha; onSalvo: () => void }) {
  const inicial = linha.valor != null ? String(linha.valor).replace(".", ",") : "";
  const [texto, setTexto] = useState(inicial);
  const [estado, setEstado] = useState<"" | "salvando" | "ok" | "erro">("");
  useEffect(() => setTexto(inicial), [inicial]);

  const salvar = async () => {
    if (texto === inicial) return;
    const v = lerValor(texto);
    if (v === undefined) return setEstado("erro");
    setEstado("salvando");
    try {
      const caminho = linha.origem === "APOIO" ? `/apoios/${linha.registroId}/valor` : `/registros/${linha.registroId}/valor`;
      await apiPostos(caminho, { method: "PATCH", body: JSON.stringify({ valor: v }) }, "Não foi possível salvar o valor.");
      setEstado("ok");
      onSalvo();
    } catch {
      setEstado("erro");
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value.replace(/[^\d,.]/g, ""));
          setEstado("");
        }}
        onBlur={salvar}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={linha.tipo === "FT" ? "padrão" : "sem valor"}
        inputMode="decimal"
        className="h-8 w-20 rounded-md bg-white/5 border border-white/15 px-2 text-xs text-white text-right"
        title={linha.tipo === "FT" ? "Deixe vazio para usar o valor padrão da função" : ""}
      />
      {linha.valorPadrao && estado === "" && <span className="text-[10px] text-white/40">padrão</span>}
      {estado === "salvando" && <span className="text-[10px] text-white/50">…</span>}
      {estado === "ok" && <span className="text-[10px] text-emerald-300">✓</span>}
      {estado === "erro" && <span className="text-[10px] text-red-400">valor inválido</span>}
    </span>
  );
}

function Tabela({ linhas, onSalvo, mostrarRe }: { linhas: Linha[]; onSalvo: () => void; mostrarRe: boolean }) {
  if (!linhas.length) return <p className="text-sm text-white/50">Nada neste período.</p>;
  return (
    <div className="rounded-xl border border-white/10 overflow-x-auto">
      <table className="w-full text-xs text-white/85" style={{ borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr className="text-white/50 text-left">
            <th className="p-2">Data</th>
            {mostrarRe && <th className="p-2">RE</th>}
            <th className="p-2">Nome</th>
            <th className="p-2">Valor</th>
            <th className="p-2">Motivo</th>
            <th className="p-2">Contrato</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.registroId} className="border-t border-white/5 align-top">
              <td className="p-2 whitespace-nowrap">
                {dataBr(l.data)}
                {l.reprogramada && <span className="block text-[10px] text-amber-300">reprogramada</span>}
              </td>
              {mostrarRe && <td className="p-2">{l.re ?? <span className="text-amber-300">—</span>}</td>}
              <td className="p-2">
                {l.nome}
                <span className="block text-[10px] text-white/40">{l.funcao}</span>
              </td>
              <td className="p-2 whitespace-nowrap">
                <CampoValor linha={l} onSalvo={onSalvo} />
              </td>
              <td className="p-2">
                {l.motivo}
                <span className="block text-[10px] text-white/40">Marcado por {l.registradoPorNome}</span>
              </td>
              <td className="p-2">{l.contrato}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PostosFechamento() {
  const inicial = periodoDe(hojeBrasilia());
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ver, setVer] = useState<"ft" | "freelancers" | "pendencias">("ft");
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    if (!de || !ate) return;
    try {
      setDados(await apiPostos<Resposta>(`/fechamento?de=${de}&ate=${ate}`, {}, "Não foi possível carregar o fechamento."));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const mover = (meses: number) => {
    const p = moverPeriodo(de, meses);
    setDe(p.de);
    setAte(p.ate);
  };

  const baixar = async () => {
    setBaixando(true);
    try {
      const r = await fetch(`${BASE_POSTOS}/fechamento/excel?de=${de}&ate=${ate}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(await mensagemErro(r, "Não foi possível gerar o Excel."));
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `FT ${dataBr(de).replace(/\//g, "-")} a ${dataBr(ate).replace(/\//g, "-")}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBaixando(false);
    }
  };

  const t = dados?.totais;
  const abas: { id: typeof ver; rotulo: string }[] = [
    { id: "ft", rotulo: `FT (${t?.ft ?? 0})` },
    { id: "freelancers", rotulo: `Freelancers (${t?.freelancers ?? 0})` },
    { id: "pendencias", rotulo: `Pendências (${dados?.pendencias.length ?? 0})` },
  ];

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "1.5rem 1rem 4rem", minWidth: 0 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }} className="uz-estoque">
          <Link to="/confirmacao-posto" className="text-xs text-white/60">
            ← Confirmação de posto
          </Link>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: "6px 0 0", fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            Fechamento de FT
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
            FT e diárias de freelancer registradas na Confirmação de posto. Só o Administrador Master vê esta tela.
          </p>

          <div className="flex flex-wrap items-end gap-2 mb-3">
            <button type="button" onClick={() => mover(-1)} className="h-10 px-3 rounded-lg border border-white/15 text-white/80 text-sm">
              ‹
            </button>
            <label className="text-[11px] text-white/50 flex flex-col gap-1">
              De
              <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={campo} style={{ colorScheme: "dark" }} />
            </label>
            <label className="text-[11px] text-white/50 flex flex-col gap-1">
              Até
              <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={campo} style={{ colorScheme: "dark" }} />
            </label>
            <button type="button" onClick={() => mover(1)} className="h-10 px-3 rounded-lg border border-white/15 text-white/80 text-sm">
              ›
            </button>
            <button
              type="button"
              disabled={baixando || !dados}
              onClick={baixar}
              className="h-10 px-4 rounded-full text-white text-sm font-semibold disabled:opacity-40 ml-auto"
              style={{ background: CORES.vermelho }}
            >
              {baixando ? "Gerando..." : "⬇ Baixar Excel"}
            </button>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}
          {!dados && !erro && <p className="text-sm text-white/50">Carregando...</p>}

          {dados && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <Cartao rotulo="FT" valor={moeda(dados.totais.valorFt) || "R$ 0,00"} detalhe={`${dados.totais.ft} folga(s) trabalhada(s)`} />
                <Cartao rotulo="Freelancers" valor={moeda(dados.totais.valorFreelancers) || "R$ 0,00"} detalhe={`${dados.totais.freelancers} diária(s)`} />
                <Cartao
                  rotulo="Total"
                  valor={moeda(dados.totais.valorFt + dados.totais.valorFreelancers) || "R$ 0,00"}
                  detalhe={`${dataBr(dados.de)} a ${dataBr(dados.ate)}`}
                />
                <Cartao
                  rotulo="Pendências"
                  valor={dados.pendencias.length}
                  detalhe="conferir antes de enviar"
                  cor={dados.pendencias.length ? "#fbbf24" : "#34d399"}
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {abas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setVer(a.id)}
                    className={`h-9 px-4 rounded-full text-xs font-semibold border ${ver === a.id ? "bg-white/15 border-white/50 text-white" : "border-white/15 text-white/70"}`}
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>

              {ver === "ft" && <Tabela linhas={dados.ft} onSalvo={carregar} mostrarRe />}
              {ver === "freelancers" && <Tabela linhas={dados.freelancers} onSalvo={carregar} mostrarRe={false} />}
              {ver === "pendencias" &&
                (dados.pendencias.length ? (
                  <div className="flex flex-col gap-2">
                    {dados.pendencias.map((p, i) => (
                      <div key={`${p.registroId}-${i}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.06)" }}>
                        <p className="text-sm text-white m-0">
                          {dataBr(p.data)} · {p.nome}
                          {p.re ? ` · RE ${p.re}` : ""} · <span className="text-white/60">{p.tipo === "FT" ? "FT" : "Freelancer"}</span>
                        </p>
                        <p className="text-xs text-amber-300 m-0 mt-1">{p.situacao}</p>
                        <p className="text-[11px] text-white/50 m-0 mt-1">
                          {p.motivo} · {p.contrato}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-emerald-300">Nenhuma pendência.</p>
                ))}

              <p className="text-[11px] text-white/40 mt-4">
                FT sem valor digitado usa o padrão da função (Portaria e Zeladoria R$ 170, Limpeza R$ 150). FT reprogramada = data antes do período, lançada depois do início dele.
                Apoio extra por evento (registrado na Confirmação de posto) entra com o motivo "Apoio extra - …"; Reserva Técnica não entra.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
