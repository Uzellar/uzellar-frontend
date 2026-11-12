import { useCallback, useEffect, useRef, useState } from "react";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { API_URL, authHeaders, ehAdminMaster } from "../lib/api";
import { mensagemErro } from "../lib/mapaRonda";

// Material de apoio (11/2026). O Administrador Master cria pastas,
// escolhe quem vê (todos os supervisores ou alguns) e envia arquivos.
// O supervisor vê só as pastas liberadas para ele, abre e baixa; o que
// ele ainda não abriu aparece como "Novo".

const BASE = `${API_URL}/api/material-apoio`;
const TAMANHO_MAXIMO = 50 * 1024 * 1024;
const ACEITOS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.m4v,.mov,.webm";

const campo =
  "h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60";

interface Pasta {
  id: string;
  nome: string;
  descricao: string | null;
  todosSupervisores?: boolean;
  usuarioIds?: string[];
  totalArquivos: number;
  novos: number;
}

interface Arquivo {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  criadoEm: string;
  novo: boolean;
  visualizacoes?: number;
}

interface Supervisor {
  id: string;
  nome: string;
}

async function api<T>(caminho: string, opcoes: RequestInit = {}, erroPadrao = "Não foi possível concluir. Tente de novo."): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, { ...opcoes, headers: { ...authHeaders(), ...(opcoes.headers ?? {}) } });
  if (!r.ok) throw new Error(await mensagemErro(r, erroPadrao));
  return r.json();
}

function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function icone(tipo: string) {
  if (tipo.includes("pdf")) return "📕";
  if (tipo.startsWith("image/")) return "🖼️";
  if (tipo.startsWith("video/")) return "🎬";
  if (tipo.includes("sheet") || tipo.includes("excel") || tipo.includes("csv")) return "📊";
  if (tipo.includes("presentation") || tipo.includes("powerpoint")) return "📽️";
  if (tipo.includes("word")) return "📝";
  return "📄";
}

// Abre o arquivo numa aba nova. A aba é aberta ANTES de buscar o link
// (o celular bloqueia janela aberta depois de esperar a internet).
async function abrirArquivo(arquivo: Arquivo): Promise<void> {
  const janela = window.open("", "_blank");
  try {
    const { url } = await api<{ url: string }>(`/arquivos/${arquivo.id}/link`, {}, "Não foi possível abrir o arquivo.");
    if (janela) janela.location.href = url;
    else window.location.href = url;
  } catch (e) {
    janela?.close();
    throw e;
  }
}

function Selo({ texto }: { texto: string }) {
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-white bg-[#FF3B3B] rounded-full px-2 py-0.5 ml-2 align-middle">
      {texto}
    </span>
  );
}

// ---------- Formulário de pasta (Master) ----------

