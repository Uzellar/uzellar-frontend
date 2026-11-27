import { useCallback, useEffect, useMemo, useState } from "react";
import NavAdmin from "../components/NavAdmin";
import SeletorCondominio from "../components/SeletorCondominio";
import { CORES, FONTES } from "../theme";
import { ehAdminMaster } from "../lib/api";
import {
  CondominioSimples,
  EquipamentoPosto,
  Propriedade,
  TipoEquipamento,
  apiEquipamentos,
  dataBr,
  enviarJson,
  hojeIso,
} from "../lib/equipamentos";

// Equipamentos do posto (11/2026): o que cada condomínio tem (celular,
// rádio, lanterna...), quantidade, modelo, data de implantação e se é
// da empresa ou alugado. Supervisor e Admin Master lançam e editam em
// qualquer condomínio; só o Admin Master exclui e cadastra novos tipos.

const campo =
  "h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60";
const rotulo = "block text-[11px] tracking-wide text-white/50 mb-1";

interface Dados {
  tipoId: string;
  modelo: string;
  quantidade: string;
  dataImplantacao: string;
  propriedade: Propriedade;
  locadora: string;
}

const VAZIO: Dados = { tipoId: "", modelo: "", quantidade: "1", dataImplantacao: hojeIso(), propriedade: "EMPRESA", locadora: "" };

function paraEnvio(d: Dados) {
  return {
    tipoId: d.tipoId,
    modelo: d.modelo.trim(),
    quantidade: Number(d.quantidade),
    dataImplantacao: d.dataImplantacao,
    propriedade: d.propriedade,
    locadora: d.propriedade === "ALUGUEL" ? d.locadora.trim() : "",
  };
}

function valido(d: Dados) {
  const q = Number(d.quantidade);
  return !!d.tipoId && Number.isInteger(q) && q >= 1 && q <= 9999 && /^\d{4}-\d{2}-\d{2}$/.test(d.dataImplantacao);
}

