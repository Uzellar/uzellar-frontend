import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { normalizarBusca } from "../components/SeletorCondominio";
import {
  ABAS,
  CORES_STATUS,
  REGRAS,
  ROTULO_AREA,
  ROTULO_COBERTURA,
  ROTULO_STATUS,
  apiPostos,
  corDoStatus,
  dataBr,
  dataHoraBr,
  diaDaSemana,
  hojeBrasilia,
  moeda,
  rotuloRegra,
  somarDias,
} from "../lib/postos";
import type { Aba, ApoioExtra, FtOpcao, LinhaColaborador, PostoResumo, ReservaOpcao, Status, TipoCobertura } from "../lib/postos";
import { ativarPush, estadoPush } from "../lib/anotacoes";
import { ehAdminMaster } from "../lib/api";
import type { EstadoPush } from "../lib/anotacoes";

// Confirmação de posto operacional (11/2026). O supervisor escolhe a aba
// (Diurno, Limpeza ou Noturno), o posto e confirma cada colaborador do
// plantão: verde = confirmado; vermelho = falta, recolhimento ou posto vago.

const CHAVE_ABA = "uzellar_posto_aba";

function lerAba(): Aba {
  try {
    const v = localStorage.getItem(CHAVE_ABA);
    if (v === "DIURNO" || v === "LIMPEZA" || v === "NOTURNO") return v;
  } catch {
    // sem armazenamento
  }
  return "DIURNO";
}

const estiloCampo = "w-full h-11 rounded-lg bg-white/5 border border-white/15 px-3 text-sm text-white outline-none focus:border-white/40";

// ---------------- janela (modal) ----------------

