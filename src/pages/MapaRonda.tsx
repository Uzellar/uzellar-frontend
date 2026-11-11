import { useCallback, useEffect, useRef, useState } from "react";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import CameraFoto from "../components/CameraFoto";
import { apagarRascunho, gravarCampos, gravarFotos, lerCampos, lerFotos } from "../lib/rascunhoMapa";
import { MapaRonda as Mapa, Veiculo, apiMapas, dataCurta, formatarKm, formatarPlaca, hora, reduzirFoto } from "../lib/mapaRonda";

// Mapa de ronda (11/2026) — supervisor do setor Privado.
// Em 2 momentos: no início do turno abre o mapa (veículo, KM inicial,
// itens faltando, avaria nova com fotos); no fim informa o KM final e
// assina. O KM do dia é a soma de todos os mapas encerrados no dia.

interface Resumo {
  nome: string;
  hoje: string;
  aberto: Mapa | null;
  mapasHoje: Mapa[];
  kmHoje: number;
}

const MAX_FOTOS = 6;

const cartao = "rounded-xl border border-white/10 bg-white/[0.03] p-4";
const rotulo = "block text-sm font-medium text-white mb-1.5";
const campo =
  "w-full h-11 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60";
const areaTexto =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3B3B]/60";

function SimNao({ valor, onMudar, rotuloPergunta }: { valor: boolean | null; onMudar: (v: boolean) => void; rotuloPergunta: string }) {
  return (
    <div>
      <span className={rotulo}>{rotuloPergunta}</span>
      <div className="flex gap-2">
        {[
          { v: false, t: "Não" },
          { v: true, t: "Sim" },
        ].map((o) => (
          <button
            key={o.t}
            type="button"
            onClick={() => onMudar(o.v)}
            className={`flex-1 h-11 rounded-lg text-sm font-semibold border ${
              valor === o.v ? (o.v ? "bg-[#FF3B3B]/15 border-[#FF3B3B]/60 text-white" : "bg-white/10 border-white/40 text-white") : "bg-white/[0.03] border-white/10 text-white/60"
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

// Assinatura com o dedo ou mouse. O desenho interno acompanha o tamanho
// real na tela (sem traço "deslocado" em telas de tamanhos diferentes).
function CampoAssinatura({ onMudar }: { onMudar: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const inicio = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = ponto(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = ponto(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const fim = () => {
    if (!desenhando.current) return;
    desenhando.current = false;
    // Gera a imagem com fundo branco (o canvas em si é transparente).
    const canvas = ref.current!;
    const saida = document.createElement("canvas");
    saida.width = canvas.width;
    saida.height = canvas.height;
    const ctx = saida.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, saida.width, saida.height);
    ctx.drawImage(canvas, 0, 0);
    onMudar(saida.toDataURL("image/png"));
  };
  const limpar = () => {
    const canvas = ref.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    onMudar(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-white">Assinatura do supervisor</span>
        <button type="button" onClick={limpar} className="text-xs text-white/50">
          Limpar
        </button>
      </div>
      <canvas
        ref={ref}
        className="w-full h-36 rounded-lg border border-white/15 bg-white touch-none"
        onPointerDown={inicio}
        onPointerMove={mover}
        onPointerUp={fim}
        onPointerCancel={fim}
        onPointerLeave={fim}
      />
      <p className="text-[11px] text-white/40 mt-1">Assine com o dedo (ou mouse) dentro do quadro.</p>
    </div>
  );
}

function FormAbrir({ aoAbrir }: { aoAbrir: () => void }) {
  const [veiculos, setVeiculos] = useState<Veiculo[] | null>(null);
  // Rascunho salvo no celular (o app pode ser fechado pelo sistema).
  const [rascunho] = useState(() => lerCampos());
  const [veiculoId, setVeiculoId] = useState(rascunho?.veiculoId ?? "");
  const [kmInicial, setKmInicial] = useState(rascunho?.kmInicial ?? "");
  const [faltando, setFaltando] = useState<boolean | null>(rascunho?.faltando ?? null);
  const [itens, setItens] = useState(rascunho?.itens ?? "");
  const [avaria, setAvaria] = useState<boolean | null>(rascunho?.avaria ?? null);
  const [avariaDesc, setAvariaDesc] = useState(rascunho?.avariaDesc ?? "");
  const [fotos, setFotos] = useState<{ arquivo: File; preview: string }[]>([]);
  const [cameraAberta, setCameraAberta] = useState(false);
  const fotosCarregadas = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiMapas<Veiculo[]>("/veiculos", {}, "Não foi possível carregar os veículos.")
      .then(setVeiculos)
      .catch((e) => setErro(e.message));
  }, []);

  // Recupera as fotos do rascunho (se houver) e depois passa a guardar.
  useEffect(() => {
    lerFotos().then((salvas) => {
      if (salvas.length > 0) setFotos(salvas.slice(0, MAX_FOTOS).map((arquivo) => ({ arquivo, preview: URL.createObjectURL(arquivo) })));
      fotosCarregadas.current = true;
    });
  }, []);
  useEffect(() => {
    if (fotosCarregadas.current) gravarFotos(fotos.map((f) => f.arquivo));
  }, [fotos]);
  useEffect(() => {
    const algo = veiculoId || kmInicial || faltando !== null || avaria !== null || itens || avariaDesc;
    if (algo) gravarCampos({ veiculoId, kmInicial, faltando, itens, avaria, avariaDesc });
  }, [veiculoId, kmInicial, faltando, itens, avaria, avariaDesc]);

  // Libera as prévias das fotos só ao sair da tela.
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const veiculo = veiculos?.find((v) => v.id === veiculoId);
  const kmNumero = kmInicial === "" ? null : Number(kmInicial);
  const kmAbaixoDoUltimo = veiculo?.ultimoKm != null && kmNumero != null && kmNumero < veiculo.ultimoKm;

  const adicionarFotos = async (lista: FileList | null) => {
    if (!lista) return;
    const espaco = MAX_FOTOS - fotos.length;
    const novas = Array.from(lista).slice(0, espaco);
    const reduzidas = await Promise.all(novas.map(reduzirFoto));
    setFotos((atual) => [...atual, ...reduzidas.map((arquivo) => ({ arquivo, preview: URL.createObjectURL(arquivo) }))]);
  };

  const pode =
    !!veiculoId &&
    kmNumero != null &&
    Number.isInteger(kmNumero) &&
    kmNumero >= 0 &&
    faltando !== null &&
    (!faltando || itens.trim().length > 0) &&
    avaria !== null &&
    (!avaria || avariaDesc.trim().length > 0) &&
    !enviando;

  const enviar = async () => {
    if (!pode) return;
    setEnviando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("veiculoId", veiculoId);
      form.append("kmInicial", String(kmNumero));
      form.append("faltandoItens", String(faltando));
      if (faltando) form.append("itensFaltantes", itens.trim());
      form.append("avariaNova", String(avaria));
      if (avaria) {
        form.append("avariaDescricao", avariaDesc.trim());
        fotos.forEach((f) => form.append("fotos", f.arquivo));
      }
      await apiMapas("", { method: "POST", body: form }, "Não foi possível abrir o mapa. Tente de novo.");
      apagarRascunho();
      aoAbrir();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`${cartao} space-y-5`}>
      <div>
        <p className="text-base font-bold text-white m-0">Abrir mapa de ronda</p>
        <p className="text-xs text-white/50 mt-1 mb-0">Preencha no início do turno, antes de sair com o veículo.</p>
        {rascunho && <p className="text-xs text-amber-400 mt-1.5 mb-0">Continuando o que você já tinha preenchido neste celular.</p>}
      </div>

      <div>
        <label className={rotulo} htmlFor="veiculo">
          Veículo (modelo e placa)
        </label>
        <select id="veiculo" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={campo}>
          <option value="">{veiculos === null ? "Carregando..." : veiculos.length === 0 ? "Nenhum veículo cadastrado" : "Escolha o veículo"}</option>
          {(veiculos ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.modelo} — {formatarPlaca(v.placa)}
            </option>
          ))}
        </select>
        {veiculos !== null && veiculos.length === 0 && (
          <p className="text-xs text-amber-400 mt-1.5">Peça ao administrador para cadastrar os veículos.</p>
        )}
        {veiculo && (
          <div className="text-xs text-white/50 mt-1.5 space-y-0.5">
            <p className="m-0">Modelo: {veiculo.modelo} · Placa: {formatarPlaca(veiculo.placa)}</p>
            {veiculo.ultimoKm != null && <p className="m-0">Último KM registrado: {formatarKm(veiculo.ultimoKm)}</p>}
            {veiculo.emUsoPor && <p className="m-0 text-amber-400">Atenção: há um mapa aberto com este veículo ({veiculo.emUsoPor}).</p>}
          </div>
        )}
      </div>

      <div>
        <label className={rotulo} htmlFor="kmInicial">
          KM inicial
        </label>
        <input
          id="kmInicial"
          inputMode="numeric"
          value={kmInicial}
          onChange={(e) => setKmInicial(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder="Ex.: 45230"
          className={campo}
        />
        {kmAbaixoDoUltimo && (
          <p className="text-xs text-amber-400 mt-1.5">O KM informado é menor que o último registrado ({formatarKm(veiculo!.ultimoKm)}). Confira o painel.</p>
        )}
      </div>

      <SimNao rotuloPergunta="Faltando itens?" valor={faltando} onMudar={setFaltando} />
      {faltando && (
        <div>
          <label className={rotulo} htmlFor="itens">
            Quais itens estão faltando?
          </label>
          <textarea id="itens" rows={3} value={itens} onChange={(e) => setItens(e.target.value)} placeholder="Ex.: triângulo, extintor, documento" className={areaTexto} />
        </div>
      )}

      <SimNao rotuloPergunta="Alguma avaria nova?" valor={avaria} onMudar={setAvaria} />
      {avaria && (
        <div className="space-y-3">
          <div>
            <label className={rotulo} htmlFor="avaria">
              Descreva a avaria
            </label>
            <textarea id="avaria" rows={3} value={avariaDesc} onChange={(e) => setAvariaDesc(e.target.value)} placeholder="Ex.: risco na porta traseira direita" className={areaTexto} />
          </div>
          <div>
            <span className={rotulo}>
              Fotos da avaria <span className="text-white/40 font-normal">(opcional, até {MAX_FOTOS})</span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, i) => (
                <div key={f.preview} className="relative">
                  <img src={f.preview} alt={`Foto ${i + 1}`} className="w-full h-24 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(f.preview);
                      setFotos((atual) => atual.filter((_, j) => j !== i));
                    }}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs"
                    aria-label="Remover foto"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {fotos.length < MAX_FOTOS && (
                <div className="h-24 grid grid-rows-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCameraAberta(true)}
                    className="rounded-lg bg-[#FF3B3B]/15 border border-[#FF3B3B]/50 text-white text-xs font-semibold"
                  >
                    📷 Câmera
                  </button>
                  <label className="rounded-lg border border-dashed border-white/20 flex items-center justify-center text-white/60 text-xs cursor-pointer">
                    Galeria
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        adicionarFotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {cameraAberta && (
        <CameraFoto
          restantes={MAX_FOTOS - fotos.length}
          onFoto={(arquivo) =>
            setFotos((atual) => (atual.length >= MAX_FOTOS ? atual : [...atual, { arquivo, preview: URL.createObjectURL(arquivo) }]))
          }
          onFechar={() => setCameraAberta(false)}
        />
      )}

      {erro && <p className="text-sm text-red-400 m-0">{erro}</p>}

      <button
        type="button"
        disabled={!pode}
        onClick={enviar}
        className="w-full h-12 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {enviando ? "Abrindo..." : "Abrir mapa"}
      </button>
    </div>
  );
}

function FormEncerrar({ mapa, aoEncerrar }: { mapa: Mapa; aoEncerrar: () => void }) {
  const [kmFinal, setKmFinal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const kmNumero = kmFinal === "" ? null : Number(kmFinal);
  const percorrido = kmNumero != null ? kmNumero - mapa.kmInicial : null;
  const kmValido = percorrido != null && percorrido >= 0;
  const pode = kmValido && !!assinatura && !enviando;

  const enviar = async () => {
    if (!pode) return;
    setEnviando(true);
    setErro(null);
    try {
      await apiMapas(
        `/${mapa.id}/encerrar`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kmFinal: kmNumero, assinatura, ...(observacao.trim() ? { observacao: observacao.trim() } : {}) }),
        },
        "Não foi possível encerrar o mapa. Tente de novo.",
      );
      aoEncerrar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`${cartao} space-y-5`}>
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <p className="text-base font-bold text-white m-0">Mapa aberto às {hora(mapa.iniciadoEm)}</p>
        </div>
        <p className="text-xs text-white/50 mt-1 mb-0">
          {mapa.veiculoModelo} · {formatarPlaca(mapa.veiculoPlaca)} · KM inicial {formatarKm(mapa.kmInicial)}
        </p>
        <div className="text-xs text-white/60 mt-2 space-y-0.5">
          <p className="m-0">Faltando itens: {mapa.faltandoItens ? `Sim — ${mapa.itensFaltantes}` : "Não"}</p>
          <p className="m-0">Avaria nova: {mapa.avariaNova ? `Sim — ${mapa.avariaDescricao}` : "Não"}</p>
        </div>
        {mapa.fotosLinks && mapa.fotosLinks.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {mapa.fotosLinks.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Avaria ${i + 1}`} className="w-16 h-16 object-cover rounded-md" />
              </a>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-white/50 m-0 border-t border-white/10 pt-4">No fim do turno, informe o KM final e assine para encerrar.</p>

      <div>
        <label className={rotulo} htmlFor="kmFinal">
          KM final
        </label>
        <input
          id="kmFinal"
          inputMode="numeric"
          value={kmFinal}
          onChange={(e) => setKmFinal(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder={`Maior ou igual a ${formatarKm(mapa.kmInicial)}`}
          className={campo}
        />
        {percorrido != null &&
          (kmValido ? (
            <p className="text-sm text-white mt-2">
              KM percorrido neste mapa: <strong>{formatarKm(percorrido)} km</strong>
            </p>
          ) : (
            <p className="text-xs text-red-400 mt-1.5">O KM final não pode ser menor que o inicial ({formatarKm(mapa.kmInicial)}).</p>
          ))}
      </div>

      <div>
        <label className={rotulo} htmlFor="obs">
          Observação <span className="text-white/40 font-normal">(opcional)</span>
        </label>
        <textarea id="obs" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={areaTexto} />
      </div>

      <CampoAssinatura onMudar={setAssinatura} />

      {erro && <p className="text-sm text-red-400 m-0">{erro}</p>}

      <button
        type="button"
        disabled={!pode}
        onClick={enviar}
        className="w-full h-12 rounded-full bg-[#FF3B3B] text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {enviando ? "Encerrando..." : "Encerrar mapa"}
      </button>
    </div>
  );
}

export default function MapaRonda() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setResumo(await apiMapas<Resumo>("/meu", {}, "Não foi possível carregar o mapa de ronda."));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const depois = (mensagem: string) => {
    setAviso(mensagem);
    window.scrollTo({ top: 0, behavior: "smooth" });
    carregar();
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }} className="space-y-4">
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Mapa de ronda</p>
            <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 0" }}>
              {resumo ? `${resumo.nome} · ${dataCurta(resumo.hoje)}` : "Controle do veículo da ronda"}
            </p>
          </div>

          {aviso && (
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300 flex justify-between gap-3">
              <span>{aviso}</span>
              <button type="button" onClick={() => setAviso(null)} className="text-emerald-300/70">
                ✕
              </button>
            </div>
          )}

          {erro && <p className="text-sm text-red-400">{erro}</p>}
          {!erro && !resumo && <p className="text-sm text-white/50">Carregando...</p>}

          {resumo &&
            (resumo.aberto ? (
              <FormEncerrar key={resumo.aberto.id} mapa={resumo.aberto} aoEncerrar={() => depois("Mapa encerrado. Obrigado!")} />
            ) : (
              <FormAbrir key={resumo.mapasHoje.length} aoAbrir={() => depois("Mapa aberto. Boa ronda!")} />
            ))}

          {resumo && (
            <div className={cartao}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold text-white m-0">Hoje</p>
                <p className="text-sm text-white m-0">
                  KM total do dia: <strong className="text-lg">{formatarKm(resumo.kmHoje)}</strong>
                </p>
              </div>
              {resumo.mapasHoje.length === 0 ? (
                <p className="text-xs text-white/50 mt-2 mb-0">Nenhum mapa hoje ainda.</p>
              ) : (
                <div className="mt-2 divide-y divide-white/5">
                  {resumo.mapasHoje.map((m) => (
                    <div key={m.id} className="py-2 flex justify-between gap-3 text-xs">
                      <span className="text-white/70">
                        {hora(m.iniciadoEm)}–{m.encerradoEm ? hora(m.encerradoEm) : "aberto"} · {formatarPlaca(m.veiculoPlaca)}
                        <br />
                        <span className="text-white/40">
                          KM {formatarKm(m.kmInicial)} → {m.encerradoEm ? formatarKm(m.kmFinal) : "…"}
                        </span>
                      </span>
                      <span className="text-white font-semibold whitespace-nowrap">{m.encerradoEm ? `${formatarKm(m.km)} km` : "em andamento"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
