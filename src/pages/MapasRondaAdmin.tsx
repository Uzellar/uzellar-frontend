import { useCallback, useEffect, useState } from "react";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { authHeaders } from "../lib/api";
import {
  BASE_MAPAS,
  LinhaKmDia,
  MapaRonda,
  Veiculo,
  apiMapas,
  dataCurta,
  dataHora,
  formatarKm,
  formatarPlaca,
  mensagemErro,
} from "../lib/mapaRonda";

// Controle dos mapas de ronda (só Administrador Master): KM por dia e
// supervisor, lista com detalhes (itens faltando, avarias, fotos,
// assinatura) e relatórios em PDF/Excel.

interface Resposta {
  mapas: MapaRonda[];
  limitado: boolean;
  resumo: { total: number; emAberto: number; kmTotal: number; comAvaria: number; comFaltaItens: number };
  porDia: LinhaKmDia[];
  supervisores: { id: string; nome: string }[];
}

const hojeBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const inicioDoMes = () => hojeBrasilia().slice(0, 8) + "01";

const campo = "h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#FF3B3B]/60";

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="m-0 text-[11px] text-white/50">{rotulo}</p>
      <p className={`m-0 mt-1 text-xl font-bold ${destaque ? "text-[#FF3B3B]" : "text-white"}`}>{valor}</p>
    </div>
  );
}

function Detalhe({ id }: { id: string }) {
  const [mapa, setMapa] = useState<MapaRonda | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    apiMapas<MapaRonda>(`/${id}`, {}, "Não foi possível abrir o mapa.").then(setMapa).catch((e) => setErro(e.message));
  }, [id]);
  if (erro) return <p className="text-xs text-red-400">{erro}</p>;
  if (!mapa) return <p className="text-xs text-white/50">Carregando...</p>;
  return (
    <div className="text-xs text-white/70 space-y-1.5 pt-2">
      <p className="m-0">
        Início {dataHora(mapa.iniciadoEm)} · Encerramento {dataHora(mapa.encerradoEm)}
      </p>
      <p className="m-0">
        Faltando itens: <span className="text-white">{mapa.faltandoItens ? `Sim — ${mapa.itensFaltantes}` : "Não"}</span>
      </p>
      <p className="m-0">
        Avaria nova: <span className="text-white">{mapa.avariaNova ? `Sim — ${mapa.avariaDescricao}` : "Não"}</span>
      </p>
      {mapa.observacao && (
        <p className="m-0">
          Observação: <span className="text-white">{mapa.observacao}</span>
        </p>
      )}
      {mapa.fotosLinks && mapa.fotosLinks.length > 0 && (
        <div className="flex gap-2 flex-wrap pt-1">
          {mapa.fotosLinks.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`Avaria ${i + 1}`} className="w-24 h-24 object-cover rounded-lg" />
            </a>
          ))}
        </div>
      )}
      {mapa.assinaturaLink && (
        <div className="pt-1">
          <p className="m-0 text-white/40">Assinatura</p>
          <img src={mapa.assinaturaLink} alt="Assinatura" className="h-16 rounded bg-white mt-1" />
        </div>
      )}
    </div>
  );
}

