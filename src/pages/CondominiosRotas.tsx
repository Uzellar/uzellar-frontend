import { useEffect, useMemo, useState } from "react";
import { API_URL, authHeaders } from "../lib/api";
import NavAdmin from "../components/NavAdmin";
import { CORES, FONTES } from "../theme";
import { CondominioRota, linkGoogleMaps, linkRotaGoogleMaps, linkWaze, montarRotas } from "../lib/rotas";

// Aba "Condomínios e rotas" (10/11/2026): os condomínios liberados para
// quem está logado (o Admin Master vê todos), com endereço e atalhos
// para Google Maps e Waze, agrupados em rotas de condomínios próximos.

const estiloBotao = (cor: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  color: "#fff",
  background: cor,
  whiteSpace: "nowrap",
});

function CartaoCondominio({ c, ordem }: { c: CondominioRota; ordem?: number }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0" }}>
      {ordem !== undefined && (
        <span
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,59,59,0.15)",
            color: "#FF3B3B",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {ordem}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: CORES.texto }}>{c.nome}</p>
        <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#9a9a9a", wordBreak: "break-word" }}>{c.endereco}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={linkGoogleMaps(c)} target="_blank" rel="noopener noreferrer" style={estiloBotao("#2563eb")}>
            Google Maps
          </a>
          <a href={linkWaze(c)} target="_blank" rel="noopener noreferrer" style={estiloBotao("#0891b2")}>
            Waze
          </a>
        </div>
      </div>
    </div>
  );
}

export default function CondominiosRotas() {
  const [condominios, setCondominios] = useState<CondominioRota[] | null>(null);
  const [localizando, setLocalizando] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const carregar = async () => {
      try {
        const r = await fetch(`${API_URL}/api/condominios/rotas`, { headers: authHeaders() });
        if (!r.ok) throw new Error();
        const dados = await r.json();
        if (!ativo) return;
        setCondominios(dados.condominios ?? []);
        setLocalizando(dados.localizando ?? 0);
        setErro(null);
        // Enquanto o servidor ainda localiza endereços, atualiza sozinho.
        if ((dados.localizando ?? 0) > 0) espera = setTimeout(carregar, 20_000);
      } catch {
        if (ativo) setErro("Não foi possível carregar os condomínios. Tente de novo.");
      }
    };
    carregar();
    return () => {
      ativo = false;
      if (espera) clearTimeout(espera);
    };
  }, []);

  const { rotas, semLocalizacao } = useMemo(() => montarRotas(condominios ?? []), [condominios]);

  const termo = busca
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  const combina = (c: CondominioRota) =>
    !termo ||
    `${c.nome} ${c.endereco}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .includes(termo);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex" }}>
      <NavAdmin />

      <div style={{ flex: 1, padding: "2rem 1rem", minWidth: 0 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: CORES.texto, margin: 0, fontFamily: FONTES.titulo, letterSpacing: "-0.02em" }}>
            Condomínios e rotas
          </p>
          <p style={{ fontSize: 12, color: "#8a8a8a", margin: "4px 0 16px" }}>
            Condomínios próximos ficam na mesma rota, na ordem para ir de um ao outro. Toque em Google Maps ou Waze para abrir o caminho.
          </p>

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar condomínio ou endereço"
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: 40,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              padding: "0 12px",
              fontSize: 13,
              marginBottom: 16,
            }}
          />

          {localizando > 0 && (
            <p style={{ fontSize: 12, color: "#fbbf24", margin: "0 0 14px" }}>
              Localizando {localizando} endereço(s) no mapa… a lista se atualiza sozinha em instantes.
            </p>
          )}

          {erro && <p style={{ fontSize: 13, color: "#f87171" }}>{erro}</p>}
          {!erro && condominios === null && <p style={{ fontSize: 13, color: "#8a8a8a" }}>Carregando...</p>}
          {condominios !== null && condominios.length === 0 && (
            <p style={{ fontSize: 13, color: "#8a8a8a" }}>Nenhum condomínio liberado para você.</p>
          )}

          {rotas.map((rota) => {
            const visiveis = rota.paradas.filter(combina);
            if (visiveis.length === 0) return null;
            const totalKm = rota.trechosKm.reduce((s, d) => s + d, 0);
            return (
              <section key={rota.titulo} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: CORES.texto }}>{rota.titulo}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8a8a8a" }}>
                      {rota.paradas.length} condomínio(s)
                      {rota.paradas.length > 1 ? ` · cerca de ${totalKm.toFixed(1).replace(".", ",")} km em linha reta` : ""}
                      {rota.bairros.length > 0 ? ` · ${rota.bairros.join(", ")}` : ""}
                    </p>
                  </div>
                  {rota.paradas.length > 1 && (
                    <a href={linkRotaGoogleMaps(rota.paradas)} target="_blank" rel="noopener noreferrer" style={estiloBotao("#FF3B3B")}>
                      Rota completa no Maps
                    </a>
                  )}
                </div>
                <div>
                  {rota.paradas.map((c, i) =>
                    combina(c) ? (
                      <div key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <CartaoCondominio c={c} ordem={i + 1} />
                        {i < rota.trechosKm.length && !termo && (
                          <p style={{ margin: "-4px 0 4px 38px", fontSize: 11, color: "#666" }}>
                            ↓ {rota.trechosKm[i].toFixed(1).replace(".", ",")} km até o próximo
                          </p>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            );
          })}

          {semLocalizacao.filter(combina).length > 0 && (
            <section style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: CORES.texto }}>Sem localização no mapa</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8a8a8a" }}>
                {localizando > 0 ? "Ainda sendo localizados." : "O endereço não foi encontrado no mapa — confira o cadastro."} Os botões abrem pelo endereço.
              </p>
              {semLocalizacao.filter(combina).map((c) => (
                <div key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <CartaoCondominio c={c} />
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
