import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import NavAdmin from "../components/NavAdmin";
import SeletorCondominio from "../components/SeletorCondominio";
import { CORES, FONTES } from "../theme";
import { ehAdminMaster } from "../lib/api";
import {
  Anotacao,
  EstadoPush,
  StatusAnotacao,
  TipoAnotacao,
  apiAnotacoes,
  ativarPush,
  dataHoraBr,
  desativarPush,
  doCampoDataHora,
  estadoPush,
  json,
  paraCampoDataHora,
  testarPush,
} from "../lib/anotacoes";

// Anotações do condomínio (11/2026): anotações e ocorrências dos
// supervisores, por condomínio. Todos veem tudo; quem criou (ou o
// Master) edita; qualquer um resolve/reabre; só o Master exclui.
// Lembrete opcional: notificação no celular de quem criou.

const campo =
  "rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60";

interface CondominioSimples {
  id: string;
  nome: string;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-full border text-xs font-semibold ${ativo ? "border-[#FF3B3B] bg-[#FF3B3B]/15 text-white" : "border-white/10 text-white/60"}`}
    >
      {children}
    </button>
  );
}

function SeletorTipo({ tipo, setTipo }: { tipo: TipoAnotacao; setTipo: (t: TipoAnotacao) => void }) {
  return (
    <div className="flex gap-2">
      {(["ANOTACAO", "OCORRENCIA"] as TipoAnotacao[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTipo(t)}
          className={`h-9 flex-1 rounded-lg border text-sm font-semibold ${tipo === t ? "border-[#FF3B3B] bg-[#FF3B3B]/15 text-white" : "border-white/10 text-white/60"}`}
        >
          {t === "ANOTACAO" ? "📝 Anotação" : "⚠️ Ocorrência"}
        </button>
      ))}
    </div>
  );
}

// Caixa "Me lembrar" (data e hora). Valor no formato do campo datetime-local.
function CampoLembrete({ valor, setValor, avisoPush }: { valor: string; setValor: (v: string) => void; avisoPush: boolean }) {
  const ligado = valor !== "";
  const padrao = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return paraCampoDataHora(d.toISOString());
  };
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
        <input type="checkbox" checked={ligado} onChange={(e) => setValor(e.target.checked ? padrao() : "")} className="w-4 h-4 accent-[#FF3B3B]" />
        🔔 Me lembrar (notificação no celular)
      </label>
      {ligado && (
        <div className="mt-2">
          <input
            type="datetime-local"
            value={valor}
            min={paraCampoDataHora(new Date().toISOString())}
            onChange={(e) => setValor(e.target.value)}
            className={`${campo} h-10 [color-scheme:dark]`}
          />
          {avisoPush && <p className="text-xs text-amber-300 mt-1 mb-0">Ative as notificações neste aparelho (no topo da tela) para receber o lembrete.</p>}
        </div>
      )}
    </div>
  );
}

// Cartão de ativar as notificações neste aparelho.
function CartaoNotificacoes({ estado, aoMudar }: { estado: EstadoPush | null; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<string | void>) => {
    setOcupado(true);
    setMsg(null);
    setErro(null);
    try {
      const r = await acao();
      if (r) setMsg(r);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
      aoMudar();
    }
  };

  if (estado === null) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
      <p className="text-sm font-bold text-white m-0">🔔 Notificações neste aparelho</p>
      {estado === "ativado" && <p className="text-xs text-emerald-300 mt-1 mb-0">Ativadas — os seus lembretes chegam aqui.</p>}
      {estado === "desativado" && <p className="text-xs text-white/50 mt-1 mb-0">Desativadas. Ative para receber os lembretes das suas anotações.</p>}
      {estado === "bloqueado" && (
        <p className="text-xs text-amber-300 mt-1 mb-0">Bloqueadas neste navegador. Libere as notificações do Uzellar nas configurações do celular/navegador e volte aqui.</p>
      )}
      {estado === "instalar-iphone" && (
        <p className="text-xs text-amber-300 mt-1 mb-0">
          No iPhone, as notificações só funcionam com o Uzellar instalado: no Safari, toque em Compartilhar → “Adicionar à Tela de Início” e abra o Uzellar pelo ícone.
        </p>
      )}
      {estado === "sem-suporte" && <p className="text-xs text-amber-300 mt-1 mb-0">Este navegador não recebe notificações. Use o Chrome (Android/computador) ou o app instalado no iPhone.</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        {estado === "desativado" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => executar(async () => { await ativarPush(); return "Notificações ativadas."; })}
            className="h-9 px-4 rounded-lg bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-40"
          >
            {ocupado ? "Ativando..." : "Ativar notificações"}
          </button>
        )}
        {estado === "ativado" && (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(async () => ((await testarPush()) > 0 ? "Teste enviado — a notificação deve chegar em instantes." : "Nenhum aparelho recebeu. Desative e ative de novo."))}
              className="h-9 px-4 rounded-lg border border-white/15 text-white/90 text-sm disabled:opacity-40"
            >
              Enviar notificação de teste
            </button>
            <button type="button" disabled={ocupado} onClick={() => executar(async () => { await desativarPush(); return "Notificações desativadas neste aparelho."; })} className="h-9 px-3 rounded-lg border border-white/10 text-white/60 text-sm disabled:opacity-40">
              Desativar
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-xs text-emerald-300 mt-2 mb-0">{msg}</p>}
      {erro && <p className="text-xs text-red-400 mt-2 mb-0">{erro}</p>}
    </div>
  );
}

function CartaoAnotacao({
  a,
  mostrarCondominio,
  master,
  destaque,
  avisoPush,
  aoMudar,
}: {
  a: Anotacao;
  mostrarCondominio: boolean;
  master: boolean;
  destaque: boolean;
  avisoPush: boolean;
  aoMudar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<TipoAnotacao>(a.tipo);
  const [texto, setTexto] = useState(a.texto);
  const [lembrete, setLembrete] = useState(paraCampoDataHora(a.lembreteEnviadoEm ? null : a.lembreteEm));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (destaque) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [destaque]);

  const executar = async (caminho: string, opcoes: RequestInit) => {
    setErro(null);
    setOcupado(true);
    try {
      await apiAnotacoes(caminho, opcoes, "Não foi possível salvar.");
      setEditando(false);
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  const salvar = () => {
    const dados: Record<string, unknown> = { tipo, texto: texto.trim() };
    if (a.minha) {
      const original = paraCampoDataHora(a.lembreteEnviadoEm ? null : a.lembreteEm);
      if (lembrete !== original) dados.lembreteEm = doCampoDataHora(lembrete);
    }
    executar(`/${a.id}`, json("PATCH", dados));
  };

  const excluir = () => {
    if (!window.confirm("Excluir esta anotação? Não dá para desfazer.")) return;
    executar(`/${a.id}`, { method: "DELETE" });
  };

  const resolvida = a.status === "RESOLVIDA";
  return (
    <div ref={ref} className={`rounded-xl border p-4 mb-3 ${destaque ? "border-[#FF3B3B] bg-[#FF3B3B]/10" : "border-white/10 bg-white/[0.03]"} ${resolvida ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${a.tipo === "OCORRENCIA" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-white/70"}`}>
          {a.tipo === "OCORRENCIA" ? "⚠️ Ocorrência" : "📝 Anotação"}
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${resolvida ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>
          {resolvida ? "Resolvida" : "Aberta"}
        </span>
        {mostrarCondominio && <span className="text-xs text-white/60">{a.condominioNome}</span>}
      </div>

      {editando ? (
        <div className="grid gap-3">
          <SeletorTipo tipo={tipo} setTipo={setTipo} />
          <textarea value={texto} maxLength={2000} rows={4} onChange={(e) => setTexto(e.target.value)} className={`${campo} py-2 w-full`} />
          {a.minha && <CampoLembrete valor={lembrete} setValor={setLembrete} avisoPush={avisoPush} />}
          <div className="flex gap-2">
            <button type="button" disabled={ocupado || !texto.trim()} onClick={salvar} className="h-9 px-4 rounded-lg bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30">
              {ocupado ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="h-9 px-3 rounded-lg border border-white/10 text-white/70 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-white m-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {a.texto}
          </p>
          <p className="text-[11px] text-white/40 mt-2 mb-0">
            {a.autorNome} · {dataHoraBr(a.criadoEm)}
            {a.editadoPorNome ? ` · editado por ${a.editadoPorNome}` : ""}
            {resolvida && a.resolvidoPorNome ? ` · resolvida por ${a.resolvidoPorNome} em ${dataHoraBr(a.resolvidoEm)}` : ""}
          </p>
          {a.lembreteEm && (
            <p className="text-xs mt-1 mb-0 text-white/60">
              🔔 Lembrete {a.minha ? "" : `de ${a.autorNome} `}em {dataHoraBr(a.lembreteEm)}
              {a.lembreteEnviadoEm ? " · ✓ enviado" : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => executar(`/${a.id}/${resolvida ? "reabrir" : "resolver"}`, { method: "POST" })}
              className={`h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-40 ${resolvida ? "border border-white/10 text-white/80" : "bg-emerald-600/80 text-white"}`}
            >
              {resolvida ? "Reabrir" : "✓ Marcar como resolvida"}
            </button>
            {a.podeEditar && (
              <button type="button" onClick={() => setEditando(true)} className="h-8 px-3 rounded-lg border border-white/10 text-white/80 text-xs">
                Editar
              </button>
            )}
            {master && (
              <button type="button" onClick={excluir} className="h-8 px-3 rounded-lg border border-red-500/30 text-red-300 text-xs">
                Excluir
              </button>
            )}
          </div>
        </>
      )}
      {erro && <p className="text-xs text-red-400 mt-2 mb-0">{erro}</p>}
    </div>
  );
}

export default function Anotacoes() {
  const master = ehAdminMaster();
  const { search } = useLocation();
  const destaqueId = useMemo(() => new URLSearchParams(search).get("id"), [search]);

  const [condominios, setCondominios] = useState<CondominioSimples[]>([]);
  const [condominioId, setCondominioId] = useState<string>("");
  const [status, setStatus] = useState<StatusAnotacao | "">("ABERTA");
  const [filtroTipo, setFiltroTipo] = useState<TipoAnotacao | "">("");
  const [lista, setLista] = useState<Anotacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoPush | null>(null);

  const [tipo, setTipo] = useState<TipoAnotacao>("ANOTACAO");
  const [texto, setTexto] = useState("");
  const [lembrete, setLembrete] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const atualizarEstado = useCallback(() => {
    estadoPush().then(setEstado);
  }, []);

  useEffect(() => {
    apiAnotacoes<CondominioSimples[]>("/condominios", {}, "Não foi possível carregar os condomínios.")
      .then(setCondominios)
      .catch((e) => setErro((e as Error).message));
    // Se já estava ativado, confirma o aparelho no servidor (silencioso).
    estadoPush().then((e) => {
      setEstado(e);
      if (e === "ativado") ativarPush().catch(() => undefined);
    });
  }, []);

  // Vindo de uma notificação: mostra todas, para a anotação aparecer.
  useEffect(() => {
    if (destaqueId) {
      setCondominioId("");
      setStatus("");
      setFiltroTipo("");
    }
  }, [destaqueId]);

  const carregar = useCallback(async () => {
    const p = new URLSearchParams();
    if (condominioId) p.set("condominioId", condominioId);
    if (status) p.set("status", status);
    if (filtroTipo) p.set("tipo", filtroTipo);
    try {
      setLista(await apiAnotacoes<Anotacao[]>(`?${p.toString()}`, {}, "Não foi possível carregar as anotações."));
    } catch (e) {
      setErro((e as Error).message);
      setLista([]);
    }
  }, [condominioId, status, filtroTipo]);

  useEffect(() => {
    setLista(null);
    carregar();
  }, [carregar]);

  const criar = async () => {
    if (!condominioId || !texto.trim()) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      await apiAnotacoes("", json("POST", { condominioId, tipo, texto: texto.trim(), lembreteEm: doCampoDataHora(lembrete) }), "Não foi possível salvar.");
      setTexto("");
      setLembrete("");
      setAviso(lembrete ? "Anotação salva. O lembrete chega no horário marcado." : "Anotação salva.");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const avisoPush = estado !== "ativado";

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Anotações do condomínio</p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
            Anotações e ocorrências dos supervisores. Todos veem; o lembrete chega só para quem criou.
          </p>

          <CartaoNotificacoes estado={estado} aoMudar={atualizarEstado} />

          <SeletorCondominio condominios={condominios} valor={condominioId} onChange={setCondominioId} opcaoTodos="Todos os condomínios" marginBottom={12} />

          {condominioId ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4 grid gap-3">
              <p className="text-sm font-bold text-white m-0">Nova anotação</p>
              <SeletorTipo tipo={tipo} setTipo={setTipo} />
              <textarea
                value={texto}
                maxLength={2000}
                rows={4}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={tipo === "OCORRENCIA" ? "O que aconteceu?" : "O que você quer anotar?"}
                className={`${campo} py-2 w-full`}
              />
              <CampoLembrete valor={lembrete} setValor={setLembrete} avisoPush={avisoPush} />
              <div>
                <button
                  type="button"
                  disabled={salvando || !texto.trim()}
                  onClick={criar}
                  className="h-10 px-6 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30"
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
              {aviso && <p className="text-sm text-emerald-300 m-0">{aviso}</p>}
            </div>
          ) : (
            <p className="text-xs text-white/40 mt-0 mb-4">Para escrever uma anotação, escolha um condomínio acima.</p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            <Chip ativo={status === "ABERTA"} onClick={() => setStatus("ABERTA")}>Abertas</Chip>
            <Chip ativo={status === "RESOLVIDA"} onClick={() => setStatus("RESOLVIDA")}>Resolvidas</Chip>
            <Chip ativo={status === ""} onClick={() => setStatus("")}>Todas</Chip>
            <span className="w-3" />
            <Chip ativo={filtroTipo === ""} onClick={() => setFiltroTipo("")}>Tudo</Chip>
            <Chip ativo={filtroTipo === "ANOTACAO"} onClick={() => setFiltroTipo("ANOTACAO")}>Anotações</Chip>
            <Chip ativo={filtroTipo === "OCORRENCIA"} onClick={() => setFiltroTipo("OCORRENCIA")}>Ocorrências</Chip>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}
          {lista === null && <p className="text-sm text-white/50">Carregando...</p>}
          {lista?.length === 0 && <p className="text-sm text-white/50">Nenhuma anotação por aqui.</p>}
          {lista?.map((a) => (
            <CartaoAnotacao
              key={`${a.id}-${a.atualizadoEm}`}
              a={a}
              mostrarCondominio={!condominioId}
              master={master}
              destaque={a.id === destaqueId}
              avisoPush={avisoPush}
              aoMudar={carregar}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