export default function MapasRondaAdmin() {
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hojeBrasilia());
  const [supervisorId, setSupervisorId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [situacao, setSituacao] = useState("");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  // Só manda os filtros preenchidos (campo vazio é rejeitado pelo servidor).
  const parametros = useCallback(() => {
    const p = new URLSearchParams();
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    if (supervisorId) p.set("supervisorId", supervisorId);
    if (veiculoId) p.set("veiculoId", veiculoId);
    if (situacao) p.set("situacao", situacao);
    return p.toString();
  }, [de, ate, supervisorId, veiculoId, situacao]);

  useEffect(() => {
    apiMapas<Veiculo[]>("/veiculos/gerenciar").then(setVeiculos).catch(() => setVeiculos([]));
  }, []);

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro(null);
    apiMapas<Resposta>(`?${parametros()}`, {}, "Não foi possível carregar os mapas.")
      .then((r) => ativo && setDados(r))
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [parametros]);

  const baixar = async (formato: "pdf" | "excel") => {
    setBaixando(formato);
    setErro(null);
    try {
      const r = await fetch(`${BASE_MAPAS}/relatorio/${formato}?${parametros()}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(await mensagemErro(r, "Não foi possível gerar o relatório."));
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `mapa-de-ronda-${de || "inicio"}-a-${ate || "hoje"}.${formato === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBaixando(null);
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }} className="space-y-4">
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Controle de mapas de ronda</p>
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>KM rodado por supervisor e veículo, itens faltando e avarias.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 grid gap-3 grid-cols-2 md:grid-cols-5">
            <label className="text-xs text-white/50 flex flex-col gap-1">
              De
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={campo} />
            </label>
            <label className="text-xs text-white/50 flex flex-col gap-1">
              Até
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={campo} />
            </label>
            <label className="text-xs text-white/50 flex flex-col gap-1">
              Supervisor
              <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={campo}>
                <option value="">Todos</option>
                {(dados?.supervisores ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/50 flex flex-col gap-1">
              Veículo
              <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={campo}>
                <option value="">Todos</option>
                {veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.modelo} — {formatarPlaca(v.placa)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/50 flex flex-col gap-1">
              Situação
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={campo}>
                <option value="">Todos</option>
                <option value="abertos">Em aberto</option>
                <option value="encerrados">Encerrados</option>
              </select>
            </label>
            <div className="col-span-2 md:col-span-5 flex gap-2 flex-wrap">
              <button type="button" onClick={() => baixar("pdf")} disabled={!!baixando} className="h-10 px-5 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-40">
                {baixando === "pdf" ? "Gerando..." : "Baixar PDF"}
              </button>
              <button type="button" onClick={() => baixar("excel")} disabled={!!baixando} className="h-10 px-5 rounded-full border border-white/15 text-white text-sm font-semibold disabled:opacity-40">
                {baixando === "excel" ? "Gerando..." : "Baixar Excel"}
              </button>
            </div>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}
          {!erro && !dados && <p className="text-sm text-white/50">Carregando...</p>}

          {dados && (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                <Cartao rotulo="Mapas" valor={String(dados.resumo.total)} />
                <Cartao rotulo="KM percorridos" valor={formatarKm(dados.resumo.kmTotal)} />
                <Cartao rotulo="Em aberto" valor={String(dados.resumo.emAberto)} />
                <Cartao rotulo="Com avaria nova" valor={String(dados.resumo.comAvaria)} destaque={dados.resumo.comAvaria > 0} />
                <Cartao rotulo="Com itens faltando" valor={String(dados.resumo.comFaltaItens)} destaque={dados.resumo.comFaltaItens > 0} />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-x-auto">
                <p className="text-sm font-bold text-white mt-0 mb-2">KM por dia e supervisor</p>
                {dados.porDia.length === 0 ? (
                  <p className="text-xs text-white/50 m-0">Nenhum mapa no período.</p>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="text-white/40">
                      <tr>
                        <th className="py-1.5 pr-3 font-medium">Data</th>
                        <th className="py-1.5 pr-3 font-medium">Supervisor</th>
                        <th className="py-1.5 pr-3 font-medium">Veículo(s)</th>
                        <th className="py-1.5 pr-3 font-medium">Mapas</th>
                        <th className="py-1.5 font-medium text-right">KM do dia</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/80">
                      {dados.porDia.map((l) => (
                        <tr key={`${l.data}-${l.supervisorId}`} className="border-t border-white/5">
                          <td className="py-1.5 pr-3 whitespace-nowrap">{dataCurta(l.data)}</td>
                          <td className="py-1.5 pr-3">{l.supervisorNome}</td>
                          <td className="py-1.5 pr-3">{l.placas.map(formatarPlaca).join(", ")}</td>
                          <td className="py-1.5 pr-3">
                            {l.mapas}
                            {l.emAberto ? <span className="text-amber-400"> ({l.emAberto} aberto)</span> : null}
                          </td>
                          <td className="py-1.5 text-right font-semibold text-white">{formatarKm(l.km)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-bold text-white mt-0 mb-1">Mapas</p>
                {dados.limitado && <p className="text-xs text-amber-400 m-0 mb-1">Mostrando os 500 mais recentes — use os filtros para ver os demais.</p>}
                {dados.mapas.length === 0 && <p className="text-xs text-white/50 m-0">Nenhum mapa no período.</p>}
                {dados.mapas.map((m) => (
                  <div key={m.id} className="border-t border-white/5 py-2.5">
                    <button type="button" onClick={() => setAberto(aberto === m.id ? null : m.id)} className="w-full text-left flex flex-wrap gap-x-4 gap-y-1 items-center justify-between">
                      <span className="min-w-0">
                        <span className="block text-sm text-white font-semibold">
                          {m.supervisorNome} <span className="text-white/50 font-normal">· {dataHora(m.iniciadoEm)}</span>
                        </span>
                        <span className="block text-xs text-white/50">
                          {m.veiculoModelo} {formatarPlaca(m.veiculoPlaca)} · KM {formatarKm(m.kmInicial)} → {m.encerradoEm ? formatarKm(m.kmFinal) : "…"}
                          {m.faltandoItens && <span className="text-amber-400"> · faltando itens</span>}
                          {m.avariaNova && <span className="text-[#FF3B3B]"> · avaria nova{m.qtdFotos ? ` (${m.qtdFotos} foto${m.qtdFotos > 1 ? "s" : ""})` : ""}</span>}
                        </span>
                      </span>
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {m.encerradoEm ? <span className="text-white">{formatarKm(m.km)} km</span> : <span className="text-emerald-400">em aberto</span>}
                        <span className="text-white/40 ml-2">{aberto === m.id ? "▴" : "▾"}</span>
                      </span>
                    </button>
                    {aberto === m.id && <Detalhe id={m.id} />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
