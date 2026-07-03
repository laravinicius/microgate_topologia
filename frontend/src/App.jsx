import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './components/Notification';
import { PromptProvider, usePrompt } from './components/PromptModal';
import LoginScreen from './components/LoginScreen';
import CompanyScreen from './components/CompanyScreen';
import CompanyDashboard from './components/CompanyDashboard';
import Header from './components/Header';

import VinculoPanel from './components/VinculoPanel';
import DetalhesPatch from './components/DetalhesPatch';
import PublicMapViewer from './components/PublicMapViewer';
import QRCodeModal from './components/QRCodeModal';
import { api, getToken } from './api';

const MESA_LARGURA = 240;
const PONTOS_PADRAO = 8;
const MESA_ALTURA_PADRAO = 480;
const COLS = 2;
const MESA_GAP = 20;
const MESA_PADDING = 20;

function getMesaAltura(qtdPontos) {
  const pontoAltura = 48;
  const gap = 4;
  const paddingGrade = 24;
  const tituloAltura = 68;
  return Math.max(120, qtdPontos * pontoAltura + (qtdPontos - 1) * gap + paddingGrade + tituloAltura);
}

function getMesaX(col) {
  return MESA_PADDING + col * (MESA_LARGURA + MESA_GAP);
}

function checkOverlap(x1, y1, h1, x2, y2, h2) {
  if (x1 + MESA_LARGURA <= x2 || x2 + MESA_LARGURA <= x1) return false;
  if (y1 + h1 <= y2 || y2 + h2 <= y1) return false;
  return true;
}

function encontrarYLivre(col, yInicial, mesasOcupadas, h) {
  let y = yInicial;
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of mesasOcupadas) {
      const colM = Math.round((m.x - MESA_PADDING) / (MESA_LARGURA + MESA_GAP));
      if (colM !== col) continue;
      if (y + h > m.y && m.y + m.altura > y) {
        y = m.y + m.altura + MESA_GAP;
        changed = true;
      }
    }
  }
  return y;
}

function calcularPosicoes(mesas) {
  const fixadas = mesas.filter(m => m.fixada).map(m => ({
    x: m.x, y: m.y, altura: getMesaAltura(m.pontos.length), fixada: true
  }));

  const naoFixadas = mesas.filter(m => !m.fixada);
  const colY = [20, 20];
  const posicoes = [];

  for (const m of naoFixadas) {
    const col = posicoes.length % COLS;
    const h = getMesaAltura(m.pontos.length);
    let y = colY[col];

    y = encontrarYLivre(col, y, fixadas, h);

    const x = getMesaX(col);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fp of fixadas) {
        if (checkOverlap(x, y, h, fp.x, fp.y, fp.altura)) {
          y = fp.y + fp.altura + MESA_GAP;
          changed = true;
        }
      }
      for (const pp of posicoes) {
        if (checkOverlap(x, y, h, pp.x, pp.y, pp.altura)) {
          y = pp.y + pp.altura + MESA_GAP;
          changed = true;
        }
      }
    }

    colY[col] = y + h + MESA_GAP;
    posicoes.push({ x, y, altura: h });
  }

  const resultado = [];
  let naoFixIdx = 0;
  for (const m of mesas) {
    if (m.fixada) {
      resultado.push({ x: m.x, y: m.y, altura: getMesaAltura(m.pontos.length) });
    } else {
      resultado.push(posicoes[naoFixIdx++]);
    }
  }
  return resultado;
}

