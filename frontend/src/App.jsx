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
const PONTOS_PADRAO = 8;
const MESA_ALTURA_PADRAO = 480;
const COLS = 2;

function getMesaAltura(qtdPontos) {
  const pontoAltura = 52;
  const padding = 20;
  const tituloAltura = 48;
  return Math.max(120, Math.round(qtdPontos * pontoAltura + padding + tituloAltura));
}

function calcularPosicoes(mesas) {
  const colY = [20, 20];
  return mesas.map((m, i) => {
    const col = i % COLS;
    const h = getMesaAltura(m.pontos.length);
    const y = colY[col];
    colY[col] = y + h + 20;
    return {
      x: 20 + col * (MESA_LARGURA + 20),
      y,
      altura: h,
    };
  });
}

function AppContent() {
  const { user, loading, empresaId, andarId, clearAndar, clearEmpresa } = useAuth();
  const prompt = usePrompt();

  const [data, setData] = useState({ mesas: [], racks: [] });

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
      const posicoes = calcularPosicoes(res.mesas || []);
      const mesas = (res.mesas || []).map((m, i) => {
        if (!m.fixada) {
          const pos = posicoes[i];
          return { ...m, x: pos.x, y: pos.y, _altura: pos.altura };
        }
        return { ...m, _altura: getMesaAltura(m.pontos.length) };
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
      pontos: Array.from({ length: qtdPontos }, (_, i) => ({ id: i + 1, rackId: null, patchId: null, porta: null }))
    };
    const prev = data;
    const mesas = [...prev.mesas, novaMesa];
    const posicoes = calcularPosicoes(mesas);
    const reorganizadas = mesas.map((m, i) => {
      if (!m.fixada) {
        const pos = posicoes[i];
        return { ...m, x: pos.x, y: pos.y, _altura: pos.altura };
      }
      return { ...m, _altura: getMesaAltura(m.pontos.length) };
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
              const altura = mesa._altura || getMesaAltura(mesa.pontos.length);
              return (
              <div
                key={mesa.id}
                className="mesa"
                style={{ left: (mesa.x + offsetX) + 'px', top: mesa.y + 'px', height: altura + 'px' }}
                data-mesa-id={mesa.id}
              >
                <div className="tituloMesa">
                  <strong>{mesa.nome}</strong>
                  <div className="acoesMesa">
                    <button className="botaoAcao" onClick={() => handleRenomearMesa(mesa)}>Editar</button>
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
