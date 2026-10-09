// Endereço do backend. Em produção, definido pela variável de ambiente
// VITE_API_URL (configurada na Vercel/Netlify); em desenvolvimento local,
// cai no endereço padrão do NestJS rodando na sua máquina.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export function getToken(): string | null {
  return localStorage.getItem('uzellar_token');
}

export function setToken(token: string) {
  localStorage.setItem('uzellar_token', token);
}

// Perfil do usuário logado (ex: "ADMIN_MASTER") — usado pra decidir
// quais telas/abas aparecem pra cada um. Guardado separado do token
// pra não precisar decodificar o JWT no navegador toda vez.
export function getPerfil(): string | null {
  return localStorage.getItem('uzellar_perfil');
}

export function setPerfil(perfil: string) {
  localStorage.setItem('uzellar_perfil', perfil);
}

export function ehAdminMaster(): boolean {
  return getPerfil() === 'ADMIN_MASTER';
}

// Confere se o perfil de quem está logado está entre os informados —
// usado pra abas que mais de um perfil pode acessar (ex: Admin Master
// e Admin do Condomínio, no caso de Relatórios).
export function perfilEstaEm(...perfis: string[]): boolean {
  const atual = getPerfil();
  return atual !== null && perfis.includes(atual);
}

export function limparToken() {
  localStorage.removeItem('uzellar_token');
  localStorage.removeItem('uzellar_perfil');
}

// Quando o login vence (8h) ou o acesso da pessoa é encerrado, a API
// responde 401 — antes, as telas ficavam presas em "Carregando...".
// Agora qualquer 401 vindo da API (com a pessoa logada) limpa o login
// e volta pra tela de entrada.
let interceptadorInstalado = false;
export function instalarTratamentoDeLoginVencido() {
  if (interceptadorInstalado || typeof window === 'undefined') return;
  interceptadorInstalado = true;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const resposta = await fetchOriginal(...args);
    const endereco = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request).url;
    const ehApi = endereco.startsWith(API_URL) && !endereco.includes('/api/auth/login');
    if (resposta.status === 401 && ehApi && getToken()) {
      limparToken();
      window.location.hash = '#/login';
    }
    return resposta;
  };
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
