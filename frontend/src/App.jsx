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
import { api, getToken } from './api';

const MESA_LARGURA = 240;
const MESA_ALTURA = 480;
const COLS = 2;

function calcularPosicaoGrelha(indice) {
  const col = indice % COLS;
  const row = Math.floor(indice / COLS);
  return { x: 20 + col * (MESA_LARGURA + 20), y: 20 + row * (MESA_ALTURA + 20) };
}

function AppContent() {
  const { user, loading, empresaId, andarId, clearAndar, clearEmpresa } = useAuth();
  const prompt = usePrompt();

  const [data, setData] = useState({ mesas: [], racks: [] });
  const [syncing, setSyncing] = useState(false);
  const [vinculo, setVinculo] = useState(null);
  const [detalhesPatch, setDetalhesPatch] = useState(null);

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
      const mesas = (res.mesas || []).map((m, i) => {
        if (!m.fixada) {
          const pos = calcularPosicaoGrelha(i);
          return { ...m, x: pos.x, y: pos.y };
        }
        return m;
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

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await carregarDadosServidor();
    setSyncing(false);
  }, [carregarDadosServidor]);

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
    const nome = await prompt.text('Nova mesa', 'Nome da mesa');
    if (!nome) return;
    const novaMesa = {
      id: Date.now(),
      nome,
      x: 0, y: 0,
      fixada: true,
      pontos: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, rackId: null, patchId: null, porta: null }))
    };
    setData(prev => {
      const mesas = [...prev.mesas, novaMesa];
      const reorganizadas = mesas.map((m, i) => {
        if (!m.fixada) {
          const pos = calcularPosicaoGrelha(i);
          return { ...m, x: pos.x, y: pos.y };
        }
        return m;
      });
      const newData = { ...prev, mesas: reorganizadas };
      api.put('/api/data', newData);
      return newData;
    });
  }, [prompt]);

  const handleApagarMesa = useCallback(async (mesa) => {
    const confirmado = await prompt.confirm('Apagar mesa', `Deseja apagar a mesa ${mesa.nome}?`);
    if (!confirmado) return;
    setData(prev => {
      const mesas = prev.mesas.filter(m => m.id !== mesa.id);
      const newData = { ...prev, mesas };
      api.put('/api/data', newData);
      return newData;
    });
  }, [prompt]);


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

  const handleSelectPortaVinculo = useCallback((porta) => {
    setVinculo(prev => {
      const { mesaId, pontoId, rackId, patchId } = prev;

      const portasLivres = (() => {
        const rack = data.racks.find(r => r.id === rackId);
        const pp = rack?.patchPanels.find(p => p.id === patchId);
        if (!pp) return [];
        const ocupadas = new Set();
        for (const m of data.allMesas) {
          for (const p of m.pontos) {
            if (p.id === pontoId && m.id === mesaId) continue;
            if (p.rackId === rackId && p.patchId === patchId && p.porta) ocupadas.add(p.porta);
          }
        }
        return Array.from({ length: pp.portas }, (_, i) => i + 1).filter(p => !ocupadas.has(p));
      })();

      if (!portasLivres.includes(porta)) {
        prompt.alert('Porta indisponível', 'Essa porta não está mais livre.');
        return prev;
      }

      setData(d => {
        const mesas = d.mesas.map(m =>
          m.id === mesaId
            ? { ...m, pontos: m.pontos.map(p => p.id === pontoId ? { ...p, rackId, patchId, porta } : p) }
            : m
        );
        const newData = { ...d, mesas };
        api.put('/api/data', newData);
        return newData;
      });

      return null;
    });
  }, [data, prompt]);

  const handleVoltarVinculo = useCallback(() => {
    setVinculo(prev => {
      if (prev.etapa === 'patch') return { ...prev, etapa: 'rack', rackId: null };
      if (prev.etapa === 'porta') return { ...prev, etapa: 'patch', patchId: null };
      return null;
    });
  }, []);

  const handleCancelarVinculo = useCallback(() => setVinculo(null), []);

  const handleDesvincular = useCallback(() => {
    setVinculo(prev => {
      if (!prev) return null;
      setData(d => {
        const mesas = d.mesas.map(m =>
          m.id === prev.mesaId
            ? { ...m, pontos: m.pontos.map(p => p.id === prev.pontoId ? { ...p, rackId: null, patchId: null, porta: null } : p) }
            : m
        );
        const newData = { ...d, mesas };
        api.put('/api/data', newData);
        return newData;
      });
      return null;
    });
  }, []);

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
        onSync={handleSync}
        syncing={syncing}
        onSwitchCompany={handleSwitchCompany}
        onVoltarAndares={clearAndar}
      />
      <div className="container">
        <main>
          <div className="mesasToolbar">
            <button id="novaMesa" onClick={handleCriarMesa}>+ Mesa</button>
          </div>
          <div id="mapa" ref={mapaRef}>
            {data.mesas.map(mesa => (
              <div
                key={mesa.id}
                className="mesa"
                style={{ left: (mesa.x + offsetX) + 'px', top: mesa.y + 'px' }}
                data-mesa-id={mesa.id}
              >
                <div className="tituloMesa">
                  <strong>{mesa.nome}</strong>
                  <div className="acoesMesa">
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
            ))}
          </div>
        </main>
      </div>

      {vinculo && (
        <VinculoPanel
          vinculo={vinculo}
          racks={data.racks}
          allMesas={data.allMesas}
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
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <PromptProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PromptProvider>
    </NotificationProvider>
  );
}