function AppContent() {
  const { user, loading, empresaId, empresaNome, andarId, clearAndar, clearEmpresa } = useAuth();
  const prompt = usePrompt();

  const [data, setData] = useState({ mesas: [], racks: [] });

  const [vinculo, setVinculo] = useState(null);
  const [detalhesPatch, setDetalhesPatch] = useState(null);
  const [qrcodeMesa, setQrcodeMesa] = useState(null);

  const mapaRef = useRef(null);
  const [mapaWidth, setMapaWidth] = useState(0);

  useEffect(() => {
    if (!andarId) return;
    const el = mapaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setMapaWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setMapaWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [andarId]);

  const carregarDadosServidor = useCallback(async () => {
    try {
      const res = await api.get('/api/data');
      const posicoes = calcularPosicoes(res.mesas || []);
      const mesas = (res.mesas || []).map((m, i) => {
        const pos = posicoes[i];
        return { ...m, x: pos.x, y: pos.y, _altura: pos.altura };
      });
      setData({ mesas, racks: res.racks || [], allMesas: res.allMesas || [] });
    } catch {
    }
  }, []);

  const offsetX = useMemo(() => {
    if (mapaWidth === 0 || data.mesas.length === 0) return 0;
    let maxRight = 0;
    for (const m of data.mesas) {
      const right = m.x + MESA_LARGURA;
      if (right > maxRight) maxRight = right;
    }
    const padding = 20;
    const available = mapaWidth - padding * 2;
    return Math.floor(Math.max(0, (available - maxRight) / 2));
  }, [data.mesas, mapaWidth]);

  useEffect(() => {
    if (user && empresaId && andarId) {
      carregarDadosServidor();
    }
  }, [user, empresaId, andarId, carregarDadosServidor]);

  useEffect(() => {
    if (!user) {
      setData({ mesas: [], racks: [] });
    }
  }, [user]);

  useEffect(() => {
    if (!empresaId || !user) return;
    const token = getToken();
    if (!token) return;

    const es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'update') carregarDadosServidor();
      } catch {}
    };
    return () => es.close();
  }, [empresaId, andarId, user, carregarDadosServidor]);

  const handleCriarMesa = useCallback(async () => {
    const result = await prompt.form('Nova mesa', '', [
      { key: 'nome', label: 'Nome da mesa', type: 'text', initialValue: '' },
      { key: 'qtdPontos', label: 'Quantidade de pontos', type: 'number', initialValue: '8', min: 1, max: 255 }
    ]);
    if (!result || !result.nome) return;
    const qtdPontos = Math.min(Math.max(Number(result.qtdPontos) || 8, 1), 255);
    const novaMesa = {
      id: Date.now(),
      nome: result.nome,
      x: 0, y: 0,
      fixada: false,
      pontos: Array.from({ length: qtdPontos }, (_, i) => ({ id: i + 1, rackId: null, patchId: null, porta: null, atencao: false })),
    };
    const prev = data;
    const mesas = [...prev.mesas, novaMesa];
    const posicoes = calcularPosicoes(mesas);
    const reorganizadas = mesas.map((m, i) => {
      const pos = posicoes[i];
      return { ...m, x: pos.x, y: pos.y, _altura: pos.altura };
    });
    const newData = { ...prev, mesas: reorganizadas };
    setData(newData);
    try {
      await api.put('/api/data', newData);
      await carregarDadosServidor();
    } catch {
      await carregarDadosServidor();
    }
  }, [data, prompt, carregarDadosServidor]);

  const handleRenomearMesa = useCallback(async (mesa) => {
    const result = await prompt.form('Renomear mesa', '', [
      { key: 'nome', label: 'Nome da mesa', type: 'text', initialValue: mesa.nome }
    ]);
    if (!result || !result.nome) return;
    const prev = data;
    const mesas = prev.mesas.map(m => m.id === mesa.id ? { ...m, nome: result.nome } : m);
    const newData = { ...prev, mesas };
    setData(newData);
    try {
      await api.put(`/api/mesas/${mesa.id}`, { nome: result.nome });
      await carregarDadosServidor();
    } catch {
      await carregarDadosServidor();
    }
  }, [data, prompt, carregarDadosServidor]);

  const handleApagarMesa = useCallback(async (mesa) => {
    const confirmado = await prompt.confirm('Apagar mesa', `Deseja apagar a mesa ${mesa.nome}?`);
    if (!confirmado) return;
    const prev = data;
    const mesas = prev.mesas.filter(m => m.id !== mesa.id);
    const newData = { ...prev, mesas };
    setData(newData);
    try {
      await api.put('/api/data', newData);
      await carregarDadosServidor();
    } catch {
      await carregarDadosServidor();
    }
  }, [data, prompt, carregarDadosServidor]);

  const handleIniciarVinculo = useCallback((mesaId, pontoId) => {
    const mesa = data.mesas.find(m => m.id === mesaId);
    const ponto = mesa?.pontos.find(p => p.id === pontoId);
    if (!mesa || !ponto) return;

    let etapaInicial = 'rack';
    if (ponto.rackId && ponto.patchId) etapaInicial = 'porta';
    else if (ponto.rackId) etapaInicial = 'patch';

    setVinculo({
      mesaId, pontoId,
      etapa: etapaInicial,
      rackId: ponto.rackId || null,
      patchId: ponto.patchId || null,
      ponto,
      mesaNome: mesa.nome,
      mesas: data.allMesas
    });
  }, [data]);

  const handleSelectRackVinculo = useCallback((rackId) => {
    setVinculo(prev => ({ ...prev, rackId, patchId: null, etapa: 'patch' }));
  }, []);

  const handleSelectPatchVinculo = useCallback((patchId) => {
    setVinculo(prev => ({ ...prev, patchId, etapa: 'porta' }));
  }, []);

  const handleSelectPortaVinculo = useCallback(async (porta) => {
    const current = vinculo;
    if (!current) return;
    const { mesaId, pontoId, rackId, patchId } = current;

    const portasLivres = (() => {
      const rack = data.racks.find(r => r.id === rackId);
      const pp = rack?.patchPanels.find(p => p.id === patchId);
      if (!pp) return [];
      const ocupadas = new Set();
      const todasMesas = data.allMesas || data.mesas;
      for (const m of todasMesas) {
        for (const p of m.pontos) {
          if (p.id === pontoId && m.id === mesaId) continue;
          if (p.rackId === rackId && p.patchId === patchId && p.porta) ocupadas.add(p.porta);
        }
      }
      return Array.from({ length: pp.portas }, (_, i) => i + 1).filter(p => !ocupadas.has(p));
    })();

    if (!portasLivres.includes(porta)) {
      await prompt.alert('Porta indisponível', 'Essa porta não está mais livre.');
      return;
    }

    setVinculo(null);

    const mesas = data.mesas.map(m =>
      m.id === mesaId
        ? { ...m, pontos: m.pontos.map(p => p.id === pontoId ? { ...p, rackId, patchId, porta } : p) }
        : m
    );
    const newData = { ...data, mesas };
    setData(newData);

    try {
      await api.put('/api/data', newData);
      await carregarDadosServidor();
    } catch {
      await carregarDadosServidor();
    }
  }, [data, vinculo, prompt, carregarDadosServidor]);

  const handleVoltarVinculo = useCallback(() => {
    setVinculo(prev => {
      if (prev.etapa === 'patch') return { ...prev, etapa: 'rack', rackId: null };
      if (prev.etapa === 'porta') return { ...prev, etapa: 'patch', patchId: null };
      return null;
    });
  }, []);

  const handleCancelarVinculo = useCallback(() => setVinculo(null), []);

  const handleDesvincular = useCallback(async () => {
    const current = vinculo;
    if (!current) return;
    const { mesaId, pontoId } = current;

    setVinculo(null);

    const mesas = data.mesas.map(m =>
      m.id === mesaId
        ? { ...m, pontos: m.pontos.map(p => p.id === pontoId ? { ...p, rackId: null, patchId: null, porta: null } : p) }
        : m
    );
    const newData = { ...data, mesas };
    setData(newData);

    try {
      await api.put('/api/data', newData);
      await carregarDadosServidor();
    } catch {
      await carregarDadosServidor();
    }
  }, [data, vinculo, carregarDadosServidor]);

  const handleSwitchCompany = useCallback(() => {
    sessionStorage.setItem('showCompanySelection', 'true');
    clearEmpresa();
  }, [clearEmpresa]);

  const handleAndarSelected = useCallback(() => {
    carregarDadosServidor();
  }, [carregarDadosServidor]);

  if (loading) return null;
  if (!user) return <LoginScreen />;
  if (!empresaId) {
    return <CompanyScreen />;
  }
  if (!andarId) {
    return <CompanyDashboard onAndarSelected={handleAndarSelected} onSwitchCompany={handleSwitchCompany} />;
  }

  return (
    <div id="appContainer">
      <Header
        onSwitchCompany={handleSwitchCompany}
        onVoltarAndares={clearAndar}
      />
      <div className="container">
        <main>
          <div className="mesasToolbar">
            <button id="novaMesa" onClick={handleCriarMesa}>+ Mesa</button>
          </div>
          <div id="mapa" ref={mapaRef}>
            {data.mesas.map(mesa => {
              return (
              <div
                key={mesa.id}
                className="mesa"
                style={{ left: (mesa.x + offsetX) + 'px', top: mesa.y + 'px' }}
                data-mesa-id={mesa.id}
              >
                <div className="tituloMesa">
                  <strong>{mesa.nome}</strong>
                    <div className="acoesMesa">
                      <button className="botaoAcao" onClick={() => handleRenomearMesa(mesa)}>Editar</button>
                      <button className="botaoAcao" onClick={() => setQrcodeMesa(mesa)}>QR</button>
                      <button className="botaoPerigo" onClick={() => handleApagarMesa(mesa)}>Apagar</button>
                    </div>
                </div>
                <div className="grade">
                  {mesa.pontos.map(p => {
                    const ocupado = p.rackId && p.patchId && p.porta;
                    const resumo = ocupado
                      ? (() => {
                          const rack = data.racks.find(r => r.id === p.rackId);
                          const pp = rack?.patchPanels.find(pp => pp.id === p.patchId);
                          return rack && pp ? ` | ${rack.nome} | ${pp.nome} | Porta ${p.porta}` : '';
                        })()
                      : '';
                    return (
                      <div
                        key={p.id}
                        className={`ponto${ocupado ? ' ocupado' : ''}`}
                        onClick={() => handleIniciarVinculo(mesa.id, p.id)}
                        title={resumo}
                      >
                        <span>P{p.id}</span>
                        {resumo && <small>{resumo}</small>}
                      </div>
                    );
                  })}
                </div>
               </div>
              );
            })}
          </div>
        </main>
      </div>

      {vinculo && (
        <VinculoPanel
          vinculo={vinculo}
          racks={data.racks}
          allMesas={data.allMesas}
          mesasAtuais={data.mesas}
          onSelectRack={handleSelectRackVinculo}
          onSelectPatch={handleSelectPatchVinculo}
          onSelectPorta={handleSelectPortaVinculo}
          onVoltar={handleVoltarVinculo}
          onCancelar={handleCancelarVinculo}
          onDesvincular={handleDesvincular}
        />
      )}

      {detalhesPatch && (
        <DetalhesPatch
          detalhes={detalhesPatch}
          racks={data.racks}
          onClose={() => setDetalhesPatch(null)}
        />
      )}

      {qrcodeMesa && (
        <QRCodeModal
          mesa={qrcodeMesa}
          empresaSlug={empresaNome}
          andarId={andarId}
          onClose={() => setQrcodeMesa(null)}
        />
      )}
    </div>
  );
}

function PublicRouteDetector({ children }) {
  const [publicEmpresa, setPublicEmpresa] = useState(null);
  const [publicMesaId, setPublicMesaId] = useState(null);
  const [publicAndarId, setPublicAndarId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/([^/]+)$/);
    if (!match) {
      setReady(true);
      return;
    }
    const slug = match[1];
    const reserved = ['mesa', 'api', 'img'];
    if (reserved.includes(slug)) {
      setReady(true);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const mesaParam = params.get('mesa');
    const andarParam = params.get('andar');
    if (mesaParam) setPublicMesaId(Number(mesaParam));
    if (andarParam) setPublicAndarId(Number(andarParam));
    fetch(`/api/public/empresa?nome=${encodeURIComponent(slug)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPublicEmpresa(data.empresa.nome);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (publicEmpresa) {
    return <PublicMapViewer empresaSlug={publicEmpresa} mesaId={publicMesaId} andarId={publicAndarId} />;
  }
  return children;
}

export default function App() {
  return (
    <NotificationProvider>
      <PromptProvider>
        <PublicRouteDetector>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </PublicRouteDetector>
      </PromptProvider>
    </NotificationProvider>
  );
}
