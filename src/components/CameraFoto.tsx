import { useEffect, useRef, useState } from "react";

// Câmera dentro do próprio Uzellar (11/2026). Abrir a câmera do celular
// por <input capture> tira o app da tela; em muitos Android o sistema
// fecha o app instalado para liberar memória e o formulário se perde.
// Aqui a foto é tirada sem sair do app. Cada foto sai em JPEG com no
// máximo 1600 px no lado maior (mesmo padrão de reduzirFoto).

const LADO_MAX = 1600;

export default function CameraFoto({
  onFoto,
  onFechar,
  restantes,
}: {
  onFoto: (arquivo: File) => void;
  onFechar: () => void;
  restantes: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let encerrado = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro("Este navegador não permite usar a câmera dentro do app. Use \"Galeria\".");
        return;
      }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (encerrado) {
          fluxo.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = fluxo;
        video.setAttribute("playsinline", "true");
        await video.play();
        setPronta(true);
      } catch {
        setErro("Não foi possível abrir a câmera. Permita o acesso à câmera nas configurações do navegador, ou use \"Galeria\".");
      }
    })();
    return () => {
      encerrado = true;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capturar = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || restantes <= 0) return;
    const escala = Math.min(1, LADO_MAX / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onFoto(new File([blob], `avaria-${Date.now()}.jpg`, { type: "image/jpeg" }));
        setFlash(true);
        setTimeout(() => setFlash(false), 150);
      },
      "image/jpeg",
      0.82,
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {erro ? (
          <div className="h-full flex items-center justify-center p-6">
            <p className="text-sm text-red-400 text-center">{erro}</p>
          </div>
        ) : (
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        )}
        {flash && <div className="absolute inset-0 bg-white/60 pointer-events-none" />}
        {!erro && (
          <p className="absolute top-3 left-0 right-0 text-center text-xs text-white/80">
            {restantes > 0 ? `Pode tirar mais ${restantes} foto(s)` : "Limite de fotos atingido"}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-6 py-5 bg-black" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
        <button type="button" onClick={onFechar} className="h-11 px-5 rounded-full border border-white/30 text-white text-sm font-semibold">
          Concluir
        </button>
        <button
          type="button"
          onClick={capturar}
          disabled={!pronta || restantes <= 0}
          aria-label="Tirar foto"
          className="w-16 h-16 rounded-full bg-white border-4 border-white/40 disabled:opacity-30"
        />
        <span className="w-[88px]" />
      </div>
    </div>
  );
}
