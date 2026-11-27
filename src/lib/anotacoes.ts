import { API_URL, authHeaders } from "./api";
import { mensagemErro } from "./mapaRonda";

// Anotações do condomínio (11/2026) — tipos, chamadas à API e as
// notificações no celular (Web Push) usadas pelos lembretes.

export type TipoAnotacao = "ANOTACAO" | "OCORRENCIA";
export type StatusAnotacao = "ABERTA" | "RESOLVIDA";

export interface Anotacao {
  id: string;
  condominioId: string;
  condominioNome: string;
  tipo: TipoAnotacao;
  texto: string;
  status: StatusAnotacao;
  autorNome: string;
  editadoPorNome: string | null;
  lembreteEm: string | null;
  lembreteEnviadoEm: string | null;
  resolvidoEm: string | null;
  resolvidoPorNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
  minha: boolean;
  podeEditar: boolean;
}

export const BASE_ANOTACOES = `${API_URL}/api/anotacoes`;

export async function apiAnotacoes<T>(caminho: string, opcoes: RequestInit = {}, erroPadrao = "Não foi possível concluir. Tente de novo."): Promise<T> {
  const r = await fetch(`${BASE_ANOTACOES}${caminho}`, { ...opcoes, headers: { ...authHeaders(), ...(opcoes.headers ?? {}) } });
  if (!r.ok) throw new Error(await mensagemErro(r, erroPadrao));
  return r.json();
}

export function json(metodo: string, dados: unknown): RequestInit {
  return { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) };
}

export function dataHoraBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ISO -> valor do <input type="datetime-local"> (hora do aparelho).
export function paraCampoDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Valor do campo -> ISO (ou null se vazio).
export function doCampoDataHora(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---- Notificações no celular ----

export type EstadoPush = "sem-suporte" | "instalar-iphone" | "bloqueado" | "desativado" | "ativado";

function ehIphoneOuIpad() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function abertoComoApp() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function suportaPush() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registro() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return reg ?? navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

export async function estadoPush(): Promise<EstadoPush> {
  if (ehIphoneOuIpad() && !abertoComoApp()) return "instalar-iphone";
  if (!suportaPush()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueado";
  if (Notification.permission !== "granted") return "desativado";
  try {
    const reg = await registro();
    const inscricao = await reg.pushManager.getSubscription();
    return inscricao ? "ativado" : "desativado";
  } catch {
    return "desativado";
  }
}

function chaveParaBytes(base64url: string) {
  const preenchido = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
  const bruto = atob(preenchido.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

function nomeDoAparelho() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac/.test(ua)) return "Mac";
  return "Outro";
}

// Pede a permissão (precisa ser chamado num toque/clique) e registra o aparelho.
export async function ativarPush(): Promise<void> {
  if (!suportaPush()) throw new Error("Este navegador não recebe notificações.");
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("A permissão de notificações não foi dada.");
  const { chave } = await apiAnotacoes<{ chave: string }>("/push/chave");
  const reg = await registro();
  await navigator.serviceWorker.ready;
  let inscricao = await reg.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) });
  }
  const dados = inscricao.toJSON();
  await apiAnotacoes(
    "/push/inscricao",
    json("POST", { endpoint: dados.endpoint, keys: { p256dh: dados.keys?.p256dh, auth: dados.keys?.auth }, aparelho: nomeDoAparelho() }),
    "Não foi possível ativar as notificações.",
  );
}

export async function desativarPush(): Promise<void> {
  const reg = await registro();
  const inscricao = await reg.pushManager.getSubscription();
  if (!inscricao) return;
  await apiAnotacoes("/push/remover", json("POST", { endpoint: inscricao.endpoint })).catch(() => undefined);
  await inscricao.unsubscribe();
}

export async function testarPush(): Promise<number> {
  const r = await apiAnotacoes<{ enviados: number }>("/push/teste", { method: "POST" }, "Não foi possível enviar o teste.");
  return r.enviados;
}
