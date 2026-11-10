import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsQR from "jsqr";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";

// "Registrar visita" (10/11/2026): o supervisor logado abre a câmera
// dentro do Uzellar e lê o QR Code de VISITA impresso no condomínio.
// O QR contém o endereço .../#/visita/<id do condomínio>; ao ler, abre
// o formulário da visita daquele condomínio.

function idDaVisita(texto: string): string | null {
  const achado = texto.match(/\/visita\/([A-Za-z0-9_-]+)/);
  return achado ? achado[1] : null;
}

export default function LerQrVisita() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let quadro = 0;
    let encerrado = false;
    setErro(null);

    const ler = () => {
      if (encerrado) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const largura = Math.min(video.videoWidth, 720);
        const altura = Math.round((video.videoHeight * largura) / video.videoWidth);
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, largura, altura);
          const imagem = ctx.getImageData(0, 0, largura, altura);
          const codigo = jsQR(imagem.data, largura, altura, { inversionAttempts: "dontInvert" });
          if (codigo?.data) {
            const id = idDaVisita(codigo.data);
            if (id) {
              encerrado = true;
              navigate(`/visita/${id}`);
              return;
            }
            setAviso(
              codigo.data.includes("/atender/")
                ? "Esse é o QR Code dos condôminos. Leia o QR Code de VISITA da supervisão."
                : "Esse QR Code não é de visita da supervisão.",
            );
          }
        }
      }
      quadro = requestAnimationFrame(ler);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro("Este navegador não permite usar a câmera. Abra o Uzellar no Chrome ou Safari atualizado.");
        return;
      }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (encerrado) {
          fluxo.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = fluxo;
        video.setAttribute("playsinline", "true");
        await video.play();
        quadro = requestAnimationFrame(ler);
      } catch {
        setErro("Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador e tente de novo.");
      }
    })();

    return () => {
      encerrado = true;
      cancelAnimationFrame(quadro);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, [navigate, tentativa]);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            Registrar visita
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
            Aponte a câmera para o QR Code de visita da supervisão, fixado no condomínio.
          </p>

          {erro ? (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "1.1rem" }}>
              <p style={{ fontSize: 13, color: "#f87171", margin: "0 0 12px" }}>{erro}</p>
              <button
                type="button"
                onClick={() => setTentativa((n) => n + 1)}
                style={{ height: 38, padding: "0 16px", borderRadius: 8, background: "#FF3B3B", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                Tentar de novo
              </button>
            </div>
          ) : (
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "3 / 4" }}>
              <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div
                style={{
                  position: "absolute",
                  inset: "18%",
                  border: "3px solid rgba(255,59,59,0.85)",
                  borderRadius: 16,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

          {aviso && !erro && <p style={{ fontSize: 13, color: "#fbbf24", margin: "12px 0 0" }}>{aviso}</p>}

          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      </div>
    </div>
  );
}