// Campos do formulário (usado para adicionar e para editar).
function CamposEquipamento({ d, setD, tipos }: { d: Dados; setD: (d: Dados) => void; tipos: TipoEquipamento[] }) {
  const ativos = tipos.filter((t) => t.ativo || t.id === d.tipoId);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={rotulo}>EQUIPAMENTO</span>
        <select value={d.tipoId} onChange={(e) => setD({ ...d, tipoId: e.target.value })} className={`${campo} w-full`}>
          <option value="" className="bg-[#1a1a1a]">
            Selecione...
          </option>
          {ativos.map((t) => (
            <option key={t.id} value={t.id} className="bg-[#1a1a1a]">
              {t.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={rotulo}>MODELO DO EQUIPAMENTO</span>
        <input value={d.modelo} maxLength={120} onChange={(e) => setD({ ...d, modelo: e.target.value })} placeholder="Ex.: Motorola T470" className={`${campo} w-full`} />
      </label>
      <label className="block">
        <span className={rotulo}>QUANTIDADE</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          value={d.quantidade}
          onChange={(e) => setD({ ...d, quantidade: e.target.value })}
          className={`${campo} w-full`}
        />
      </label>
      <label className="block">
        <span className={rotulo}>DATA DE IMPLANTAÇÃO</span>
        <input type="date" value={d.dataImplantacao} onChange={(e) => setD({ ...d, dataImplantacao: e.target.value })} className={`${campo} w-full [color-scheme:dark]`} />
      </label>
      <div className="block">
        <span className={rotulo}>O EQUIPAMENTO É</span>
        <div className="flex gap-2">
          {(["EMPRESA", "ALUGUEL"] as Propriedade[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setD({ ...d, propriedade: p })}
              className={`h-10 flex-1 rounded-lg border text-sm font-semibold ${
                d.propriedade === p ? "border-[#FF3B3B] bg-[#FF3B3B]/15 text-white" : "border-white/10 text-white/60"
              }`}
            >
              {p === "EMPRESA" ? "Da empresa" : "Aluguel"}
            </button>
          ))}
        </div>
      </div>
      {d.propriedade === "ALUGUEL" && (
        <label className="block">
          <span className={rotulo}>NOME DA LOCADORA</span>
          <input value={d.locadora} maxLength={120} onChange={(e) => setD({ ...d, locadora: e.target.value })} placeholder="De quem é o aluguel" className={`${campo} w-full`} />
        </label>
      )}
    </div>
  );
}

function LinhaEquipamento({ item, tipos, master, aoMudar }: { item: EquipamentoPosto; tipos: TipoEquipamento[]; master: boolean; aoMudar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [d, setD] = useState<Dados>({
    tipoId: item.tipoId,
    modelo: item.modelo ?? "",
    quantidade: String(item.quantidade),
    dataImplantacao: item.dataImplantacao.slice(0, 10),
    propriedade: item.propriedade,
    locadora: item.locadora ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setErro(null);
    setSalvando(true);
    try {
      await apiEquipamentos(`/${item.id}`, enviarJson("PATCH", paraEnvio(d)), "Não foi possível salvar.");
      setEditando(false);
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!window.confirm(`Excluir "${item.tipoNome}${item.modelo ? ` — ${item.modelo}` : ""}" deste condomínio? Não dá para desfazer.`)) return;
    setErro(null);
    try {
      await apiEquipamentos(`/${item.id}`, { method: "DELETE" }, "Não foi possível excluir.");
      aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="py-3 border-t border-white/5">
      {editando ? (
        <div>
          <CamposEquipamento d={d} setD={setD} tipos={tipos} />
          <div className="flex gap-2 mt-3">
            <button type="button" disabled={salvando || !valido(d)} onClick={salvar} className="h-9 px-4 rounded-lg bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="h-9 px-3 rounded-lg border border-white/10 text-white/70 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold text-white">
              <span className="inline-block min-w-[2.2rem] text-[#FF3B3B]">{item.quantidade}×</span>
              {item.tipoNome}
              {item.modelo && <span className="text-white/60 font-normal"> · {item.modelo}</span>}
            </p>
            <p className="m-0 mt-1 text-xs text-white/50">
              Implantado em {dataBr(item.dataImplantacao)} ·{" "}
              {item.propriedade === "ALUGUEL" ? (
                <span className="text-amber-300">Aluguel{item.locadora ? ` (${item.locadora})` : ""}</span>
              ) : (
                <span className="text-emerald-300">Da empresa</span>
              )}
            </p>
            <p className="m-0 mt-0.5 text-[11px] text-white/30">
              Lançado por {item.criadoPorNome}
              {item.atualizadoPorNome ? ` · editado por ${item.atualizadoPorNome}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditando(true)} className="h-8 px-3 rounded-lg border border-white/10 text-white/80 text-xs">
              Editar
            </button>
            {master && (
              <button type="button" onClick={excluir} className="h-8 px-3 rounded-lg border border-red-500/30 text-red-300 text-xs">
                Excluir
              </button>
            )}
          </div>
        </div>
      )}
      {erro && <p className="text-xs text-red-400 mt-1 mb-0">{erro}</p>}
    </div>
  );
}

// Só Admin Master: lista de tipos de equipamento (adicionar, renomear,
// desativar). Tipo desativado some das opções, mas os lançamentos ficam.
function TiposEquipamento({ tipos, aoMudar }: { tipos: TipoEquipamento[]; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEdit, setNomeEdit] = useState("");

  const executar = async (caminho: string, opcoes: RequestInit) => {
    setErro(null);
    try {
      await apiEquipamentos(caminho, opcoes, "Não foi possível salvar.");
      aoMudar();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mt-4">
      <button type="button" onClick={() => setAberto((a) => !a)} className="w-full flex justify-between items-center text-left">
        <span className="text-sm font-bold text-white">Tipos de equipamento ({tipos.filter((t) => t.ativo).length})</span>
        <span className="text-xs text-white/50">{aberto ? "▲ fechar" : "▼ abrir"}</span>
      </button>
      {aberto && (
        <div className="mt-3">
          <p className="text-xs text-white/40 mt-0 mb-3">Só o Administrador Master vê esta parte. Tipo desativado some das opções, mas o que já foi lançado continua.</p>
          <div className="flex gap-2 mb-3">
            <input value={novo} maxLength={60} onChange={(e) => setNovo(e.target.value)} placeholder="Novo equipamento (ex.: Câmera)" className={`${campo} flex-1`} />
            <button
              type="button"
              disabled={!novo.trim()}
              onClick={async () => {
                if (await executar("/tipos", enviarJson("POST", { nome: novo.trim() }))) setNovo("");
              }}
              className="h-10 px-4 rounded-lg bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30"
            >
              Adicionar
            </button>
          </div>
          {erro && <p className="text-xs text-red-400 mt-0 mb-2">{erro}</p>}
          {tipos.map((t) => (
            <div key={t.id} className={`flex flex-wrap gap-2 items-center justify-between py-2 border-t border-white/5 ${t.ativo ? "" : "opacity-50"}`}>
              {editandoId === t.id ? (
                <div className="flex gap-2 flex-1">
                  <input value={nomeEdit} maxLength={60} onChange={(e) => setNomeEdit(e.target.value)} className={`${campo} flex-1`} />
                  <button
                    type="button"
                    disabled={!nomeEdit.trim()}
                    onClick={async () => {
                      if (await executar(`/tipos/${t.id}`, enviarJson("PATCH", { nome: nomeEdit.trim() }))) setEditandoId(null);
                    }}
                    className="h-10 px-3 rounded-lg bg-[#FF3B3B] text-white text-xs font-semibold disabled:opacity-30"
                  >
                    Salvar
                  </button>
                  <button type="button" onClick={() => setEditandoId(null)} className="h-10 px-3 rounded-lg border border-white/10 text-white/70 text-xs">
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-white">
                    {t.nome}
                    {!t.ativo && <span className="ml-2 text-xs text-white/50">(desativado)</span>}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(t.id);
                        setNomeEdit(t.nome);
                      }}
                      className="h-8 px-3 rounded-lg border border-white/10 text-white/80 text-xs"
                    >
                      Renomear
                    </button>
                    <button type="button" onClick={() => executar(`/tipos/${t.id}`, enviarJson("PATCH", { ativo: !t.ativo }))} className="h-8 px-3 rounded-lg border border-white/10 text-white/80 text-xs">
                      {t.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EquipamentosPosto() {
  const master = ehAdminMaster();
  const [condominios, setCondominios] = useState<CondominioSimples[]>([]);
  const [condominioId, setCondominioId] = useState<string | null>(null);
  const [tipos, setTipos] = useState<TipoEquipamento[]>([]);
  const [itens, setItens] = useState<EquipamentoPosto[] | null>(null);
  const [novo, setNovo] = useState<Dados>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarTipos = useCallback(async () => {
    try {
      setTipos(await apiEquipamentos<TipoEquipamento[]>(master ? "/tipos?inativos=1" : "/tipos", {}, "Não foi possível carregar os equipamentos."));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [master]);

  const carregarItens = useCallback(async (id: string) => {
    setItens(null);
    try {
      setItens(await apiEquipamentos<EquipamentoPosto[]>(`?condominioId=${encodeURIComponent(id)}`, {}, "Não foi possível carregar os itens do posto."));
    } catch (e) {
      setErro((e as Error).message);
      setItens([]);
    }
  }, []);

  useEffect(() => {
    apiEquipamentos<CondominioSimples[]>("/condominios", {}, "Não foi possível carregar os condomínios.")
      .then(setCondominios)
      .catch((e) => setErro((e as Error).message));
    carregarTipos();
  }, [carregarTipos]);

  useEffect(() => {
    if (condominioId) carregarItens(condominioId);
  }, [condominioId, carregarItens]);

  const adicionar = async () => {
    if (!condominioId || !valido(novo)) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      await apiEquipamentos("", enviarJson("POST", { condominioId, ...paraEnvio(novo) }), "Não foi possível adicionar.");
      setNovo({ ...VAZIO, dataImplantacao: novo.dataImplantacao });
      setAviso("Equipamento adicionado.");
      carregarItens(condominioId);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const resumo = useMemo(() => {
    const lista = itens ?? [];
    const soma = (f: (i: EquipamentoPosto) => boolean) => lista.filter(f).reduce((s, i) => s + i.quantidade, 0);
    return { total: soma(() => true), empresa: soma((i) => i.propriedade === "EMPRESA"), aluguel: soma((i) => i.propriedade === "ALUGUEL") };
  }, [itens]);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Equipamentos do posto</p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
            O que cada condomínio tem no posto, desde quando, quantos e se é da empresa ou alugado.
          </p>

          <SeletorCondominio condominios={condominios} valor={condominioId} onChange={setCondominioId} marginBottom={16} />

          {!condominioId && <p className="text-sm text-white/50">Escolha um condomínio para ver e lançar os equipamentos.</p>}

          {condominioId && (
            <>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
                <p className="text-sm font-bold text-white mt-0 mb-3">Adicionar equipamento</p>
                <CamposEquipamento d={novo} setD={setNovo} tipos={tipos} />
                <button
                  type="button"
                  disabled={salvando || !valido(novo)}
                  onClick={adicionar}
                  className="mt-4 h-10 px-6 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30"
                >
                  {salvando ? "Salvando..." : "Adicionar"}
                </button>
                {aviso && <p className="text-sm text-emerald-300 mt-2 mb-0">{aviso}</p>}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 pb-1 pt-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 items-baseline justify-between mb-2">
                  <p className="text-sm font-bold text-white m-0">Equipamentos no posto</p>
                  {itens && itens.length > 0 && (
                    <p className="text-xs text-white/50 m-0">
                      {resumo.total} no total · {resumo.empresa} da empresa · {resumo.aluguel} de aluguel
                    </p>
                  )}
                </div>
                {itens === null && <p className="text-sm text-white/50">Carregando...</p>}
                {itens?.length === 0 && <p className="text-sm text-white/50">Nenhum equipamento lançado neste condomínio ainda.</p>}
                {itens?.map((i) => (
                  <LinhaEquipamento key={`${i.id}-${i.atualizadoEm}`} item={i} tipos={tipos} master={master} aoMudar={() => carregarItens(condominioId)} />
                ))}
              </div>
            </>
          )}

          {erro && <p className="text-sm text-red-400 mt-3">{erro}</p>}

          {master && <TiposEquipamento tipos={tipos} aoMudar={carregarTipos} />}
        </div>
      </div>
    </div>
  );
}
