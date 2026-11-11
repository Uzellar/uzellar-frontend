import { useEffect, useRef, useState } from "react";
import { API_URL, authHeaders, getPerfil, getToken } from "../lib/api";

// Localização da equipe (11/2026): no app do SUPERVISOR (celular
// corporativo), enquanto o Uzellar está aberto, envia a posição a cada
// 1 minuto. Antes, mostra uma única vez o aviso de acompanhamento
// (exigência da LGPD) e registra o "Entendi". Nada fica fixo na tela.

const INTERVALO_ENVIO_MS = 60 * 1000;
const BASE = `${API_URL}/api/localizacao`;

function ehSupervisorLogado() {
  return !!getToken() && getPerfil() === "SUPERVISOR";
}

export default function RastreioLocalizacao() {
  const [logado, setLogado] = useState(ehSupervisorLogado);
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const ultimaPosicao = useRef<GeolocationPosition | null>(null);

  // O login/saída acontece trocando de tela: reavalia a cada mudança.
  useEffect(() => {
    const reavaliar = () => setLogado(ehSupervisorLogado());
    window.addEventListener("hashchange", reavaliar);
    window.addEventListener("storage", reavaliar);
    const t = setInterval(reavaliar, 15000);
    return () => {
      window.removeEventListener("hashchange", reavaliar);
      window.removeEventListener("storage", reavaliar);
      clearInterval(t);
    };
  }, []);

  // Pergunta ao servidor se deve acompanhar e se precisa do aviso.
  useEffect(() => {
    setAtivo(false);
    setMostrarAviso(false);
    if (!logado) return;
    let cancelado = false;
    fetch(`${BASE}/status`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (cancelado || !s?.acompanhar) return;
        if (s.precisaAviso) setMostrarAviso(true);
        else setAtivo(true);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [logado]);

  // Acompanha a posição e envia a cada minuto (só com o app na tela).
  useEffect(() => {
    if (!ativo || !("geolocation" in navigator)) return;
    let ultimoEnvio = 0;
    const enviar = (forcar = false) => {
      const p = ultimaPosicao.current;
      if (!p || document.visibilityState !== "visible" || !getToken()) return;
      if (!forcar && Date.now() - ultimoEnvio < INTERVALO_ENVIO_MS - 2000) return;
      ultimoEnvio = Date.now();
      fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          ...(Number.isFinite(p.coords.accuracy) ? { precisao: Math.round(p.coords.accuracy) } : {}),
        }),
      }).catch(() => {});
    };
    let primeira = true;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        ultimaPosicao.current = pos;
        if (primeira) {
          primeira = false;
          enviar(true);
        }
      },
      () => {
        // sem permissão ou sem sinal: tenta de novo quando o celular liberar
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 },
    );
    const t = setInterval(() => enviar(), INTERVALO_ENVIO_MS);
    const aoVoltar = () => document.visibilityState === "visible" && enviar(true);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ativo]);

  const entendi = async () => {
    try {
      await fetch(`${BASE}/aceite`, { method: "POST", headers: authHeaders() });
    } catch {
      // se falhar, o aviso volta na próxima abertura
    }
    setMostrarAviso(false);
    setAtivo(true);
  };

  if (!mostrarAviso) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 20, color: "#fff" }}>
        <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Localização durante o uso</p>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "#cfcfcf" }}>
          Enquanto o Uzellar estiver aberto neste celular, sua localização é enviada à gestão da Ulrik para acompanhamento operacional da supervisão.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8a8a8a" }}>Se o celular perguntar, permita o acesso à localização.</p>
        <button
          type="button"
          onClick={entendi}
          style={{ marginTop: 18, width: "100%", height: 46, borderRadius: 999, border: "none", background: "#FF3B3B", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