function Janela({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  return (
    <div
      onClick={onFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="uz-estoque"
        style={{
          background: CORES.superficie2,
          border: `1px solid ${CORES.borda}`,
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 18,
          marginBottom: "env(safe-area-inset-bottom, 0px)",
          alignSelf: "center",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-white font-bold m-0" style={{ fontSize: 17, fontFamily: FONTES.titulo }}>
            {titulo}
          </p>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="text-white/60 text-xl leading-none px-2">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-xs text-white/60 mt-3 mb-1">{children}</p>;
}

// ---------------- aviso de notificações ----------------

// Avisos de posto sem confirmação (15 min depois do horário) chegam por
// notificação no celular. Some quando as notificações já estão ativas.
function AvisoNotificacoes() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    estadoPush().then(setEstado).catch(() => setEstado(null));
  }, []);

  if (estado === null || estado === "ativado") return null;

  const ativar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      await ativarPush();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
      estadoPush().then(setEstado).catch(() => undefined);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-3">
      <p className="text-sm font-bold text-white m-0">🔔 Avisos de posto sem confirmação</p>
      <p className="text-xs text-white/60 mt-1 mb-0">
        Ative as notificações neste aparelho para ser avisado quando um posto seu não for confirmado até 15 minutos depois do horário.
      </p>
      {estado === "bloqueado" && (
        <p className="text-xs text-amber-300 mt-2 mb-0">Bloqueadas neste navegador. Libere as notificações do Uzellar nas configurações do celular/navegador e volte aqui.</p>
      )}
      {estado === "instalar-iphone" && (
        <p className="text-xs text-amber-300 mt-2 mb-0">
          No iPhone, as notificações só funcionam com o Uzellar instalado: no Safari, toque em Compartilhar → “Adicionar à Tela de Início” e abra o Uzellar pelo ícone.
        </p>
      )}
      {estado === "sem-suporte" && <p className="text-xs text-amber-300 mt-2 mb-0">Este navegador não recebe notificações. Use o Chrome (Android/computador) ou o app instalado no iPhone.</p>}
      {estado === "desativado" && (
        <button type="button" disabled={ocupado} onClick={ativar} className="h-9 px-4 mt-2 rounded-lg bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-40">
          {ocupado ? "Ativando..." : "Ativar notificações"}
        </button>
      )}
      {erro && <p className="text-xs text-red-400 mt-2 mb-0">{erro}</p>}
    </div>
  );
}

// ---------------- cobertura (falta / posto vago) ----------------

function EscolhaCobertura({
  data,
  postoId,
  faltouId,
  tipo,
  setTipo,
  reservaId,
  setReservaId,
  ftId,
  ftRotulo,
  setFt,
  nomeFree,
  setNomeFree,
  valorFree,
  setValorFree,
  outros,
  setOutros,
  tipos,
  titulo = "Quem cobriu?",
}: {
  tipos?: TipoCobertura[];
  titulo?: string;
  data: string;
  postoId: string;
  faltouId: string;
  tipo: TipoCobertura | null;
  setTipo: (t: TipoCobertura) => void;
  reservaId: string | null;
  setReservaId: (id: string) => void;
  ftId: string | null;
  ftRotulo: string;
  setFt: (id: string, rotulo: string) => void;
  nomeFree: string;
  setNomeFree: (v: string) => void;
  valorFree: string;
  setValorFree: (v: string) => void;
  outros: string;
  setOutros: (v: string) => void;
}) {
  const [reservas, setReservas] = useState<ReservaOpcao[] | null>(null);
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<{ nome: string; vezes: number }[]>([]);
  const [buscaFt, setBuscaFt] = useState("");
  const [listaFt, setListaFt] = useState<FtOpcao[] | null>(null);

  // FT: colegas do mesmo posto primeiro; pesquisa em todos os postos (inclusive Reserva Técnica).
  useEffect(() => {
    if (tipo !== "FT") return;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ data, postoId });
      if (buscaFt.trim()) q.set("q", buscaFt.trim());
      apiPostos<FtOpcao[]>(`/ft?${q.toString()}`)
        .then((l) => setListaFt(l.filter((x) => x.id !== faltouId)))
        .catch(() => setListaFt([]));
    }, 250);
    return () => clearTimeout(t);
  }, [tipo, buscaFt, data, postoId, faltouId]);

  useEffect(() => {
    if (tipo !== "RESERVA" || reservas) return;
    apiPostos<ReservaOpcao[]>(`/reserva?data=${data}`)
      .then(setReservas)
      .catch(() => setReservas([]));
  }, [tipo, reservas, data]);

  useEffect(() => {
    if (tipo !== "FREELANCER") return;
    const t = setTimeout(() => {
      apiPostos<{ nome: string; vezes: number }[]>(`/freelancers?q=${encodeURIComponent(nomeFree.trim())}`)
        .then(setSugestoes)
        .catch(() => setSugestoes([]));
    }, 250);
    return () => clearTimeout(t);
  }, [tipo, nomeFree]);

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    return (reservas ?? []).filter((r) => !termo || normalizarBusca(r.nome).includes(termo));
  }, [reservas, busca]);

  const opcoes: { valor: TipoCobertura; rotulo: string }[] = [
    { valor: "RESERVA" as TipoCobertura, rotulo: "Reserva Técnica" },
    { valor: "FT" as TipoCobertura, rotulo: "FT" },
    { valor: "FREELANCER" as TipoCobertura, rotulo: "Freelancer" },
    { valor: "OUTROS" as TipoCobertura, rotulo: "Outros" },
  ].filter((o) => !tipos || tipos.includes(o.valor));

  return (
    <>
      <Rotulo>{titulo}</Rotulo>
      <div className={`grid grid-cols-2 ${opcoes.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"} gap-2`}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => setTipo(o.valor)}
            className={`h-11 rounded-lg text-xs font-semibold border ${tipo === o.valor ? "bg-white/15 border-white/50 text-white" : "border-white/15 text-white/70"}`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      {tipo === "RESERVA" && (
        <div className="mt-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar na Reserva Técnica" className={estiloCampo} />
          <div className="mt-2 rounded-lg border border-white/10" style={{ maxHeight: 240, overflowY: "auto" }}>
            {reservas === null && <p className="text-xs text-white/50 p-3 m-0">Carregando...</p>}
            {reservas?.length === 0 && <p className="text-xs text-white/50 p-3 m-0">Ninguém na Reserva Técnica neste dia.</p>}
            {filtradas.map((r) => {
              const escolhido = r.id === reservaId;
              const ocupado = !!r.cobrindo && !escolhido;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => setReservaId(r.id)}
                  className={`w-full text-left px-3 py-2 border-b border-white/5 ${escolhido ? "bg-emerald-500/15" : ""} ${ocupado ? "opacity-40" : ""}`}
                >
                  <span className="block text-sm text-white">
                    {escolhido ? "✓ " : ""}
                    {r.nome}
                  </span>
                  <span className="block text-[11px] text-white/50">
                    {ROTULO_AREA[r.area] ?? r.area} · {r.turno === "NOTURNO" ? "Noturno" : "Diurno"}
                    {r.horario ? ` · ${r.horario}` : ""}
                    {r.cobrindo ? ` · já cobrindo ${r.cobrindo}` : r.plantao === false ? " · de folga pela escala" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tipo === "FT" && (
        <div className="mt-3">
          <p className="text-[11px] text-white/50 m-0 mb-2">FT (folga trabalhada): colaborador deste posto, de outro posto ou da Reserva Técnica de outro plantão.</p>
          {ftId && (
            <div className="rounded-lg border px-3 py-2 mb-2 text-sm text-white" style={{ borderColor: "rgba(52,211,153,0.5)", background: "rgba(52,211,153,0.10)" }}>
              ✓ {ftRotulo}
            </div>
          )}
          <input value={buscaFt} onChange={(e) => setBuscaFt(e.target.value)} placeholder="Pesquisar colaborador ou posto" className={estiloCampo} />
          <div className="mt-2 rounded-lg border border-white/10" style={{ maxHeight: 260, overflowY: "auto" }}>
            {listaFt === null && <p className="text-xs text-white/50 p-3 m-0">Carregando...</p>}
            {listaFt?.length === 0 && <p className="text-xs text-white/50 p-3 m-0">Ninguém encontrado.</p>}
            {listaFt?.map((c) => {
              const escolhido = c.id === ftId;
              const ocupado = !!c.cobrindo && !escolhido;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={ocupado}
                  onClick={() => setFt(c.id, `${c.nome} (${c.posto})`)}
                  className={`w-full text-left px-3 py-2 border-b border-white/5 ${escolhido ? "bg-emerald-500/15" : ""} ${ocupado ? "opacity-40" : ""}`}
                >
                  <span className="block text-sm text-white">
                    {escolhido ? "✓ " : ""}
                    {c.nome}
                    {c.mesmoPosto && <span className="text-[10px] text-emerald-300 ml-2">mesmo posto</span>}
                  </span>
                  <span className="block text-[11px] text-white/50">
                    {c.posto} · {ROTULO_AREA[c.area] ?? c.area} · {c.turno === "NOTURNO" ? "Noturno" : "Diurno"}
                    {c.horario ? ` · ${c.horario}` : ""}
                    {c.cobrindo
                      ? ` · já cobrindo ${c.cobrindo}`
                      : c.situacao
                        ? ` · ${c.situacao} neste dia`
                        : c.plantao === false
                          ? " · de folga pela escala"
                          : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tipo === "OUTROS" && (
        <div className="mt-3">
          <Rotulo>Descreva quem cobriu</Rotulo>
          <input value={outros} onChange={(e) => setOutros(e.target.value)} placeholder="Ex.: zelador do condomínio dobrou o turno" className={estiloCampo} maxLength={120} />
        </div>
      )}

      {tipo === "FREELANCER" && (
        <div className="mt-3">
          <input value={nomeFree} onChange={(e) => setNomeFree(e.target.value)} placeholder="Nome do freelancer" className={estiloCampo} maxLength={120} />
          {sugestoes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {sugestoes
                .filter((s) => normalizarBusca(s.nome) !== normalizarBusca(nomeFree))
                .slice(0, 6)
                .map((s) => (
                  <button key={s.nome} type="button" onClick={() => setNomeFree(s.nome)} className="h-8 px-3 rounded-full border border-white/15 text-xs text-white/80">
                    {s.nome}
                  </button>
                ))}
            </div>
          )}
          {ehAdminMaster() && (
            <>
              <Rotulo>Valor da diária (opcional)</Rotulo>
              <input
                value={valorFree}
                onChange={(e) => setValorFree(e.target.value.replace(/[^\d,.]/g, ""))}
                placeholder="Ex.: 150,00"
                inputMode="decimal"
                className={estiloCampo}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function lerValor(texto: string): number | undefined | null {
  const t = texto.trim();
  if (!t) return undefined;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function JanelaCobertura({
  linha,
  postoId,
  data,
  status,
  onFechar,
  onSalvo,
}: {
  linha: LinhaColaborador;
  postoId: string;
  data: string;
  status: "FALTA" | "VAGO";
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const r = linha.registro && linha.registro.status === status ? linha.registro : null;
  // "Sem cobertura" (registros antigos) não é mais opção: pede para escolher de novo.
  const [tipo, setTipo] = useState<TipoCobertura | null>(r?.coberturaTipo && r.coberturaTipo !== "SEM_COBERTURA" ? r.coberturaTipo : null);
  const [reservaId, setReservaId] = useState<string | null>(r?.coberturaTipo === "RESERVA" ? r.coberturaColaboradorId : null);
  const [ftId, setFtId] = useState<string | null>(r?.coberturaTipo === "FT" ? r.coberturaColaboradorId : null);
  const [ftRotulo, setFtRotulo] = useState(r?.coberturaTipo === "FT" ? r.coberturaNome ?? "" : "");
  const [outros, setOutros] = useState(r?.coberturaTipo === "OUTROS" ? r.coberturaNome ?? "" : "");
  const [nomeFree, setNomeFree] = useState(r?.coberturaTipo === "FREELANCER" ? r.coberturaNome ?? "" : "");
  const [valorFree, setValorFree] = useState(r?.coberturaValor != null ? String(r.coberturaValor).replace(".", ",") : "");
  const [obs, setObs] = useState(r?.observacao ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (!tipo) return setErro("Escolha quem cobriu.");
    if (tipo === "RESERVA" && !reservaId) return setErro("Escolha a pessoa da Reserva Técnica.");
    if (tipo === "FT" && !ftId) return setErro("Escolha o colaborador que fez a FT.");
    if (tipo === "OUTROS" && !outros.trim()) return setErro("Descreva quem cobriu.");
    if (tipo === "FREELANCER" && !nomeFree.trim()) return setErro("Informe o nome do freelancer.");
    const valor = tipo === "FREELANCER" && ehAdminMaster() ? lerValor(valorFree) : undefined;
    if (valor === null) return setErro("Valor da diária inválido.");
    setSalvando(true);
    try {
      await apiPostos("/registros", {
        method: "POST",
        body: JSON.stringify({
          colaboradorId: linha.id,
          data,
          status,
          coberturaTipo: tipo,
          ...(tipo === "RESERVA" ? { coberturaColaboradorId: reservaId } : {}),
          ...(tipo === "FT" ? { coberturaColaboradorId: ftId } : {}),
          ...(tipo === "OUTROS" ? { coberturaNome: outros.trim() } : {}),
          ...(tipo === "FREELANCER" ? { coberturaNome: nomeFree.trim(), ...(valor !== undefined ? { coberturaValor: valor } : {}) } : {}),
          ...(obs.trim() ? { observacao: obs.trim() } : {}),
        }),
      });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <Janela titulo={status === "FALTA" ? `Falta — ${linha.nome}` : `Posto vago — ${dataBr(data)}`} onFechar={onFechar}>
      <p className="text-xs text-white/60 m-0">
        {status === "FALTA"
          ? `${dataBr(data)} · ${ROTULO_AREA[linha.area] ?? linha.area}${linha.horario ? ` · ${linha.horario}` : ""}`
          : linha.substituiNome
            ? `No lugar de ${linha.substituiNome}.`
            : "Registre quem cobriu o posto neste dia."}
      </p>
      <EscolhaCobertura
        data={data}
        postoId={postoId}
        faltouId={linha.id}
        tipo={tipo}
        setTipo={setTipo}
        reservaId={reservaId}
        setReservaId={setReservaId}
        ftId={ftId}
        ftRotulo={ftRotulo}
        setFt={(id, rotulo) => {
          setFtId(id);
          setFtRotulo(rotulo);
        }}
        outros={outros}
        setOutros={setOutros}
        nomeFree={nomeFree}
        setNomeFree={setNomeFree}
        valorFree={valorFree}
        setValorFree={setValorFree}
      />
      <Rotulo>Observação (opcional)</Rotulo>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} className={`${estiloCampo} h-auto py-2`} />
      {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
      <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : status === "FALTA" ? "Registrar falta" : "Registrar cobertura"}
      </button>
    </Janela>
  );
}

// ---------------- apoio extra por evento ----------------

const AREAS_DA_ABA: Record<string, string[]> = { DIURNO: ["PORTARIA", "ZELADORIA"], LIMPEZA: ["LIMPEZA"], NOTURNO: ["PORTARIA"] };

function JanelaApoio({ postoId, postoNome, data, aba, onFechar, onSalvo }: { postoId: string; postoNome: string; data: string; aba: Aba; onFechar: () => void; onSalvo: () => void }) {
  const areas = AREAS_DA_ABA[aba] ?? [];
  const [area, setArea] = useState(areas[0] ?? "");
  const [motivo, setMotivo] = useState("");
  const [tipo, setTipo] = useState<TipoCobertura | null>(null);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [ftId, setFtId] = useState<string | null>(null);
  const [ftRotulo, setFtRotulo] = useState("");
  const [outros, setOutros] = useState("");
  const [nomeFree, setNomeFree] = useState("");
  const [valorFree, setValorFree] = useState("");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (!motivo.trim()) return setErro("Informe o evento/motivo do apoio.");
    if (!tipo) return setErro("Escolha quem apoiou.");
    if (tipo === "RESERVA" && !reservaId) return setErro("Escolha a pessoa da Reserva Técnica.");
    if (tipo === "FT" && !ftId) return setErro("Escolha o colaborador que fez a FT.");
    if (tipo === "FREELANCER" && !nomeFree.trim()) return setErro("Informe o nome do freelancer.");
    const valor = tipo === "FREELANCER" && ehAdminMaster() ? lerValor(valorFree) : undefined;
    if (valor === null) return setErro("Valor da diária inválido.");
    setSalvando(true);
    try {
      await apiPostos("/apoios", {
        method: "POST",
        body: JSON.stringify({
          postoId,
          data,
          aba,
          area,
          motivo: motivo.trim(),
          coberturaTipo: tipo,
          ...(tipo === "RESERVA" ? { coberturaColaboradorId: reservaId } : {}),
          ...(tipo === "FT" ? { coberturaColaboradorId: ftId } : {}),
          ...(tipo === "FREELANCER" ? { coberturaNome: nomeFree.trim(), ...(valor !== undefined ? { coberturaValor: valor } : {}) } : {}),
          ...(obs.trim() ? { observacao: obs.trim() } : {}),
        }),
      });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <Janela titulo="Apoio extra (evento)" onFechar={onFechar}>
      <p className="text-xs text-white/60 m-0">
        {postoNome} · {dataBr(data)}. Reforço que não cobre ninguém — festa, mudança, evento.
      </p>
      {areas.length > 1 && (
        <>
          <Rotulo>Área</Rotulo>
          <div className="grid grid-cols-2 gap-2">
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className={`h-10 rounded-lg text-xs font-semibold border ${area === a ? "bg-white/15 border-white/50 text-white" : "border-white/15 text-white/70"}`}
              >
                {ROTULO_AREA[a] ?? a}
              </button>
            ))}
          </div>
        </>
      )}
      <Rotulo>Evento / motivo</Rotulo>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Festa das crianças" className={estiloCampo} maxLength={200} />
      <EscolhaCobertura
        tipos={["RESERVA", "FT", "FREELANCER"]}
        titulo="Quem apoiou?"
        data={data}
        postoId={postoId}
        faltouId=""
        tipo={tipo}
        setTipo={setTipo}
        reservaId={reservaId}
        setReservaId={setReservaId}
        ftId={ftId}
        ftRotulo={ftRotulo}
        setFt={(id, rotulo) => {
          setFtId(id);
          setFtRotulo(rotulo);
        }}
        outros={outros}
        setOutros={setOutros}
        nomeFree={nomeFree}
        setNomeFree={setNomeFree}
        valorFree={valorFree}
        setValorFree={setValorFree}
      />
      <Rotulo>Observação (opcional)</Rotulo>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} className={`${estiloCampo} h-auto py-2`} />
      {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
      <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : "Registrar apoio"}
      </button>
    </Janela>
  );
}

const ROTULO_APOIO: Record<string, string> = { RESERVA: "Reserva Técnica", FT: "FT", FREELANCER: "Freelancer" };

// Apoios extras do posto no dia (na aba aberta).
function SecaoApoios({ postoId, data, aba, podeMarcar, versao, onNovo }: { postoId: string; data: string; aba: Aba; podeMarcar: boolean; versao: number; onNovo: () => void }) {
  const [lista, setLista] = useState<ApoioExtra[] | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    apiPostos<ApoioExtra[]>(`/apoios?postoId=${postoId}&data=${data}&aba=${aba}`)
      .then((l) => {
        setLista(l);
        setErro(null);
      })
      .catch((e) => setErro((e as Error).message));
  }, [postoId, data, aba]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const remover = async (id: string) => {
    try {
      await apiPostos(`/apoios/${id}`, { method: "DELETE" }, "Não foi possível excluir o apoio.");
      setExcluir(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-wider text-white/45 mb-2" style={{ fontFamily: FONTES.mono }}>
        Apoio extra (evento)
      </p>
      {lista?.map((a) => (
        <div key={a.id} className="rounded-xl border px-3 py-2 mb-2" style={{ borderColor: "rgba(96,165,250,0.4)", background: "rgba(96,165,250,0.07)" }}>
          <div className="flex items-start justify-between gap-2">
            <span>
              <span className="block text-sm text-white font-semibold">{a.motivo}</span>
              <span className="block text-xs text-white/70">
                {ROTULO_APOIO[a.coberturaTipo] ?? a.coberturaTipo} — {a.coberturaNome}
                {a.coberturaValor != null ? ` (${moeda(a.coberturaValor)})` : ""}
              </span>
              <span className="block text-[11px] text-white/45">
                {ROTULO_AREA[a.area] ?? a.area} · registrado por {a.registradoPorNome}
                {a.observacao ? ` · ${a.observacao}` : ""}
              </span>
            </span>
            {podeMarcar &&
              (excluir === a.id ? (
                <span className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => remover(a.id)} className="text-[11px] text-red-300 underline">
                    Confirmar exclusão
                  </button>
                  <button type="button" onClick={() => setExcluir(null)} className="text-[11px] text-white/50 underline">
                    Cancelar
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setExcluir(a.id)} className="text-[11px] text-white/50 underline shrink-0">
                  Excluir
                </button>
              ))}
          </div>
        </div>
      ))}
      {lista?.length === 0 && <p className="text-xs text-white/40 mt-0 mb-2">Nenhum apoio extra neste dia.</p>}
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {podeMarcar && (
        <button type="button" onClick={onNovo} className="w-full h-11 rounded-xl border border-dashed text-sm" style={{ borderColor: "rgba(96,165,250,0.5)", color: "#93c5fd" }}>
          ＋ Apoio extra (evento)
        </button>
      )}
    </div>
  );
}

// ---------------- nova pessoa (com sugestão da Reserva Técnica) ----------------

interface PessoaReserva {
  id: string;
  nome: string;
  matricula: string | null;
}

function CampoNovaPessoa({
  data,
  inicio,
  nome,
  setNome,
  reserva,
  setReserva,
  placeholder,
}: {
  data: string;
  inicio: string;
  nome: string;
  setNome: (v: string) => void;
  reserva: PessoaReserva | null;
  setReserva: (r: PessoaReserva | null) => void;
  placeholder: string;
}) {
  const [lista, setLista] = useState<ReservaOpcao[] | null>(null);
  useEffect(() => {
    apiPostos<ReservaOpcao[]>(`/reserva?data=${data}`)
      .then(setLista)
      .catch(() => setLista([]));
  }, [data]);

  const sugestoes = useMemo(() => {
    const termo = normalizarBusca(nome);
    if (reserva || termo.length < 2) return [];
    return (lista ?? []).filter((r) => normalizarBusca(r.nome).includes(termo)).slice(0, 6);
  }, [lista, nome, reserva]);

  if (reserva) {
    return (
      <div className="rounded-lg border px-3 py-2" style={{ borderColor: "rgba(96,165,250,0.5)", background: "rgba(96,165,250,0.10)" }}>
        <div className="flex items-start justify-between gap-2">
          <span>
            <span className="block text-sm text-white font-semibold">{reserva.nome}</span>
            <span className="block text-[11px] text-white/60">
              Da Reserva Técnica{reserva.matricula ? ` · Mat. ${reserva.matricula}` : ""} · sai da reserva em {dataBr(inicio)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setReserva(null);
              setNome("");
            }}
            className="text-[11px] text-white/60 underline shrink-0"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={placeholder} className={estiloCampo} maxLength={120} />
      {sugestoes.length > 0 && (
        <div className="mt-1 rounded-lg border border-white/10 overflow-hidden">
          <p className="text-[10px] uppercase tracking-wider text-white/40 m-0 px-3 pt-2" style={{ fontFamily: FONTES.mono }}>
            Reserva Técnica
          </p>
          {sugestoes.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setReserva({ id: r.id, nome: r.nome, matricula: r.matricula ?? null });
                setNome(r.nome);
              }}
              className="w-full text-left px-3 py-2 border-b border-white/5"
            >
              <span className="block text-sm text-white">{r.nome}</span>
              <span className="block text-[11px] text-white/50">
                {ROTULO_AREA[r.area] ?? r.area} · {r.turno === "NOTURNO" ? "Noturno" : "Diurno"}
                {r.horario ? ` · ${r.horario}` : ""}
                {r.cobrindo ? ` · cobrindo ${r.cobrindo}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {nome.trim().length >= 2 && lista !== null && sugestoes.length === 0 && (
        <p className="text-[11px] text-white/40 mt-1 mb-0">Ninguém da Reserva Técnica com esse nome: será incluída uma pessoa nova.</p>
      )}
    </>
  );
}

// ---------------- recolhimento ----------------

function JanelaRecolhimento({
  linha,
  postoId,
  data,
  onFechar,
  onSalvo,
}: {
  linha: LinhaColaborador;
  postoId: string;
  data: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  // Cobertura do dia do recolhimento (opcional): mesmas opções da falta.
  const [tipo, setTipo] = useState<TipoCobertura | null>(null);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [ftId, setFtId] = useState<string | null>(null);
  const [ftRotulo, setFtRotulo] = useState("");
  const [outros, setOutros] = useState("");
  const [nomeFree, setNomeFree] = useState("");
  const [valorFree, setValorFree] = useState("");
  const [nome, setNome] = useState("");
  const [reserva, setReserva] = useState<PessoaReserva | null>(null);
  const [matricula, setMatricula] = useState("");
  const [inicio, setInicio] = useState(somarDias(data, 1));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (!inicio || inicio <= data) return setErro("A nova pessoa começa depois do dia do recolhimento.");
    if (tipo === "RESERVA" && !reservaId) return setErro("Escolha a pessoa da Reserva Técnica.");
    if (tipo === "FT" && !ftId) return setErro("Escolha o colaborador que fez a FT.");
    if (tipo === "OUTROS" && !outros.trim()) return setErro("Descreva quem cobriu.");
    if (tipo === "FREELANCER" && !nomeFree.trim()) return setErro("Informe o nome do freelancer.");
    const valor = tipo === "FREELANCER" && ehAdminMaster() ? lerValor(valorFree) : undefined;
    if (valor === null) return setErro("Valor da diária inválido.");
    setSalvando(true);
    try {
      await apiPostos("/registros", {
        method: "POST",
        body: JSON.stringify({
          colaboradorId: linha.id,
          data,
          status: "RECOLHIMENTO",
          ...(tipo ? { coberturaTipo: tipo } : {}),
          ...(tipo === "RESERVA" ? { coberturaColaboradorId: reservaId } : {}),
          ...(tipo === "FT" ? { coberturaColaboradorId: ftId } : {}),
          ...(tipo === "OUTROS" ? { coberturaNome: outros.trim() } : {}),
          ...(tipo === "FREELANCER" ? { coberturaNome: nomeFree.trim(), ...(valor !== undefined ? { coberturaValor: valor } : {}) } : {}),
          novoInicio: inicio,
          ...(reserva ? { novoReservaId: reserva.id } : {}),
          ...(!reserva && nome.trim() ? { novoNome: nome.trim() } : {}),
          ...(!reserva && nome.trim() && matricula.trim() ? { novoMatricula: matricula.trim() } : {}),
          ...(motivo.trim() ? { observacao: motivo.trim() } : {}),
        }),
      });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <Janela titulo={`Recolhimento — ${linha.nome}`} onFechar={onFechar}>
      <p className="text-xs text-white/60 m-0">
        {linha.nome} sai do posto. O último dia dele(a) é {dataBr(data)}. A nova pessoa assume com a mesma escala e o mesmo horário.
      </p>
      <p className="text-[11px] text-white/50 mt-2 mb-0">Se alguém cobriu o posto em {dataBr(data)}, registre abaixo (opcional).</p>
      <EscolhaCobertura
        data={data}
        postoId={postoId}
        faltouId={linha.id}
        tipo={tipo}
        setTipo={setTipo}
        reservaId={reservaId}
        setReservaId={setReservaId}
        ftId={ftId}
        ftRotulo={ftRotulo}
        setFt={(id, rotulo) => {
          setFtId(id);
          setFtRotulo(rotulo);
        }}
        outros={outros}
        setOutros={setOutros}
        nomeFree={nomeFree}
        setNomeFree={setNomeFree}
        valorFree={valorFree}
        setValorFree={setValorFree}
      />
      {tipo && (
        <button type="button" onClick={() => setTipo(null)} className="text-[11px] text-white/60 underline mt-2">
          Ninguém cobriu (limpar)
        </button>
      )}
      <Rotulo>Nova pessoa no posto</Rotulo>
      <CampoNovaPessoa
        data={data}
        inicio={inicio}
        nome={nome}
        setNome={setNome}
        reserva={reserva}
        setReserva={setReserva}
        placeholder="Digite o nome (deixe vazio se ainda não souber)"
      />
      {nome.trim() && !reserva && (
        <>
          <Rotulo>Matrícula (opcional)</Rotulo>
          <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={estiloCampo} maxLength={30} />
        </>
      )}
      <Rotulo>Começa em</Rotulo>
      <input type="date" value={inicio} min={somarDias(data, 1)} onChange={(e) => setInicio(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
      {!nome.trim() && <p className="text-[11px] text-amber-300/80 mt-2 mb-0">Sem nome, o posto fica como "Vaga em aberto" até alguém informar o iniciante.</p>}
      <Rotulo>Motivo (opcional)</Rotulo>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={2} className={`${estiloCampo} h-auto py-2`} />
      {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
      <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : "Confirmar recolhimento"}
      </button>
    </Janela>
  );
}

// ---------------- iniciante da vaga ----------------

function JanelaIniciante({ linha, data, onFechar, onSalvo }: { linha: LinhaColaborador; data: string; onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(linha.vaga && linha.nome !== "Vaga em aberto" ? linha.nome : "");
  const [reserva, setReserva] = useState<PessoaReserva | null>(null);
  const [matricula, setMatricula] = useState(linha.matricula ?? "");
  const [inicio, setInicio] = useState(linha.aguardandoInicio ?? (data > linha.inicioEm ? data : linha.inicioEm));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    try {
      await apiPostos(`/colaboradores/${linha.id}/iniciante`, {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim(),
          inicio,
          ...(reserva ? { reservaId: reserva.id } : {}),
          ...(!reserva && matricula.trim() ? { matricula: matricula.trim() } : {}),
        }),
      });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <Janela titulo="Informar iniciante" onFechar={onFechar}>
      {linha.substituiNome && <p className="text-xs text-white/60 m-0">No lugar de {linha.substituiNome}.</p>}
      <Rotulo>Nome</Rotulo>
      <CampoNovaPessoa
        data={data}
        inicio={inicio}
        nome={nome}
        setNome={setNome}
        reserva={reserva}
        setReserva={setReserva}
        placeholder="Digite o nome"
      />
      {!reserva && (
        <>
          <Rotulo>Matrícula (opcional)</Rotulo>
          <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={estiloCampo} maxLength={30} />
        </>
      )}
      <Rotulo>Começa em</Rotulo>
      <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
      {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
      <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </Janela>
  );
}

// ---------------- cadastro do colaborador ----------------

function JanelaCadastro({
  linha,
  postoId,
  ehReserva,
  aba,
  data,
  onFechar,
  onSalvo,
}: {
  linha: LinhaColaborador | null; // null = novo
  postoId: string;
  ehReserva: boolean;
  aba: Aba;
  data: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(linha?.nome ?? "");
  const [matricula, setMatricula] = useState(linha?.matricula ?? "");
  const [area, setArea] = useState(linha?.area ?? (aba === "LIMPEZA" ? "LIMPEZA" : "PORTARIA"));
  const [turno, setTurno] = useState(linha?.turno ?? (aba === "NOTURNO" ? "NOTURNO" : "DIURNO"));
  const [regra, setRegra] = useState(linha?.regraDias ?? "IMPAR");
  const [referencia, setReferencia] = useState(linha?.dataReferencia ?? "");
  const [horario, setHorario] = useState(linha?.horario ?? "");
  const [inicio, setInicio] = useState(data);
  const [retirar, setRetirar] = useState(false);
  const [ultimoDia, setUltimoDia] = useState(data);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const pedeReferencia = REGRAS.find((r) => r.valor === regra)?.referencia;

  const enviar = async (caminho: string, metodo: string, corpo: object) => {
    setErro(null);
    setSalvando(true);
    try {
      await apiPostos(caminho, { method: metodo, body: JSON.stringify(corpo) });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  const salvar = () => {
    if (!nome.trim()) return setErro("Informe o nome.");
    const comum = {
      nome: nome.trim(),
      area,
      turno,
      regraDias: regra,
      horario: horario.trim(),
      matricula: matricula.trim(),
    };
    if (linha) {
      return enviar(`/colaboradores/${linha.id}`, "PATCH", { ...comum, dataReferencia: pedeReferencia ? referencia : "" });
    }
    return enviar("/colaboradores", "POST", {
      ...comum,
      postoId,
      inicioEm: inicio,
      ...(pedeReferencia && referencia ? { dataReferencia: referencia } : {}),
    });
  };

  const retirarDoPosto = () => {
    if (!linha) return;
    enviar(`/colaboradores/${linha.id}/remover`, "POST", { ultimoDia, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) });
  };

  return (
    <Janela titulo={linha ? `Editar — ${linha.nome}` : "Incluir colaborador"} onFechar={onFechar}>
      {!retirar && (
        <>
          <Rotulo>Nome</Rotulo>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={estiloCampo} maxLength={120} />
          <Rotulo>Matrícula (opcional)</Rotulo>
          <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={estiloCampo} maxLength={30} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Rotulo>Área</Rotulo>
              <select value={area} onChange={(e) => setArea(e.target.value)} className={estiloCampo}>
                <option value="PORTARIA">Portaria</option>
                <option value="ZELADORIA">Zeladoria e Manutenção</option>
                <option value="LIMPEZA">Limpeza</option>
              </select>
            </div>
            <div>
              <Rotulo>Turno</Rotulo>
              <select value={turno} onChange={(e) => setTurno(e.target.value)} className={estiloCampo}>
                <option value="DIURNO">Diurno</option>
                <option value="NOTURNO">Noturno</option>
              </select>
            </div>
          </div>
          <Rotulo>Escala</Rotulo>
          <select value={regra} onChange={(e) => setRegra(e.target.value)} className={estiloCampo}>
            {REGRAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
          {pedeReferencia && (
            <>
              <Rotulo>{pedeReferencia}</Rotulo>
              <input type="date" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
            </>
          )}
          <Rotulo>Horário (opcional)</Rotulo>
          <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ex.: 06:00-18:00" className={estiloCampo} maxLength={60} />
          {!linha && (
            <>
              <Rotulo>Começa no posto em</Rotulo>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
            </>
          )}
          {linha?.escalaTexto && <p className="text-[11px] text-white/40 mt-3 mb-0">Escala no RH: {linha.escalaTexto}</p>}
          {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
          <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando..." : linha ? "Salvar alterações" : "Incluir no posto"}
          </button>
          {linha && (
            <button type="button" onClick={() => setRetirar(true)} className="w-full h-10 mt-2 text-xs text-white/50 underline">
              Retirar do posto sem substituto
            </button>
          )}
          {linha && !ehReserva && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => {
                const volta = linha.remanejadoDe && !linha.remanejadoDe.reserva ? linha.remanejadoDe.posto : "a Reserva Técnica";
                if (confirm(`Devolver ${linha.nome} para ${volta}? Use só se o remanejamento foi feito por engano.`)) {
                  enviar(`/colaboradores/${linha.id}/devolver-reserva`, "POST", {});
                }
              }}
              className="w-full h-10 text-xs text-white/50 underline"
            >
              {linha.remanejadoDe && !linha.remanejadoDe.reserva
                ? `Desfazer remanejamento (volta para ${linha.remanejadoDe.posto})`
                : "Devolver para a Reserva Técnica (desfazer remanejamento)"}
            </button>
          )}
        </>
      )}
      {retirar && linha && (
        <>
          <p className="text-xs text-white/60 m-0">
            Use só quando o posto for reduzido. Para trocar a pessoa, use o botão <b>Recolhimento</b>.
          </p>
          <Rotulo>Último dia no posto</Rotulo>
          <input type="date" value={ultimoDia} onChange={(e) => setUltimoDia(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
          <Rotulo>Motivo (opcional)</Rotulo>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={estiloCampo} maxLength={300} />
          {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
          <button type="button" disabled={salvando} onClick={retirarDoPosto} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando..." : "Retirar do posto"}
          </button>
          <button type="button" onClick={() => setRetirar(false)} className="w-full h-10 mt-2 text-xs text-white/50 underline">
            Voltar
          </button>
        </>
      )}
    </Janela>
  );
}

// ---------------- remanejar (Reserva Técnica -> posto) ----------------

interface ColabPosto {
  id: string;
  nome: string;
  vaga: boolean;
  situacao: string;
  substituiId: string | null;
  area: string;
  turno: string;
}

function JanelaRemanejar({
  linha,
  data,
  postoAtual,
  onFechar,
  onSalvo,
}: {
  linha: LinhaColaborador;
  data: string;
  postoAtual: { id: string; nome: string; reserva: boolean } | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const daReserva = postoAtual?.reserva ?? true;
  const [postos, setPostos] = useState<{ id: string; nome: string }[] | null>(null);
  const [busca, setBusca] = useState("");
  const [destino, setDestino] = useState<{ id: string; nome: string } | null>(null);
  const [vagas, setVagas] = useState<{ id: string; rotulo: string }[]>([]);
  const [vagaId, setVagaId] = useState<string>("");
  const [inicio, setInicio] = useState(data);
  const [area, setArea] = useState(linha.area);
  const [turno, setTurno] = useState(linha.turno);
  const [regra, setRegra] = useState(linha.regraDias);
  const [referencia, setReferencia] = useState(linha.dataReferencia ?? "");
  const [horario, setHorario] = useState(linha.horario ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const pedeReferencia = REGRAS.find((r) => r.valor === regra)?.referencia;

  useEffect(() => {
    Promise.all(ABAS.map((a) => apiPostos<{ postos: PostoResumo[] }>(`/lista?data=${data}&aba=${a.aba}`).catch(() => ({ postos: [] as PostoResumo[] }))))
      .then((rs) => {
        const mapa = new Map<string, string>();
        rs.forEach((r) => r.postos.filter((p) => p.tipo !== "RESERVA" && p.id !== postoAtual?.id).forEach((p) => mapa.set(p.id, p.nome)));
        setPostos([...mapa.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      })
      .catch(() => setPostos([]));
  }, [data, postoAtual?.id]);

  useEffect(() => {
    setVagas([]);
    setVagaId("");
    if (!destino) return;
    apiPostos<ColabPosto[]>(`/postos/${destino.id}/colaboradores`)
      .then((lista) => {
        const nomes = new Map(lista.map((c) => [c.id, c.nome]));
        setVagas(
          lista
            .filter((c) => c.vaga && c.situacao !== "SAIU")
            .map((c) => ({
              id: c.id,
              rotulo: `Vaga em aberto${c.substituiId && nomes.get(c.substituiId) ? ` no lugar de ${nomes.get(c.substituiId)}` : ""} (${ROTULO_AREA[c.area] ?? c.area}, ${c.turno === "NOTURNO" ? "noturno" : "diurno"})`,
            })),
        );
      })
      .catch(() => setVagas([]));
  }, [destino]);

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return (postos ?? []).filter((p) => !termo || normalizarBusca(p.nome).includes(termo)).slice(0, 8);
  }, [postos, busca]);

  const salvar = async () => {
    setErro(null);
    if (!destino) return setErro("Escolha o posto de destino.");
    if (!inicio) return setErro("Informe a data de início.");
    setSalvando(true);
    try {
      await apiPostos(`/colaboradores/${linha.id}/remanejar`, {
        method: "POST",
        body: JSON.stringify(
          vagaId
            ? { postoDestinoId: destino.id, inicio, vagaId }
            : { postoDestinoId: destino.id, inicio, area, turno, regraDias: regra, dataReferencia: pedeReferencia ? referencia : "", horario: horario.trim() },
        ),
      });
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <Janela titulo={`Remanejar — ${linha.nome}`} onFechar={onFechar}>
      <p className="text-xs text-white/60 m-0">
        {daReserva
          ? "A pessoa sai da Reserva Técnica e passa a fazer parte do posto escolhido a partir da data de início."
          : `A pessoa sai de ${postoAtual?.nome ?? "este posto"} e passa a fazer parte do posto escolhido a partir da data de início. Em ${postoAtual?.nome ?? "este posto"} fica uma Vaga em aberto no lugar dela.`}
      </p>
      <Rotulo>Remanejado para o posto</Rotulo>
      {destino ? (
        <div className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2" style={{ borderColor: "rgba(96,165,250,0.5)", background: "rgba(96,165,250,0.10)" }}>
          <span className="text-sm text-white font-semibold">{destino.nome}</span>
          <button type="button" onClick={() => setDestino(null)} className="text-[11px] text-white/60 underline shrink-0">
            Trocar
          </button>
        </div>
      ) : (
        <>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar condomínio / posto" className={estiloCampo} />
          <div className="mt-1 rounded-lg border border-white/10" style={{ maxHeight: 220, overflowY: "auto" }}>
            {postos === null && <p className="text-xs text-white/50 p-3 m-0">Carregando...</p>}
            {filtrados.map((p) => (
              <button key={p.id} type="button" onClick={() => setDestino(p)} className="w-full text-left px-3 py-2 border-b border-white/5 text-sm text-white">
                {p.nome}
              </button>
            ))}
          </div>
        </>
      )}

      {destino && vagas.length > 0 && (
        <>
          <Rotulo>Como entra no posto</Rotulo>
          <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} className={estiloCampo}>
            <option value="">Adicionar ao posto</option>
            {vagas.map((v) => (
              <option key={v.id} value={v.id}>
                Ocupar: {v.rotulo}
              </option>
            ))}
          </select>
        </>
      )}

      <Rotulo>A partir de</Rotulo>
      <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />

      {destino && !vagaId && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Rotulo>Área no posto</Rotulo>
              <select value={area} onChange={(e) => setArea(e.target.value)} className={estiloCampo}>
                <option value="PORTARIA">Portaria</option>
                <option value="ZELADORIA">Zeladoria e Manutenção</option>
                <option value="LIMPEZA">Limpeza</option>
              </select>
            </div>
            <div>
              <Rotulo>Turno</Rotulo>
              <select value={turno} onChange={(e) => setTurno(e.target.value)} className={estiloCampo}>
                <option value="DIURNO">Diurno</option>
                <option value="NOTURNO">Noturno</option>
              </select>
            </div>
          </div>
          <Rotulo>Escala</Rotulo>
          <select value={regra} onChange={(e) => setRegra(e.target.value)} className={estiloCampo}>
            {REGRAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
          {pedeReferencia && (
            <>
              <Rotulo>{pedeReferencia}</Rotulo>
              <input type="date" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
            </>
          )}
          <Rotulo>Horário (opcional)</Rotulo>
          <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ex.: 06:00-18:00" className={estiloCampo} maxLength={60} />
        </>
      )}
      {destino && vagaId && <p className="text-[11px] text-white/50 mt-2 mb-0">Ocupando a vaga, a pessoa assume a escala e o horário de quem saiu.</p>}

      {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
      <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : "Remanejar"}
      </button>
    </Janela>
  );
}

// ---------------- cadastrar iniciante ----------------

function JanelaNovoIniciante({
  postoInicial,
  aba,
  data,
  onFechar,
  onSalvo,
}: {
  postoInicial: { id: string; nome: string } | null;
  aba: Aba;
  data: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [postos, setPostos] = useState<{ id: string; nome: string }[] | null>(null);
  const [busca, setBusca] = useState("");
  const [destino, setDestino] = useState<{ id: string; nome: string } | null>(postoInicial);
  const [vagas, setVagas] = useState<{ id: string; rotulo: string }[]>([]);
  const [vagaId, setVagaId] = useState("");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [inicio, setInicio] = useState(data);
  const [area, setArea] = useState(aba === "LIMPEZA" ? "LIMPEZA" : "PORTARIA");
  const [turno, setTurno] = useState(aba === "NOTURNO" ? "NOTURNO" : "DIURNO");
  const [regra, setRegra] = useState("IMPAR");
  const [referencia, setReferencia] = useState("");
  const [horario, setHorario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const pedeReferencia = REGRAS.find((r) => r.valor === regra)?.referencia;

  useEffect(() => {
    if (postoInicial) return;
    Promise.all(ABAS.map((a) => apiPostos<{ postos: PostoResumo[] }>(`/lista?data=${data}&aba=${a.aba}`).catch(() => ({ postos: [] as PostoResumo[] }))))
      .then((rs) => {
        const mapa = new Map<string, string>();
        rs.forEach((r) => r.postos.filter((p) => p.tipo !== "RESERVA").forEach((p) => mapa.set(p.id, p.nome)));
        setPostos([...mapa.entries()].map(([id, n]) => ({ id, nome: n })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      })
      .catch(() => setPostos([]));
  }, [data, postoInicial]);

  useEffect(() => {
    setVagas([]);
    setVagaId("");
    if (!destino) return;
    apiPostos<ColabPosto[]>(`/postos/${destino.id}/colaboradores`)
      .then((lista) => {
        const nomes = new Map(lista.map((c) => [c.id, c.nome]));
        setVagas(
          lista
            .filter((c) => c.vaga && c.situacao !== "SAIU")
            .map((c) => ({
              id: c.id,
              rotulo: `vaga${c.substituiId && nomes.get(c.substituiId) ? ` de ${nomes.get(c.substituiId)}` : ""} (${ROTULO_AREA[c.area] ?? c.area}, ${c.turno === "NOTURNO" ? "noturno" : "diurno"})`,
            })),
        );
      })
      .catch(() => setVagas([]));
  }, [destino]);

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return (postos ?? []).filter((p) => !termo || normalizarBusca(p.nome).includes(termo)).slice(0, 8);
  }, [postos, busca]);

  const salvar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome do iniciante.");
    if (!destino) return setErro("Escolha o posto.");
    if (!inicio) return setErro("Informe a data de início.");
    setSalvando(true);
    try {
      if (vagaId) {
        await apiPostos(`/colaboradores/${vagaId}/iniciante`, {
          method: "POST",
          body: JSON.stringify({ nome: nome.trim(), inicio, ...(matricula.trim() ? { matricula: matricula.trim() } : {}) }),
        });
      } else {
        await apiPostos("/colaboradores", {
          method: "POST",
          body: JSON.stringify({
            postoId: destino.id,
            nome: nome.trim(),
            ...(matricula.trim() ? { matricula: matricula.trim() } : {}),
            area,
            turno,
            regraDias: regra,
            ...(pedeReferencia && referencia ? { dataReferencia: referencia } : {}),
            ...(horario.trim() ? { horario: horario.trim() } : {}),
            inicioEm: inicio,
            iniciante: true,
          }),
        });
      }
      onSalvo();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  };

  return (
    <Janela titulo="Cadastrar iniciante" onFechar={onFechar}>
      <Rotulo>Nome</Rotulo>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className={estiloCampo} maxLength={120} />
      <Rotulo>Matrícula (opcional)</Rotulo>
      <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={estiloCampo} maxLength={30} />

      <Rotulo>Posto</Rotulo>
      {destino ? (
        <div className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2" style={{ borderColor: "rgba(96,165,250,0.5)", background: "rgba(96,165,250,0.10)" }}>
          <span className="text-sm text-white font-semibold">{destino.nome}</span>
          {!postoInicial && (
            <button type="button" onClick={() => setDestino(null)} className="text-[11px] text-white/60 underline shrink-0">
              Trocar
            </button>
          )}
        </div>
      ) : (
        <>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar condomínio / posto" className={estiloCampo} />
          <div className="mt-1 rounded-lg border border-white/10" style={{ maxHeight: 220, overflowY: "auto" }}>
            {postos === null && <p className="text-xs text-white/50 p-3 m-0">Carregando...</p>}
            {filtrados.map((p) => (
              <button key={p.id} type="button" onClick={() => setDestino(p)} className="w-full text-left px-3 py-2 border-b border-white/5 text-sm text-white">
                {p.nome}
              </button>
            ))}
          </div>
        </>
      )}

      {destino && vagas.length > 0 && (
        <>
          <Rotulo>Como entra no posto</Rotulo>
          <select value={vagaId} onChange={(e) => setVagaId(e.target.value)} className={estiloCampo}>
            <option value="">Nova pessoa no posto</option>
            {vagas.map((v) => (
              <option key={v.id} value={v.id}>
                Ocupar a {v.rotulo}
              </option>
            ))}
          </select>
        </>
      )}

      <Rotulo>Começa em</Rotulo>
      <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />

      {destino && !vagaId && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Rotulo>Área</Rotulo>
              <select value={area} onChange={(e) => setArea(e.target.value)} className={estiloCampo}>
                <option value="PORTARIA">Portaria</option>
                <option value="ZELADORIA">Zeladoria e Manutenção</option>
                <option value="LIMPEZA">Limpeza</option>
              </select>
            </div>
            <div>
              <Rotulo>Turno</Rotulo>
              <select value={turno} onChange={(e) => setTurno(e.target.value)} className={estiloCampo}>
                <option value="DIURNO">Diurno</option>
                <option value="NOTURNO">Noturno</option>
              </select>
            </div>
          </div>
          <Rotulo>Escala</Rotulo>
          <select value={regra} onChange={(e) => setRegra(e.target.value)} className={estiloCampo}>
            {REGRAS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.rotulo}
              </option>
            ))}
          </select>
          {pedeReferencia && (
            <>
              <Rotulo>{pedeReferencia}</Rotulo>
              <input type="date" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={estiloCampo} style={{ colorScheme: "dark" }} />
            </>
          )}
          <Rotulo>Horário (opcional)</Rotulo>
          <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ex.: 06:00-18:00" className={estiloCampo} maxLength={60} />
        </>
      )}
      {destino && vagaId && <p className="text-[11px] text-white/50 mt-2 mb-0">Ocupando a vaga, o iniciante assume a escala e o horário de quem saiu.</p>}

      {erro && <p className="text-sm text-red-400 mt-3 mb-0">{erro}</p>}
      <button type="button" disabled={salvando} onClick={salvar} className="w-full h-12 rounded-full mt-4 text-white font-bold" style={{ background: CORES.vermelho, opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : "Cadastrar iniciante"}
      </button>
    </Janela>
  );
}

// ---------------- cartão do colaborador ----------------

type Acao =
  | { tipo: "cobertura"; linha: LinhaColaborador; status: "FALTA" | "VAGO" }
  | { tipo: "recolhimento"; linha: LinhaColaborador }
  | { tipo: "iniciante"; linha: LinhaColaborador }
  | { tipo: "remanejar"; linha: LinhaColaborador }
  | { tipo: "novoIniciante"; posto: { id: string; nome: string } | null }
  | { tipo: "cadastro"; linha: LinhaColaborador | null }
  | { tipo: "apoio"; posto: { id: string; nome: string } };

function CartaoColaborador({
  linha,
  reserva,
  podeMarcar,
  ocupado,
  onMarcar,
  onAcao,
  onDesmarcar,
}: {
  linha: LinhaColaborador;
  reserva: boolean;
  podeMarcar: boolean;
  ocupado: boolean;
  onMarcar: (l: LinhaColaborador, s: Status) => void;
  onAcao: (a: Acao) => void;
  onDesmarcar: (l: LinhaColaborador) => void;
}) {
  const [mostrarMesmoAssim, setMostrarMesmoAssim] = useState(false);
  const reg = linha.registro;
  const cor = corDoStatus(reg?.status);
  const folga = linha.plantao === false && !reg;
  const botoesVisiveis = podeMarcar && !linha.vaga && (!folga || mostrarMesmoAssim);

  const botao = (s: Status, rotulo: string, verde: boolean) => {
    const ativo = reg?.status === s;
    const c = ativo ? (verde ? CORES_STATUS.verde : s === "FOLGA" ? CORES_STATUS.cinza : CORES_STATUS.vermelho) : null;
    return (
      <button
        key={s}
        type="button"
        disabled={ocupado}
        onClick={() => {
          if (s === "FALTA") return onAcao({ tipo: "cobertura", linha, status: "FALTA" });
          if (s === "RECOLHIMENTO") return onAcao({ tipo: "recolhimento", linha });
          if (!ativo) onMarcar(linha, s);
        }}
        className="h-11 rounded-lg text-xs font-bold"
        style={{
          background: c ? c.fundo : "rgba(255,255,255,0.04)",
          border: `1px solid ${c ? c.borda : "rgba(255,255,255,0.14)"}`,
          color: c ? c.texto : "rgba(255,255,255,0.75)",
          opacity: ocupado ? 0.5 : 1,
        }}
      >
        {rotulo}
      </button>
    );
  };

  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{
        background: cor ? cor.fundo : "rgba(255,255,255,0.03)",
        border: `1px solid ${cor ? cor.borda : folga ? "rgba(255,255,255,0.06)" : CORES.borda}`,
        opacity: folga && !mostrarMesmoAssim ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div style={{ minWidth: 0 }}>
          <p className="m-0 text-white font-semibold text-sm break-words">
            {linha.vaga ? (linha.aguardandoInicio ? "Posto vago" : "Vaga em aberto") : linha.nome}
          </p>
          <p className="m-0 text-[11px] text-white/50 mt-0.5">
            {[linha.horario, rotuloRegra(linha.regraDias), linha.matricula ? `Mat. ${linha.matricula}` : null].filter(Boolean).join(" · ")}
          </p>
          {linha.vaga && (
            <p className="m-0 text-[11px] text-amber-300/90 mt-1">
              {linha.aguardandoInicio ? `${linha.nome} começa em ${dataBr(linha.aguardandoInicio)}` : "Iniciante a definir"}
              {linha.substituiNome ? ` · no lugar de ${linha.substituiNome}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {reg && (
            <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ color: cor?.texto, border: `1px solid ${cor?.borda}` }}>
              {ROTULO_STATUS[reg.status] ?? reg.status}
            </span>
          )}
          {linha.iniciante && (
            <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ color: "#fbbf24", border: "1px solid rgba(251,191,36,0.5)" }}>
              🆕 Iniciante
            </span>
          )}
          {!reg && folga && <span className="text-[11px] text-white/50">Folga pela escala</span>}
          {!reg && linha.plantao === null && !linha.vaga && <span className="text-[11px] text-amber-300">Escala a definir</span>}
          {!linha.vaga && (
            <button type="button" onClick={() => onAcao({ tipo: "cadastro", linha })} className="text-[11px] text-white/40 underline">
              Editar
            </button>
          )}
        </div>
      </div>

      {linha.remanejadoDe && (
        <p className="m-0 mt-2 text-[11px]" style={{ color: "#93c5fd" }}>
          🔀 Remanejado(a) {linha.remanejadoDe.reserva ? "da Reserva Técnica" : `de ${linha.remanejadoDe.posto}`} a partir de {dataBr(linha.remanejadoDe.inicio)}
          <span className="block text-white/45">
            por {linha.remanejadoDe.usuarioNome ?? "—"} em {dataHoraBr(linha.remanejadoDe.criadoEm)}
          </span>
        </p>
      )}
      {linha.remanejadoPara && (
        <p className="m-0 mt-2 text-[11px]" style={{ color: "#93c5fd" }}>
          🔀 Remanejado(a) para {linha.remanejadoPara.posto} a partir de {dataBr(linha.remanejadoPara.inicio)}
          <span className="block text-white/45">
            por {linha.remanejadoPara.usuarioNome ?? "—"} em {dataHoraBr(linha.remanejadoPara.criadoEm)}
          </span>
        </p>
      )}

      {reg && (reg.coberturaTipo || reg.observacao) && (
        <p className="m-0 mt-2 text-xs text-white/75">
          {reg.coberturaTipo && (
            <>
              Cobertura: <b>{ROTULO_COBERTURA[reg.coberturaTipo]}</b>
              {reg.coberturaNome ? ` — ${reg.coberturaNome}` : ""}
              {reg.coberturaValor != null ? ` (${moeda(reg.coberturaValor)})` : ""}
            </>
          )}
          {reg.observacao && <span className="block text-white/55">Obs.: {reg.observacao}</span>}
        </p>
      )}

      {botoesVisiveis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {botao("CONFIRMADO", "✅ Confirmado", true)}
          {botao("FALTA", "❌ Falta", false)}
          {botao("RECOLHIMENTO", "⛔ Recolhimento", false)}
          {botao("FOLGA", "💤 Folga", false)}
        </div>
      )}

      {podeMarcar && linha.vaga && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => onAcao({ tipo: "cobertura", linha, status: "VAGO" })}
            className="h-11 rounded-lg text-xs font-bold"
            style={{ background: CORES_STATUS.vermelho.fundo, border: `1px solid ${CORES_STATUS.vermelho.borda}`, color: CORES_STATUS.vermelho.texto }}
          >
            {reg ? "Alterar cobertura" : "Registrar cobertura"}
          </button>
          <button type="button" onClick={() => onAcao({ tipo: "iniciante", linha })} className="h-11 rounded-lg text-xs font-bold border border-white/15 text-white/80">
            Informar iniciante
          </button>
        </div>
      )}

      {reserva && !linha.vaga && !linha.remanejadoPara && (
        <button
          type="button"
          onClick={() => onAcao({ tipo: "remanejar", linha })}
          className="w-full h-10 rounded-lg mt-2 text-xs font-bold border"
          style={{ borderColor: "rgba(96,165,250,0.5)", color: "#93c5fd", background: "rgba(96,165,250,0.08)" }}
        >
          🔀 Remanejado para posto
        </button>
      )}
      {!reserva && !linha.vaga && !linha.remanejadoPara && (
        <button type="button" onClick={() => onAcao({ tipo: "remanejar", linha })} className="mt-2 text-[11px] underline" style={{ color: "#93c5fd" }}>
          🔀 Remanejar para outro posto
        </button>
      )}

      {podeMarcar && folga && !mostrarMesmoAssim && !linha.vaga && (
        <button type="button" onClick={() => setMostrarMesmoAssim(true)} className="mt-2 text-[11px] text-white/50 underline">
          Trabalhou mesmo assim? Marcar
        </button>
      )}

      {reg && podeMarcar && (
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-[10px] text-white/35">
            por {reg.registradoPorNome} · {new Date(reg.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
          </span>
          <button type="button" disabled={ocupado} onClick={() => onDesmarcar(linha)} className="text-[11px] text-white/50 underline">
            {reg.status === "RECOLHIMENTO" ? "Desfazer recolhimento" : "Desmarcar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- página ----------------

interface DiaResposta {
  posto: { id: string; nome: string; tipo: string };
  data: string;
  podeMarcar: boolean;
  colaboradores: LinhaColaborador[];
}

export default function ConfirmacaoPosto() {
  const [aba, setAbaEstado] = useState<Aba>(lerAba);
  const [data, setData] = useState(hojeBrasilia());
  const [postos, setPostos] = useState<PostoResumo[] | null>(null);
  const [postoId, setPostoId] = useState<string | null>(null);
  const [dia, setDia] = useState<DiaResposta | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [acao, setAcao] = useState<Acao | null>(null);
  const hoje = hojeBrasilia();

  const setAba = (a: Aba) => {
    setAbaEstado(a);
    try {
      localStorage.setItem(CHAVE_ABA, a);
    } catch {
      // sem armazenamento
    }
  };

  const carregarPostos = useCallback(async () => {
    try {
      const r = await apiPostos<{ postos: PostoResumo[] }>(`/lista?data=${data}&aba=${aba}`, {}, "Não foi possível carregar os postos.");
      setPostos(r.postos);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
      setPostos([]);
    }
  }, [data, aba]);

  const carregarDia = useCallback(async () => {
    if (!postoId) return setDia(null);
    try {
      const r = await apiPostos<DiaResposta>(`/dia?postoId=${postoId}&data=${data}&aba=${aba}`, {}, "Não foi possível carregar o posto.");
      setDia(r);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
      setDia(null);
    }
  }, [postoId, data, aba]);

  useEffect(() => {
    setPostos(null);
    carregarPostos();
  }, [carregarPostos]);

  useEffect(() => {
    carregarDia();
  }, [carregarDia]);

  // Posto que não aparece na aba escolhida: volta para a lista.
  useEffect(() => {
    if (postoId && postos && !postos.some((p) => p.id === postoId)) setPostoId(null);
  }, [postos, postoId]);

  const recarregar = async () => {
    await Promise.all([carregarDia(), carregarPostos()]);
  };

  const marcar = async (linha: LinhaColaborador, status: Status) => {
    setOcupado(true);
    try {
      await apiPostos("/registros", { method: "POST", body: JSON.stringify({ colaboradorId: linha.id, data, status }) });
      await recarregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const desmarcar = async (linha: LinhaColaborador) => {
    if (!linha.registro) return;
    const recolhimento = linha.registro.status === "RECOLHIMENTO";
    if (recolhimento && !confirm(`Desfazer o recolhimento de ${linha.nome}? A pessoa volta para o posto e o substituto sai.`)) return;
    setOcupado(true);
    try {
      await apiPostos(`/registros/${linha.registro.id}`, { method: "DELETE" });
      await recarregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const fecharAcao = useCallback(() => setAcao(null), []);
  const [versaoApoios, setVersaoApoios] = useState(0);
  const salvoAcao = async () => {
    setAcao(null);
    setVersaoApoios((v) => v + 1);
    await recarregar();
  };

  const postosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return (postos ?? []).filter((p) => !termo || normalizarBusca(p.nome).includes(termo));
  }, [postos, busca]);

  const totais = useMemo(() => {
    const lista = postos ?? [];
    return {
      pendentes: lista.reduce((s, p) => s + p.pendentes, 0),
      vermelhos: lista.reduce((s, p) => s + p.vermelhos, 0),
      completos: lista.filter((p) => p.pendentes === 0).length,
    };
  }, [postos]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, LinhaColaborador[]>();
    for (const l of dia?.colaboradores ?? []) {
      const chave = ROTULO_AREA[l.area] ?? l.area;
      mapa.set(chave, [...(mapa.get(chave) ?? []), l]);
    }
    return [...mapa.entries()];
  }, [dia]);

  // Efetivo do posto aberto: aparece logo abaixo da linha do posto (seta).
  const detalhe = postoId ? (
            <>
              {(!dia || dia.posto.id !== postoId) && !erro && <p className="text-sm text-white/50 m-0">Carregando...</p>}
              {dia && dia.posto.id === postoId && (
                <>
                  {!dia.podeMarcar && (
                    <p className="text-xs text-amber-300 mt-1">
                      {data > hoje ? "Dia futuro: só consulta." : "Só consulta: o supervisor marca até 7 dias para trás."}
                    </p>
                  )}
                  {dia.colaboradores.length === 0 && <p className="text-sm text-white/50">Ninguém nesta aba neste dia.</p>}
                  {grupos.map(([area, linhas]) => (
                    <div key={area} className="mt-3">
                      <p className="text-[11px] uppercase tracking-wider text-white/45 mb-2" style={{ fontFamily: FONTES.mono }}>
                        {area}
                      </p>
                      {linhas.map((l) => (
                        <CartaoColaborador
                          key={l.id}
                          linha={l}
                          reserva={dia.posto.tipo === "RESERVA"}
                          podeMarcar={dia.podeMarcar}
                          ocupado={ocupado}
                          onMarcar={marcar}
                          onAcao={setAcao}
                          onDesmarcar={desmarcar}
                        />
                      ))}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAcao({ tipo: "novoIniciante", posto: { id: dia.posto.id, nome: dia.posto.nome } })}
                    className="w-full h-11 rounded-xl border border-dashed border-white/20 text-white/70 text-sm mt-3"
                  >
                    ＋ Cadastrar iniciante neste posto
                  </button>
                  {dia.posto.tipo !== "RESERVA" && (
                    <SecaoApoios
                      postoId={dia.posto.id}
                      data={data}
                      aba={aba}
                      podeMarcar={dia.podeMarcar}
                      versao={versaoApoios}
                      onNovo={() => setAcao({ tipo: "apoio", posto: { id: dia.posto.id, nome: dia.posto.nome } })}
                    />
                  )}
                </>
              )}
            </>
  ) : null;

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "1.5rem 1rem 4rem", minWidth: 0 }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
              Confirmação de posto
            </p>
            <Link to="/confirmacao-posto/historico" className="h-9 px-4 rounded-full border border-white/15 text-white/80 text-xs inline-flex items-center">
              📋 Histórico
            </Link>
          </div>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>Confirme diariamente quem está no posto.</p>
          <AvisoNotificacoes />

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {ABAS.map((a) => {
              const ativa = a.aba === aba;
              return (
                <button
                  key={a.aba}
                  type="button"
                  onClick={() => setAba(a.aba)}
                  style={{
                    flex: "1 1 100px",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: ativa ? "rgba(96,165,250,0.14)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${ativa ? "rgba(96,165,250,0.5)" : CORES.borda}`,
                    color: ativa ? CORES.texto : CORES.textoSecundario,
                    fontFamily: FONTES.corpo,
                  }}
                >
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{a.titulo}</span>
                  <span style={{ display: "block", fontSize: 11, color: CORES.textoMuted, marginTop: 2 }}>{a.subtitulo}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => setData(somarDias(data, -1))} aria-label="Dia anterior" className="h-11 w-11 rounded-lg border border-white/15 text-white text-lg">
              ‹
            </button>
            <label className="flex-1 h-11 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center gap-2 text-sm text-white relative">
              <span>
                {data === hoje ? "Hoje, " : ""}
                {diaDaSemana(data)} {dataBr(data)}
              </span>
              <input
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => e.target.value && setData(e.target.value)}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", colorScheme: "dark" }}
                aria-label="Escolher data"
              />
            </label>
            <button
              type="button"
              disabled={data >= hoje}
              onClick={() => setData(somarDias(data, 1))}
              aria-label="Dia seguinte"
              className="h-11 w-11 rounded-lg border border-white/15 text-white text-lg disabled:opacity-30"
            >
              ›
            </button>
            {data !== hoje && (
              <button type="button" onClick={() => setData(hoje)} className="h-11 px-3 rounded-lg border border-white/15 text-white/80 text-xs">
                Hoje
              </button>
            )}
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          {(
            <>
              <button
                type="button"
                onClick={() => setAcao({ tipo: "novoIniciante", posto: null })}
                className="w-full h-11 rounded-xl mb-3 text-sm font-bold"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.45)", color: "#fbbf24" }}
              >
                ＋ Cadastrar iniciante
              </button>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Pesquisar condomínio / posto" className={`${estiloCampo} mb-3`} />
              {postos && postos.length > 0 && (
                <p className="text-xs text-white/50 mt-0 mb-3">
                  {postos.length} postos · {totais.completos} completos · {totais.pendentes} a confirmar
                  {totais.vermelhos ? ` · ${totais.vermelhos} em vermelho` : ""}
                </p>
              )}
              {postos === null && <p className="text-sm text-white/50">Carregando...</p>}
              {postos?.length === 0 && !erro && (
                <p className="text-sm text-white/50">Nenhum posto com colaboradores nesta aba{busca ? "" : " para você"}.</p>
              )}
              <div className="flex flex-col gap-2">
                {postosFiltrados.map((p) => {
                  const completo = p.pendentes === 0;
                  const c = p.vermelhos ? CORES_STATUS.vermelho : completo ? CORES_STATUS.verde : CORES_STATUS.amarelo;
                  const aberto = p.id === postoId;
                  return (
                    <div
                      key={p.id}
                      id={`posto-${p.id}`}
                      className="rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${aberto ? "rgba(96,165,250,0.45)" : CORES.borda}`, scrollMarginTop: 72 }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPostoId(aberto ? null : p.id);
                          if (!aberto) setTimeout(() => document.getElementById(`posto-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                        }}
                        aria-expanded={aberto}
                        className="w-full text-left rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                      >
                      <span style={{ minWidth: 0 }}>
                        <span className="block text-sm text-white font-semibold break-words">{p.nome}</span>
                        <span className="block text-[11px] text-white/45 mt-0.5">
                          {p.total} {p.total === 1 ? "pessoa" : "pessoas"} · {p.dePlantao} no plantão
                          {p.tipo === "RESERVA" ? " · Reserva Técnica" : ""}
                        </span>
                      </span>
                      <span className="text-[11px] font-bold rounded-full px-2 py-1 shrink-0" style={{ color: c.texto, border: `1px solid ${c.borda}`, background: c.fundo }}>
                        {completo ? (p.vermelhos ? `✓ ${p.vermelhos} vermelho${p.vermelhos > 1 ? "s" : ""}` : "✓ Completo") : `${p.pendentes} a confirmar`}
                      </span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-white/60"
                        style={{ fontSize: 18, lineHeight: 1, display: "inline-block", transition: "transform .2s", transform: aberto ? "rotate(180deg)" : "none" }}
                      >
                        ▾
                      </span>
                      </button>
                      {aberto && <div className="px-3 pb-3">{detalhe}</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </div>

      {acao?.tipo === "cobertura" && <JanelaCobertura linha={acao.linha} postoId={postoId ?? ""} data={data} status={acao.status} onFechar={fecharAcao} onSalvo={salvoAcao} />}
      {acao?.tipo === "apoio" && (
        <JanelaApoio postoId={acao.posto.id} postoNome={acao.posto.nome} data={data} aba={aba} onFechar={fecharAcao} onSalvo={salvoAcao} />
      )}
      {acao?.tipo === "recolhimento" && <JanelaRecolhimento linha={acao.linha} postoId={postoId ?? ""} data={data} onFechar={fecharAcao} onSalvo={salvoAcao} />}
      {acao?.tipo === "iniciante" && <JanelaIniciante linha={acao.linha} data={data} onFechar={fecharAcao} onSalvo={salvoAcao} />}
      {acao?.tipo === "remanejar" && (
        <JanelaRemanejar
          linha={acao.linha}
          data={data}
          postoAtual={dia ? { id: dia.posto.id, nome: dia.posto.nome, reserva: dia.posto.tipo === "RESERVA" } : null}
          onFechar={fecharAcao}
          onSalvo={salvoAcao}
        />
      )}
      {acao?.tipo === "novoIniciante" && <JanelaNovoIniciante postoInicial={acao.posto} aba={aba} data={data} onFechar={fecharAcao} onSalvo={salvoAcao} />}
      {acao?.tipo === "cadastro" && postoId && (
        <JanelaCadastro linha={acao.linha} postoId={postoId} ehReserva={dia?.posto.tipo === "RESERVA"} aba={aba} data={data} onFechar={fecharAcao} onSalvo={salvoAcao} />
      )}
    </div>
  );
}
