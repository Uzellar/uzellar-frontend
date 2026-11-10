// Agrupamento dos condomínios em rotas (aba "Condomínios e rotas",
// 10/11/2026). Junta os condomínios próximos (todos dentro de um raio
// de DIAMETRO_MAX_KM entre si) e ordena cada rota pelo vizinho mais
// próximo, para o supervisor ir de um ao outro.

export interface CondominioRota {
  id: string;
  nome: string;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Rota {
  titulo: string;
  bairros: string[];
  paradas: CondominioRota[];
  // distância em km de cada parada até a próxima (mesmo tamanho - 1)
  trechosKm: number[];
}

const DIAMETRO_MAX_KM = 6;

export function distanciaKm(a: CondominioRota, b: CondominioRota): number {
  const r = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad((b.latitude as number) - (a.latitude as number));
  const dLon = rad((b.longitude as number) - (a.longitude as number));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude as number)) * Math.cos(rad(b.latitude as number)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

// "Rua X, 10 - Bairro, Cidade - SP, CEP" → cidade e bairro (quando der).
export function cidadeDe(endereco: string): string | null {
  const achados = [...endereco.matchAll(/,\s*([^,\-]+?)\s*[-–]\s*SP\b/gi)];
  if (achados.length > 0) return achados[achados.length - 1][1].trim();
  return null;
}

export function bairroDe(endereco: string): string | null {
  const m = endereco.match(/\d+[A-Za-z]?\s*[-–]\s*([^,\-–]+?)\s*,/);
  return m ? m[1].trim() : null;
}

// Cidades da rota, da que tem mais condomínios para a que tem menos (até 2).
function cidadesDe(paradas: CondominioRota[]): string | null {
  const contagem = new Map<string, number>();
  for (const p of paradas) {
    const c = cidadeDe(p.endereco);
    if (c) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  }
  const ordem = [...contagem.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
  if (ordem.length === 0) return null;
  return ordem.slice(0, 2).join(" / ") + (ordem.length > 2 ? " e região" : "");
}

function ordenarPorVizinho(grupo: CondominioRota[]): CondominioRota[] {
  if (grupo.length <= 2) return grupo;
  const latM = grupo.reduce((s, c) => s + (c.latitude as number), 0) / grupo.length;
  const lonM = grupo.reduce((s, c) => s + (c.longitude as number), 0) / grupo.length;
  const centro = { latitude: latM, longitude: lonM } as CondominioRota;
  // Começa pela ponta (o mais longe do centro) e vai sempre ao mais próximo.
  const restantes = [...grupo];
  restantes.sort((a, b) => distanciaKm(b, centro) - distanciaKm(a, centro));
  const ordem = [restantes.shift() as CondominioRota];
  while (restantes.length > 0) {
    const atual = ordem[ordem.length - 1];
    let indice = 0;
    for (let i = 1; i < restantes.length; i++) {
      if (distanciaKm(atual, restantes[i]) < distanciaKm(atual, restantes[indice])) indice = i;
    }
    ordem.push(restantes.splice(indice, 1)[0]);
  }
  return ordem;
}

export function montarRotas(condominios: CondominioRota[]): { rotas: Rota[]; semLocalizacao: CondominioRota[] } {
  const comCoordenadas = condominios.filter((c) => c.latitude !== null && c.longitude !== null);
  const semLocalizacao = condominios.filter((c) => c.latitude === null || c.longitude === null);

  // Agrupamento: junta sempre os dois grupos mais próximos, desde que
  // todos os condomínios do grupo resultante fiquem a até DIAMETRO_MAX_KM.
  let grupos: CondominioRota[][] = comCoordenadas.map((c) => [c]);
  const diametro = (a: CondominioRota[], b: CondominioRota[]) => {
    let max = 0;
    for (const x of a) for (const y of b) max = Math.max(max, distanciaKm(x, y));
    return max;
  };
  for (;;) {
    let melhor: [number, number, number] | null = null;
    for (let i = 0; i < grupos.length; i++) {
      for (let j = i + 1; j < grupos.length; j++) {
        const d = diametro(grupos[i], grupos[j]);
        if (d <= DIAMETRO_MAX_KM && (!melhor || d < melhor[2])) melhor = [i, j, d];
      }
    }
    if (!melhor) break;
    const [i, j] = melhor;
    grupos[i] = [...grupos[i], ...grupos[j]];
    grupos = grupos.filter((_, k) => k !== j);
  }

  const rotas = grupos
    .map((g) => ordenarPorVizinho(g))
    .sort((a, b) => b.length - a.length || (cidadeDe(a[0].endereco) ?? "").localeCompare(cidadeDe(b[0].endereco) ?? ""))
    .map((paradas, i) => {
      const cidade = cidadesDe(paradas);
      const bairros = [...new Set(paradas.map((p) => bairroDe(p.endereco)).filter((b): b is string => !!b))];
      const trechosKm = paradas.slice(1).map((p, k) => distanciaKm(paradas[k], p));
      return { titulo: `Rota ${i + 1}${cidade ? ` · ${cidade}` : ""}`, bairros, paradas, trechosKm };
    });

  return { rotas, semLocalizacao };
}

export function linkGoogleMaps(c: CondominioRota): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.endereco)}`;
}

export function linkWaze(c: CondominioRota): string {
  if (c.latitude !== null && c.longitude !== null) {
    return `https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(c.endereco)}&navigate=yes`;
}

// Rota inteira no Google Maps, saindo de onde o supervisor está.
// O Google aceita até 9 paradas intermediárias.
export function linkRotaGoogleMaps(paradas: CondominioRota[]): string {
  const lista = paradas.slice(0, 10);
  const destino = lista[lista.length - 1];
  const meio = lista.slice(0, -1).map((p) => p.endereco);
  let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destino.endereco)}`;
  if (meio.length > 0) url += `&waypoints=${encodeURIComponent(meio.join("|"))}`;
  return url;
}
