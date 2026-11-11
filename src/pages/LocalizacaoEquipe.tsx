import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { API_URL, authHeaders } from "../lib/api";

// Localização da equipe (11/2026) — só Administrador Master. Mapa com a
// última posição de cada supervisor (enviada pelo app aberto) e o
// trajeto do dia. Atualiza sozinho a cada 1 minuto.

interface Posicao {
  latitude: number;
  longitude: number;
  precisao: number | null;
  registradoEm: string;
}
interface Supervisor {
  id: string;
  nome: string;
  telefone: string | null;
  posicao: Posicao | null;
}

const BASE = `${API_URL}/api/localizacao`;
const CENTRO_PADRAO: L.LatLngExpression = [-23.69, -46.56]; // São Bernardo do Campo

const hojeBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function minutosDesde(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}
function textoTempo(iso: string) {
  const m = minutosDesde(iso);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h ${m % 60} min`;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
// Verde: até 5 min · amarelo: até 15 min · cinza: mais antigo (app fechado).
function corDaPosicao(iso: string) {
  const m = minutosDesde(iso);
  return m <= 5 ? "#22c55e" : m <= 15 ? "#f59e0b" : "#9ca3af";
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function LocalizacaoEquipe() {
  const divMapa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camadaEquipe = useRef<L.LayerGroup | null>(null);
  const camadaTrajeto = useRef<L.LayerGroup | null>(null);
  const jaEnquadrou = useRef(false);

  const [equipe, setEquipe] = useState<Supervisor[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string>("");
  const [data, setData] = useState(hojeBrasilia());
  const [pontos, setPontos] = useState<Posicao[] | null>(null);
  const [, setRelogio] = useState(0);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!divMapa.current || mapa.current) return;
    const m = L.map(divMapa.current, { zoomControl: true }).setView(CENTRO_PADRAO, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    camadaTrajeto.current = L.layerGroup().addTo(m);
    camadaEquipe.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  const carregarEquipe = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/equipe`, { headers: authHeaders() });
      if (!r.ok) throw new Error();
      setEquipe(await r.json());
      setErro(null);
    } catch {
      setErro("Não foi possível carregar as localizações.");
    }
  }, []);

  useEffect(() => {
    carregarEquipe();
    const t = setInterval(() => {
      carregarEquipe();
      setRelogio((n) => n + 1);
    }, 60000);
    return () => clearInterval(t);
  }, [carregarEquipe]);

  // Marcadores da equipe.
  useEffect(() => {
    const m = mapa.current;
    const camada = camadaEquipe.current;
    if (!m || !camada || !equipe) return;
    camada.clearLayers();
    const comPosicao = equipe.filter((s) => s.posicao);
    for (const s of comPosicao) {
      const p = s.posicao!;
      const cor = corDaPosicao(p.registradoEm);
      L.circleMarker([p.latitude, p.longitude], { radius: 9, color: "#111", weight: 2, fillColor: cor, fillOpacity: 0.95 })
        .bindTooltip(`${s.nome.split(" ")[0]} · ${textoTempo(p.registradoEm)}`, { permanent: true, direction: "top", offset: [0, -8] })
        .on("click", () => setSelecionado(s.id))
        .addTo(camada);
    }
    if (!jaEnquadrou.current && comPosicao.length > 0) {
      jaEnquadrou.current = true;
      m.fitBounds(L.latLngBounds(comPosicao.map((s) => [s.posicao!.latitude, s.posicao!.longitude] as L.LatLngTuple)).pad(0.3), { maxZoom: 15 });
    }
  }, [equipe]);

  // Trajeto do supervisor escolhido no dia escolhido.
  useEffect(() => {
    const camada = camadaTrajeto.current;
    camada?.clearLayers();
    setPontos(null);
    if (!selecionado || !data) return;
    let ativo = true;
    fetch(`${BASE}/trajeto?usuarioId=${encodeURIComponent(selecionado)}&data=${data}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Posicao[]) => {
        if (!ativo || !camada || !mapa.current) return;
        setPontos(lista);
        if (lista.length === 0) return;
        const linha = lista.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
        L.polyline(linha, { color: "#FF3B3B", weight: 4, opacity: 0.8 }).addTo(camada);
        lista.forEach((p, i) => {
          const extremo = i === 0 || i === lista.length - 1;
          L.circleMarker([p.latitude, p.longitude], { radius: extremo ? 6 : 3, color: "#FF3B3B", weight: 1, fillColor: extremo ? "#fff" : "#FF3B3B", fillOpacity: 1 })
            .bindTooltip(`${i === 0 ? "Início " : i === lista.length - 1 ? "Último " : ""}${hora(p.registradoEm)}`)
            .addTo(camada);
        });
        mapa.current.fitBounds(L.latLngBounds(linha).pad(0.2), { maxZoom: 16 });
      })
      .catch(() => ativo && setPontos([]));
    return () => {
      ativo = false;
    };
  }, [selecionado, data]);

  const focar = (s: Supervisor) => {
    setSelecionado(s.id);
    if (s.posicao && mapa.current) mapa.current.setView([s.posicao.latitude, s.posicao.longitude], 16);
  };

  const nomeSelecionado = equipe?.find((s) => s.id === selecionado)?.nome;

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />
      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>Localização da equipe</p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 14px" }}>
            Última posição de cada supervisor enviada pelo app aberto. <span style={{ color: "#22c55e" }}>●</span> até 5 min ·{" "}
            <span style={{ color: "#f59e0b" }}>●</span> até 15 min · <span style={{ color: "#9ca3af" }}>●</span> mais antiga (app fechado). Atualiza a cada minuto.
          </p>

          {erro && <p style={{ fontSize: 13, color: "#f87171" }}>{erro}</p>}

          <div className="grid gap-4 md:grid-cols-[1fr_300px]">
            <div>
              <div ref={divMapa} style={{ height: "min(70vh, 620px)", minHeight: 360, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }} />
              {selecionado && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white">
                  <span>
                    Trajeto de <strong>{nomeSelecionado}</strong> em
                  </span>
                  <input type="date" value={data} max={hojeBrasilia()} onChange={(e) => setData(e.target.value)} className="h-9 rounded-lg bg-white/5 border border-white/10 px-2 text-sm text-white" />
                  <span className="text-white/50 text-xs">
                    {pontos === null ? "Carregando..." : pontos.length === 0 ? "Sem posições neste dia." : `${pontos.length} posições · ${hora(pontos[0].registradoEm)} às ${hora(pontos[pontos.length - 1].registradoEm)}`}
                  </span>
                  <button type="button" onClick={() => setSelecionado("")} className="text-xs text-white/60 underline">
                    Limpar trajeto
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 self-start">
              <p className="text-sm font-bold text-white m-0 mb-2">Supervisores</p>
              {equipe === null && !erro && <p className="text-xs text-white/50">Carregando...</p>}
              {equipe?.length === 0 && <p className="text-xs text-white/50">Nenhum supervisor ativo.</p>}
              <div className="divide-y divide-white/5">
                {equipe?.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => focar(s)}
                    className={`w-full text-left py-2 px-1 flex items-center gap-2 rounded ${selecionado === s.id ? "bg-white/5" : ""}`}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: s.posicao ? corDaPosicao(s.posicao.registradoEm) : "#3f3f46" }} />
                    <span className="min-w-0">
                      <span className="block text-sm text-white truncate">{s.nome}</span>
                      <span className="block text-[11px] text-white/50">{s.posicao ? textoTempo(s.posicao.registradoEm) : "ainda sem posição"}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
