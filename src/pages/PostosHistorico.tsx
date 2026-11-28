import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import SeletorCondominio from "../components/SeletorCondominio";
import { ABAS, ROTULO_AREA, ROTULO_COBERTURA, ROTULO_STATUS, apiPostos, corDoStatus, dataBr, dataHoraBr, hojeBrasilia, moeda, somarDias } from "../lib/postos";
import type { ApoioExtra, PostoResumo } from "../lib/postos";
import { ehAdminMaster } from "../lib/api";

// Histórico da confirmação de posto: marcações do dia (confirmado, falta,
// recolhimento, folga, posto vago) e as trocas no posto (recolhimento,
// iniciante, inclusão, retirada, edição), com filtros por data e posto.

interface RegistroHist {
  id: string;
  data: string;
  posto: string;
  colaborador: string;
  matricula: string | null;
  area: string;
  turno: string;
  status: string;
  statusRotulo: string;
  coberturaTipo: string | null;
  coberturaNome: string | null;
  coberturaValor: number | null;
  observacao: string | null;
  registradoPorNome: string;
}

interface EventoHist {
  id: string;
  data: string;
  posto: string;
  tipo: string;
  descricao: string;
  usuarioNome: string | null;
}

interface RemanejamentoHist {
  id: string;
  nome: string;
  matricula: string | null;
  postoOrigem: string;
  postoOrigemTipo: string;
  postoDestino: string;
  inicio: string;
  usuarioNome: string | null;
  criadoEm: string;
  desfeitoEm: string | null;
}

interface Resposta {
  resumo: {
    porStatus: Record<string, number>;
    reserva: number;
    ft?: number;
    outros?: number;
    freelancer: number;
    semCobertura: number;
    valorFreelancer: number;
  };
  registros: RegistroHist[];
  eventos: EventoHist[];
  remanejamentos?: RemanejamentoHist[];
}

const ROTULO_EVENTO: Record<string, string> = {
  IMPORTACAO: "Carga inicial",
  ENTRADA: "Inclusão",
  SAIDA: "Retirada",
  RECOLHIMENTO: "Recolhimento",
  INICIANTE: "Iniciante",
  EDICAO: "Cadastro alterado",
  DESFEITO: "Recolhimento desfeito",
  TRANSFERENCIA: "Remanejamento (saída)",
};

const campo = "h-10 rounded-lg bg-white/5 border border-white/15 px-3 text-sm text-white";

function Cartao({ rotulo, valor, cor }: { rotulo: string; valor: string | number; cor?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3" style={{ flex: "1 1 130px" }}>
      <p className="text-[11px] text-white/50 m-0">{rotulo}</p>
      <p className="m-0 mt-1 font-bold" style={{ fontSize: 20, color: cor ?? CORES.texto, fontFamily: FONTES.titulo }}>
        {valor}
      </p>
    </div>
  );
}