function FormPasta({
  supervisores,
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  supervisores: Supervisor[];
  inicial?: Pasta;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [todos, setTodos] = useState(inicial?.todosSupervisores ?? true);
  const [escolhidos, setEscolhidos] = useState<string[]>(inicial?.usuarioIds ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const alternar = (id: string) => setEscolhidos((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const salvar = async () => {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome da pasta.");
    if (!todos && escolhidos.length === 0) return setErro("Escolha pelo menos um supervisor.");
    setSalvando(true);
    try {
      const corpo = JSON.stringify({ nome: nome.trim(), descricao: descricao.trim(), todosSupervisores: todos, usuarioIds: todos ? [] : escolhidos });
      await api(inicial ? `/pastas/${inicial.id}` : "/pastas", { method: inicial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: corpo }, "Não foi possível salvar a pasta.");
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
      <p className="text-sm font-bold text-white mt-0 mb-3">{inicial ? "Editar pasta" : "Nova pasta"}</p>
      <div className="flex flex-col gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Nome da pasta (ex.: Procedimentos de limpeza)" className={campo} />
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} placeholder="Descrição (opcional)" className={campo} />
        <p className="text-xs text-white/60 mt-2 mb-0">Quem pode ver esta pasta?</p>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="radio" checked={todos} onChange={() => setTodos(true)} /> Todos os supervisores
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="radio" checked={!todos} onChange={() => setTodos(false)} /> Escolher supervisores
        </label>
        {!todos && (
          <div className="flex flex-wrap gap-2 pl-6">
            {supervisores.length === 0 && <p className="text-xs text-white/50 m-0">Nenhum supervisor ativo cadastrado.</p>}
            {supervisores.map((s) => {
              const marcado = escolhidos.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => alternar(s.id)}
                  className={`h-9 px-3 rounded-full text-sm border ${marcado ? "bg-[#FF3B3B]/15 border-[#FF3B3B]/60 text-white" : "border-white/10 text-white/70"}`}
                >
                  {marcado ? "✓ " : ""}
                  {s.nome}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button type="button" disabled={salvando} onClick={salvar} className="h-10 px-5 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <button type="button" onClick={aoCancelar} className="h-10 px-4 rounded-full border border-white/10 text-white/70 text-sm">
            Cancelar
          </button>
        </div>
        {erro && <p className="text-sm text-red-400 m-0">{erro}</p>}
      </div>
    </div>
  );
}

// ---------- Envio de arquivos (Master) ----------

// Um arquivo por vez, com barra de progresso (XMLHttpRequest, porque o
// fetch não informa o andamento do envio).
function enviarComProgresso(pastaId: string, arquivo: File, aoProgresso: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/pastas/${pastaId}/arquivos`);
    const cab = authHeaders();
    Object.entries(cab).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoProgresso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Não foi possível enviar.";
      try {
        const corpo = JSON.parse(xhr.responseText);
        if (xhr.status === 413) msg = "Arquivo maior que 50 MB.";
        else if (Array.isArray(corpo?.message)) msg = corpo.message.join(" ");
        else if (typeof corpo?.message === "string") msg = corpo.message;
      } catch {
        // sem corpo legível
      }
      if (xhr.status === 401) window.location.hash = "#/login";
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("Falha de conexão ao enviar."));
    const dados = new FormData();
    dados.append("arquivo", arquivo);
    xhr.send(dados);
  });
}

function EnvioArquivos({ pastaId, aoTerminar }: { pastaId: string; aoTerminar: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [fila, setFila] = useState<{ nome: string; progresso: number; erro?: string; ok?: boolean }[]>([]);
  const [enviando, setEnviando] = useState(false);

  const escolher = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const arquivos = Array.from(lista);
    setFila(arquivos.map((a) => ({ nome: a.name, progresso: 0 })));
    setEnviando(true);
    for (let i = 0; i < arquivos.length; i++) {
      const a = arquivos[i];
      const atualizar = (dados: Partial<{ progresso: number; erro: string; ok: boolean }>) =>
        setFila((f) => f.map((item, j) => (j === i ? { ...item, ...dados } : item)));
      if (a.size > TAMANHO_MAXIMO) {
        atualizar({ erro: "Maior que 50 MB — não enviado." });
        continue;
      }
      try {
        await enviarComProgresso(pastaId, a, (p) => atualizar({ progresso: p }));
        atualizar({ progresso: 100, ok: true });
      } catch (e) {
        atualizar({ erro: (e as Error).message });
      }
    }
    setEnviando(false);
    if (entrada.current) entrada.current.value = "";
    aoTerminar();
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={enviando}
          onClick={() => entrada.current?.click()}
          className="h-10 px-5 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30"
        >
          {enviando ? "Enviando..." : "⬆ Enviar arquivos"}
        </button>
        <span className="text-xs text-white/50">PDF, Word, Excel, PowerPoint, imagens e vídeos · até 50 MB cada</span>
        <input ref={entrada} type="file" multiple accept={ACEITOS} className="hidden" onChange={(e) => escolher(e.target.files)} />
      </div>
      {fila.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {fila.map((f, i) => (
            <div key={i}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="text-white/80 truncate">{f.nome}</span>
                <span className={f.erro ? "text-red-400" : f.ok ? "text-green-400" : "text-white/60"}>
                  {f.erro ? f.erro : f.ok ? "Enviado" : `${f.progresso}%`}
                </span>
              </div>
              {!f.erro && (
                <div className="h-1.5 rounded bg-white/10 mt-1">
                  <div className="h-1.5 rounded bg-[#FF3B3B]" style={{ width: `${f.progresso}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Tela ----------

export default function MaterialApoio() {
  const master = ehAdminMaster();
  const [pastas, setPastas] = useState<Pasta[] | null>(null);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
  const [pastaAberta, setPastaAberta] = useState<Pasta | null>(null);
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null);
  const [formulario, setFormulario] = useState<"nova" | "editar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregarPastas = useCallback(async () => {
    try {
      setPastas(await api<Pasta[]>("/pastas", {}, "Não foi possível carregar as pastas."));
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  const carregarArquivos = useCallback(async (pastaId: string) => {
    try {
      const r = await api<{ arquivos: Arquivo[] }>(`/pastas/${pastaId}/arquivos`, {}, "Não foi possível carregar os arquivos.");
      setArquivos(r.arquivos);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregarPastas();
    if (master) api<Supervisor[]>("/supervisores").then(setSupervisores).catch(() => setSupervisores([]));
  }, [carregarPastas, master]);

  const abrirPasta = (p: Pasta) => {
    setErro(null);
    setFormulario(null);
    setArquivos(null);
    setPastaAberta(p);
    carregarArquivos(p.id);
  };

  const voltar = () => {
    setPastaAberta(null);
    setArquivos(null);
    setFormulario(null);
    setErro(null);
    carregarPastas();
  };

  const abrir = async (a: Arquivo) => {
    setErro(null);
    try {
      await abrirArquivo(a);
      if (a.novo) setArquivos((l) => l?.map((x) => (x.id === a.id ? { ...x, novo: false } : x)) ?? l);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const excluirArquivo = async (a: Arquivo) => {
    if (!window.confirm(`Excluir o arquivo "${a.nome}"? Os supervisores deixam de ver na hora.`)) return;
    try {
      await api(`/arquivos/${a.id}`, { method: "DELETE" }, "Não foi possível excluir.");
      if (pastaAberta) carregarArquivos(pastaAberta.id);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const excluirPasta = async () => {
    if (!pastaAberta) return;
    const qtd = arquivos?.length ?? 0;
    if (!window.confirm(`Excluir a pasta "${pastaAberta.nome}"${qtd ? ` e os ${qtd} arquivo(s) dela` : ""}? Não dá para desfazer.`)) return;
    try {
      await api(`/pastas/${pastaAberta.id}`, { method: "DELETE" }, "Não foi possível excluir a pasta.");
      voltar();
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const nomesQueVeem = (p: Pasta) => {
    if (p.todosSupervisores) return "Todos os supervisores";
    const nomes = (p.usuarioIds ?? []).map((id) => supervisores.find((s) => s.id === id)?.nome).filter(Boolean);
    return nomes.length ? nomes.join(", ") : "Supervisores escolhidos";
  };

  return (
    <div style={{ background: CORES.fundo, minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {!pastaAberta ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Material de apoio</p>
                  <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
                    {master ? "Pastas e arquivos para os supervisores abrirem e baixarem." : "Materiais enviados pela administração. Toque no arquivo para abrir ou baixar."}
                  </p>
                </div>
                {master && formulario === null && (
                  <button type="button" onClick={() => setFormulario("nova")} className="h-10 px-5 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold">
                    + Nova pasta
                  </button>
                )}
              </div>

              {master && formulario === "nova" && (
                <FormPasta
                  supervisores={supervisores}
                  aoCancelar={() => setFormulario(null)}
                  aoSalvar={() => {
                    setFormulario(null);
                    carregarPastas();
                  }}
                />
              )}

              {erro && <p className="text-sm text-red-400">{erro}</p>}
              {pastas === null && !erro && <p className="text-sm text-white/50">Carregando...</p>}
              {pastas?.length === 0 && (
                <p className="text-sm text-white/50">{master ? "Nenhuma pasta criada ainda. Use \"+ Nova pasta\"." : "Nenhum material disponível para você ainda."}</p>
              )}

              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {pastas?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => abrirPasta(p)}
                    className="text-left rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/25"
                  >
                    <p className="m-0 text-sm font-bold text-white">
                      📁 {p.nome}
                      {p.novos > 0 && <Selo texto={`${p.novos} novo${p.novos > 1 ? "s" : ""}`} />}
                    </p>
                    {p.descricao && <p className="m-0 mt-1 text-xs text-white/60">{p.descricao}</p>}
                    <p className="m-0 mt-2 text-xs text-white/40">
                      {p.totalArquivos} arquivo{p.totalArquivos === 1 ? "" : "s"}
                      {master ? ` · ${nomesQueVeem(p)}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={voltar} className="text-sm text-white/60 mb-3 bg-transparent border-0 p-0 cursor-pointer">
                ← Voltar para as pastas
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p style={{ fontSize: 20, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo }}>📁 {pastaAberta.nome}</p>
                  {pastaAberta.descricao && <p className="m-0 mt-1 text-xs text-white/60">{pastaAberta.descricao}</p>}
                  {master && <p className="m-0 mt-1 text-xs text-white/40">Quem vê: {nomesQueVeem(pastaAberta)}</p>}
                </div>
                {master && formulario === null && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormulario("editar")} className="h-9 px-3 rounded-lg border border-white/10 text-white/80 text-xs">
                      Editar pasta
                    </button>
                    <button type="button" onClick={excluirPasta} className="h-9 px-3 rounded-lg border border-red-500/40 text-red-300 text-xs">
                      Excluir pasta
                    </button>
                  </div>
                )}
              </div>

              {master && formulario === "editar" && (
                <FormPasta
                  supervisores={supervisores}
                  inicial={pastaAberta}
                  aoCancelar={() => setFormulario(null)}
                  aoSalvar={async () => {
                    setFormulario(null);
                    const lista = await api<Pasta[]>("/pastas").catch(() => null);
                    if (lista) {
                      setPastas(lista);
                      const atual = lista.find((x) => x.id === pastaAberta.id);
                      if (atual) setPastaAberta(atual);
                    }
                  }}
                />
              )}

              {master && <EnvioArquivos pastaId={pastaAberta.id} aoTerminar={() => carregarArquivos(pastaAberta.id)} />}

              {erro && <p className="text-sm text-red-400">{erro}</p>}

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 pb-1 pt-3">
                {arquivos === null && !erro && <p className="text-sm text-white/50">Carregando...</p>}
                {arquivos?.length === 0 && <p className="text-sm text-white/50">Nenhum arquivo nesta pasta ainda.</p>}
                {arquivos?.map((a) => (
                  <div key={a.id} className="py-3 border-t border-white/5 first:border-t-0 flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={() => abrir(a)} className="min-w-0 flex-1 text-left bg-transparent border-0 p-0 cursor-pointer">
                      <p className="m-0 text-sm font-semibold text-white break-words">
                        {icone(a.tipo)} {a.nome}
                        {a.novo && <Selo texto="Novo" />}
                      </p>
                      <p className="m-0 text-xs text-white/40">
                        {tamanhoLegivel(a.tamanho)} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}
                        {master && a.visualizacoes !== undefined ? ` · aberto por ${a.visualizacoes} supervisor${a.visualizacoes === 1 ? "" : "es"}` : ""}
                      </p>
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => abrir(a)} className="h-8 px-3 rounded-lg bg-white/10 text-white text-xs font-semibold">
                        Abrir / baixar
                      </button>
                      {master && (
                        <button type="button" onClick={() => excluirArquivo(a)} className="h-8 px-3 rounded-lg border border-red-500/40 text-red-300 text-xs">
                          Excluir
                        </button>
                      )}
                    </div>
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
