import { API_URL, authHeaders } from "./api";

// Mapa de ronda (11/2026) — tipos e chamadas à API.

export interface Veiculo {
  id: string;
  modelo: string;
  placa: string;
  ativo: boolean;
  ultimoKm: number | null;
  emUsoPor: string | null;
}

export interface MapaRonda {
  id: string;
  supervisorId: string;
  supervisorNome: string;
  veiculoId: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  kmInicial: number;
  kmFinal: number | null;
  faltandoItens: boolean;
  itensFaltantes: string | null;
  avariaNova: boolean;
  avariaDescricao: string | null;
  observacao: string | null;
  iniciadoEm: string;
  encerradoEm: string | null;
  km?: number;
  qtdFotos?: number;
  fotosLinks?: string[];
  assinaturaLink?: string | null;
}

export interface LinhaKmDia {
  data: string;
  supervisorId: string;
  supervisorNome: string;
  mapas: number;
  emAberto: number;
  km: number;
  placas: string[];
}

export const BASE_MAPAS = `${API_URL}/api/mapas-ronda`;

// Lê a mensagem de erro que o servidor manda (texto ou lista).
export async function mensagemErro(r: Response, padrao: string): Promise<string> {
  try {
    const corpo = await r.json();
    const m = corpo?.message;
    if (Array.isArray(m)) return m.join(" ");
    if (typeof m === "string" && m) return m;
  } catch {
    // sem corpo legível
  }
  return padrao;
}

export async function apiMapas<T>(caminho: string, opcoes: RequestInit = {}, erroPadrao = "Não foi possível concluir. Tente de novo."): Promise<T> {
  const r = await fetch(`${BASE_MAPAS}${caminho}`, { ...opcoes, headers: { ...authHeaders(), ...(opcoes.headers ?? {}) } });
  if (!r.ok) throw new Error(await mensagemErro(r, erroPadrao));
  return r.json();
}

export function formatarPlaca(placa: string): string {
  return placa && placa.length === 7 ? `${placa.slice(0, 3)}-${placa.slice(3)}` : placa;
}

export function formatarKm(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("pt-BR");
}

export function dataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function hora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dataCurta(aaaaMmDd: string): string {
  return aaaaMmDd.split("-").reverse().join("/");
}

// Reduz a foto antes de enviar (fotos de celular passam de 5 MB): no
// máximo 1600 px no lado maior, em JPEG. Se o navegador não conseguir
// abrir a imagem, envia o arquivo original.
export async function reduzirFoto(arquivo: File): Promise<File> {
  try {
    const url = URL.createObjectURL(arquivo);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const MAX = 1600;
    const escala = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return arquivo;
    return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}