// Valores (diária de freelancer) só para o Admin Master (11/2026).
function baixarCsv(registros: RegistroHist[]) {
  const master = ehAdminMaster();
  const cab = ["Data", "Posto", "Colaborador", "Matrícula", "Área", "Turno", "Situação", "Cobertura", "Quem cobriu", ...(master ? ["Valor diária"] : []), "Observação", "Marcado por"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = registros.map((r) =>
    [
      dataBr(r.data),
      r.posto,
      r.colaborador,
      r.matricula,
      ROTULO_AREA[r.area] ?? r.area,
      r.turno === "NOTURNO" ? "Noturno" : "Diurno",
      r.statusRotulo,
      r.coberturaTipo ? ROTULO_COBERTURA[r.coberturaTipo] : "",
      r.coberturaNome,
      ...(master ? [r.coberturaValor != null ? String(r.coberturaValor).replace(".", ",") : ""] : []),
      r.observacao,
      r.registradoPorNome,
    ]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(["\ufeff" + [cab.map(esc).join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `confirmacao-posto-${hojeBrasilia()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function baixarCsvRemanejamentos(lista: RemanejamentoHist[]) {
  const cab = ["Colaborador", "Matrícula", "De", "Para", "A partir de", "Remanejado por", "Registrado em", "Situação"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = lista.map((m) =>
    [m.nome, m.matricula, m.postoOrigem, m.postoDestino, dataBr(m.inicio), m.usuarioNome, dataHoraBr(m.criadoEm), m.desfeitoEm ? "Desfeito" : "Valendo"]
      .map(esc)
      .join(";"),
  );
  const blob = new Blob(["\ufeff" + [cab.map(esc).join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `remanejamentos-${hojeBrasilia()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function PostosHistorico() {
  const hoje = hojeBrasilia();
  const [de, setDe] = useState(somarDias(hoje, -6));
  const [ate, setAte] = useState(hoje);
  const [postoId, setPostoId] = useState("");
  const [aba, setAba] = useState("");
  const [status, setStatus] = useState("");
  const [nome, setNome] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [postos, setPostos] = useState<{ id: string; nome: string }[]>([]);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ver, setVer] = useState<"marcacoes" | "trocas" | "remanejamentos" | "apoios">("marcacoes");
  const [apoios, setApoios] = useState<ApoioExtra[] | null>(null);

  // Lista de postos para o filtro (os do usuário, em qualquer aba).
  useEffect(() => {
    Promise.all(ABAS.map((a) => apiPostos<{ postos: PostoResumo[] }>(`/lista?data=${hoje}&aba=${a.aba}`).catch(() => ({ postos: [] as PostoResumo[] }))))
      .then((rs) => {
        const mapa = new Map<string, string>();
        rs.forEach((r) => r.postos.forEach((p) => mapa.set(p.id, p.nome)));
        setPostos([...mapa.entries()].map(([id, n]) => ({ id, nome: n })));
      })
      .catch(() => setPostos([]));
  }, [hoje]);

  useEffect(() => {
    const t = setTimeout(() => setNomeBusca(nome.trim()), 400);
    return () => clearTimeout(t);
  }, [nome]);

  const carregar = useCallback(async () => {
    if (!de || !ate) return;
    const q = new URLSearchParams({ de, ate });
    if (postoId) q.set("postoId", postoId);
    if (aba) q.set("aba", aba);
    if (status) q.set("status", status);
    if (nomeBusca) q.set("colaborador", nomeBusca);
    // Apoio extra por evento (11/2026): mesmos filtros de período, posto e nome.
    const qa = new URLSearchParams({ de, ate });
    if (postoId) qa.set("postoId", postoId);
    if (nomeBusca) qa.set("colaborador", nomeBusca);
    apiPostos<ApoioExtra[]>(`/apoios-historico?${qa.toString()}`)
      .then(setApoios)
      .catch(() => setApoios([]));
    try {
      setDados(await apiPostos<Resposta>(`/historico?${q.toString()}`, {}, "Não foi possível carregar o histórico."));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [de, ate, postoId, aba, status, nomeBusca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const r = dados?.resumo;
  const porDia = useMemo(() => {
    const mapa = new Map<string, RegistroHist[]>();
    for (const x of dados?.registros ?? []) mapa.set(x.data, [...(mapa.get(x.data) ?? []), x]);
    return [...mapa.entries()];
  }, [dados]);

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "1.5rem 1rem 4rem", minWidth: 0 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }} className="uz-estoque">
          <Link to="/confirmacao-posto" className="text-xs text-white/60">
            ← Confirmação de posto
          </Link>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: "6px 0 0", fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            Histórico de postos
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>Faltas, recolhimentos, iniciantes, coberturas e remanejamentos por período e posto.</p>

          <div className="flex flex-wrap gap-2 mb-2">
            <label className="text-[11px] text-white/50 flex flex-col gap-1">
              De
              <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={campo} style={{ colorScheme: "dark" }} />
            </label>
            <label className="text-[11px] text-white/50 flex flex-col gap-1">
              Até
              <input type="date" value={ate} min={de} max={hoje} onChange={(e) => setAte(e.target.value)} className={campo} style={{ colorScheme: "dark" }} />
            </label>
            <label className="text-[11px] text-white/50 flex flex-col gap-1">
              Aba
              <select value={aba} onChange={(e) => setAba(e.target.value)} className={campo}>
                <option value="">Todas</option>
                {ABAS.map((a) => (
                  <option key={a.aba} value={a.aba}>
                    {a.titulo.replace(/^\S+\s/, "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-white/50 flex flex-col gap-1">
              Situação
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={campo}>
                <option value="">Todas</option>
                {Object.entries(ROTULO_STATUS).map(([v, rot]) => (
                  <option key={v} value={v}>
                    {rot}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-white/50 flex flex-col gap-1" style={{ flex: "1 1 160px" }}>
              Colaborador ou quem cobriu
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={campo} />
            </label>
          </div>
          <SeletorCondominio condominios={postos} valor={postoId} onChange={setPostoId} opcaoTodos="Todos os postos" marginBottom={16} />

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          {r && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Cartao rotulo="Confirmados" valor={r.porStatus.CONFIRMADO ?? 0} cor="#34d399" />
              <Cartao rotulo="Faltas" valor={r.porStatus.FALTA ?? 0} cor="#ff6b6b" />
              <Cartao rotulo="Recolhimentos" valor={r.porStatus.RECOLHIMENTO ?? 0} cor="#ff6b6b" />
              <Cartao rotulo="Postos vagos" valor={r.porStatus.VAGO ?? 0} cor="#ff6b6b" />
              <Cartao rotulo="Coberturas da Reserva" valor={r.reserva} />
              <Cartao rotulo="FT (folga trabalhada)" valor={r.ft ?? 0} />
              <Cartao rotulo="Freelancers" valor={r.freelancer} />
              <Cartao rotulo="Outros" valor={r.outros ?? 0} />
              {r.semCobertura > 0 && <Cartao rotulo="Sem cobertura (antigos)" valor={r.semCobertura} cor="#fbbf24" />}
              {ehAdminMaster() && <Cartao rotulo="Gasto com freelancer" valor={moeda(r.valorFreelancer) || "R$ 0,00"} />}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex gap-2">
              {[
                { v: "marcacoes" as const, rot: `Marcações do dia${dados ? ` (${dados.registros.length})` : ""}` },
                { v: "trocas" as const, rot: `Trocas no posto${dados ? ` (${dados.eventos.length})` : ""}` },
                { v: "remanejamentos" as const, rot: `Remanejamentos${dados ? ` (${dados.remanejamentos?.length ?? 0})` : ""}` },
                { v: "apoios" as const, rot: `Apoio extra${apoios ? ` (${apoios.length})` : ""}` },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setVer(o.v)}
                  className={`h-9 px-4 rounded-full text-xs border ${ver === o.v ? "bg-white/10 border-white/40 text-white" : "border-white/10 text-white/60"}`}
                >
                  {o.rot}
                </button>
              ))}
            </div>
            {ver === "marcacoes" && !!dados?.registros.length && (
              <button type="button" onClick={() => baixarCsv(dados.registros)} className="h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs">
                ⬇ Baixar planilha
              </button>
            )}
            {ver === "remanejamentos" && !!dados?.remanejamentos?.length && (
              <button type="button" onClick={() => baixarCsvRemanejamentos(dados.remanejamentos ?? [])} className="h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs">
                ⬇ Baixar planilha
              </button>
            )}
          </div>

          {!dados && !erro && <p className="text-sm text-white/50">Carregando...</p>}

          {dados && ver === "marcacoes" && (
            <>
              {dados.registros.length === 0 && <p className="text-sm text-white/50">Nenhuma marcação no período.</p>}
              {porDia.map(([d, lista]) => (
                <div key={d} className="mb-4">
                  <p className="text-[11px] uppercase tracking-wider text-white/45 mb-2" style={{ fontFamily: FONTES.mono }}>
                    {dataBr(d)}
                  </p>
                  {lista.map((x) => {
                    const c = corDoStatus(x.status);
                    return (
                      <div key={x.id} className="rounded-xl px-3 py-2 mb-2" style={{ background: c?.fundo ?? "rgba(255,255,255,0.03)", border: `1px solid ${c?.borda ?? CORES.borda}` }}>
                        <div className="flex items-start justify-between gap-2">
                          <span style={{ minWidth: 0 }}>
                            <span className="block text-sm text-white font-semibold break-words">{x.colaborador}</span>
                            <span className="block text-[11px] text-white/50">
                              {x.posto} · {ROTULO_AREA[x.area] ?? x.area} · {x.turno === "NOTURNO" ? "Noturno" : "Diurno"}
                            </span>
                          </span>
                          <span className="text-[11px] font-bold rounded-full px-2 py-0.5 shrink-0" style={{ color: c?.texto, border: `1px solid ${c?.borda}` }}>
                            {x.statusRotulo}
                          </span>
                        </div>
                        {(x.coberturaTipo || x.observacao) && (
                          <p className="text-xs text-white/75 m-0 mt-1">
                            {x.coberturaTipo && (
                              <>
                                Cobertura: {ROTULO_COBERTURA[x.coberturaTipo]}
                                {x.coberturaNome ? ` — ${x.coberturaNome}` : ""}
                                {x.coberturaValor != null ? ` (${moeda(x.coberturaValor)})` : ""}
                              </>
                            )}
                            {x.observacao && <span className="block text-white/55">Obs.: {x.observacao}</span>}
                          </p>
                        )}
                        <p className="text-[10px] text-white/35 m-0 mt-1">por {x.registradoPorNome}</p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {dados && ver === "remanejamentos" && (
            <>
              {!dados.remanejamentos?.length && <p className="text-sm text-white/50">Nenhum remanejamento no período.</p>}
              {dados.remanejamentos?.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl px-3 py-2 mb-2 border"
                  style={{ borderColor: m.desfeitoEm ? CORES.borda : "rgba(96,165,250,0.4)", background: m.desfeitoEm ? "rgba(255,255,255,0.02)" : "rgba(96,165,250,0.06)", opacity: m.desfeitoEm ? 0.6 : 1 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-white font-semibold break-words" style={{ minWidth: 0 }}>
                      🔀 {m.nome}
                      {m.matricula ? <span className="text-[11px] text-white/45 font-normal"> · Mat. {m.matricula}</span> : null}
                    </span>
                    <span className="text-[11px] text-white/60 shrink-0">a partir de {dataBr(m.inicio)}</span>
                  </div>
                  <p className="text-xs text-white/80 m-0 mt-1">
                    {m.postoOrigem} → <b>{m.postoDestino}</b>
                  </p>
                  <p className="text-[10px] text-white/45 m-0 mt-1">
                    Remanejado por {m.usuarioNome ?? "—"} em {dataHoraBr(m.criadoEm)}
                    {m.desfeitoEm ? ` · desfeito em ${dataHoraBr(m.desfeitoEm)}` : ""}
                  </p>
                </div>
              ))}
            </>
          )}

          {ver === "apoios" && (
            <>
              {apoios?.length === 0 && <p className="text-sm text-white/50">Nenhum apoio extra no período.</p>}
              {apoios?.map((a) => (
                <div key={a.id} className="rounded-xl px-3 py-2 mb-2 border" style={{ borderColor: "rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.06)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-white font-semibold break-words" style={{ minWidth: 0 }}>
                      ＋ {a.motivo}
                    </span>
                    <span className="text-[11px] text-white/60 shrink-0">{dataBr(a.data)}</span>
                  </div>
                  <p className="text-xs text-white/80 m-0 mt-1">
                    {ROTULO_COBERTURA[a.coberturaTipo] ?? a.coberturaTipo} — {a.coberturaNome}
                    {a.coberturaValor != null ? ` (${moeda(a.coberturaValor)})` : ""}
                  </p>
                  <p className="text-[10px] text-white/45 m-0 mt-1">
                    {a.posto} · {ROTULO_AREA[a.area] ?? a.area} · registrado por {a.registradoPorNome}
                    {a.observacao ? ` · ${a.observacao}` : ""}
                  </p>
                </div>
              ))}
            </>
          )}

          {dados && ver === "trocas" && (
            <>
              {dados.eventos.length === 0 && <p className="text-sm text-white/50">Nenhuma troca no período.</p>}
              {dados.eventos.map((e) => (
                <div key={e.id} className="rounded-xl px-3 py-2 mb-2 border border-white/10 bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-white/70">{ROTULO_EVENTO[e.tipo] ?? e.tipo}</span>
                    <span className="text-[11px] text-white/45">{dataBr(e.data)}</span>
                  </div>
                  <p className="text-sm text-white m-0 mt-1">{e.descricao}</p>
                  <p className="text-[10px] text-white/35 m-0 mt-1">
                    {e.posto}
                    {e.usuarioNome ? ` · por ${e.usuarioNome}` : ""}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
