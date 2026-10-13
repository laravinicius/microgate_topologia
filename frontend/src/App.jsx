import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './components/Notification';
import { PromptProvider, usePrompt } from './components/PromptModal';
import LoginScreen from './components/LoginScreen';
import CompanyScreen from './components/CompanyScreen';
import CompanyDashboard from './components/CompanyDashboard';
import Administracao from './components/Administracao';
import AuthenticatedShell from './components/AuthenticatedShell';

import VinculoPanel from './components/VinculoPanel';
import PublicMapViewer from './components/PublicMapViewer';
import QRCodeModal from './components/QRCodeModal';
import { api, getToken } from './api';
import { DEMO_DATA } from './data/demoData';

function AppContent() {
  const { user, isAdmin, loading, empresaId, empresaNome, andarId, andarNome, clearAndar, clearEmpresa, logout } = useAuth();
  const prompt = usePrompt();

  const [showAdmin, setShowAdmin] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [data, setData] = useState({ mesas: [], racks: [] });
  const [dataStatus, setDataStatus] = useState('idle');
  const [dataContext, setDataContext] = useState(null);
  const currentDataContext = empresaId && andarId ? `${empresaId}:${andarId}` : null;
  const visibleDataStatus = dataContext === currentDataContext ? dataStatus : 'loading';

  const [vinculo, setVinculo] = useState(null);
  const [qrcodeMesa, setQrcodeMesa] = useState(null);
  const dataRequestRef = useRef(0);

  const carregarDadosServidor = useCallback(async () => {
    const requestId = ++dataRequestRef.current;
    if (!empresaId || !andarId) {
      setData({ mesas: [], racks: [] });
      setDataContext(null);
      setDataStatus('idle');
      return;
    }

    setDataContext(`${empresaId}:${andarId}`);
    setDataStatus('loading');
    try {
      const res = await api.get('/api/data');
      if (requestId !== dataRequestRef.current) return;
      if (!res.success) throw new Error(res.message || 'Falha ao carregar dados do andar.');
      setData({ mesas: res.mesas || [], racks: res.racks || [], allMesas: res.allMesas || [] });
      setDataStatus('ready');
    } catch {
      if (requestId !== dataRequestRef.current) return;
      setData({ mesas: [], racks: [], allMesas: [] });
      setDataStatus('error');
    }
  }, [empresaId, andarId]);

  useEffect(() => {
    setData({ mesas: [], racks: [], allMesas: [] });
    setVinculo(null);
    setQrcodeMesa(null);
    carregarDadosServidor();
  }, [empresaId, andarId, carregarDadosServidor]);

  useEffect(() => {
    if (!user) {
      setData({ mesas: [], racks: [] });
    }
  }, [user]);

  useEffect(() => {
    if (!empresaId || !andarId || !user) return;
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
    const newData = { ...prev, mesas };
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
    clearEmpresa();
  }, [clearEmpresa]);

  if (loading) return null;
  if (!user && demoMode) {
    return <CompanyDashboard isViewer demoData={DEMO_DATA} onSwitchCompany={() => setDemoMode(false)} />;
  }
  if (!user) return <LoginScreen onDemo={() => setDemoMode(true)} />;
  if (showAdmin && isAdmin) return <Administracao onVoltar={() => setShowAdmin(false)} />;
  if (!empresaId) {
    return <CompanyScreen onOpenAdmin={() => setShowAdmin(true)} />;
  }
  if (!isAdmin) {
    return <CompanyDashboard isViewer onSwitchCompany={handleSwitchCompany} />;
  }
  if (!andarId) {
    return <CompanyDashboard onSwitchCompany={handleSwitchCompany} onOpenAdmin={() => setShowAdmin(true)} />;
  }

  return (
    <AuthenticatedShell
      title={andarNome || 'Mapa'}
      context={empresaNome || 'Empresa'}
      items={[
        { label: 'Andares', onClick: clearAndar },
        { label: 'Trocar empresa', onClick: handleSwitchCompany }
      ]}
      accountItems={[
        { label: 'Administração', onClick: () => setShowAdmin(true) },
        { label: 'Sair', onClick: logout, danger: true }
      ]}
      className="map-canvas-shell"
    >
    <div id="appContainer">
      <div className="container">
        <main>
          {visibleDataStatus === 'loading' ? (
            <p className="empty-message" role="status">Carregando mesas e pontos de {andarNome || 'este andar'}…</p>
          ) : visibleDataStatus === 'error' ? (
            <div className="empty-message" role="alert">
              <p>Não foi possível carregar os dados deste andar.</p>
              <button type="button" onClick={carregarDadosServidor}>Tentar novamente</button>
            </div>
          ) : visibleDataStatus === 'ready' && data.mesas.length === 0 ? (
            <p className="empty-message" role="status">Nenhuma mesa cadastrada em {andarNome || 'este andar'}.</p>
          ) : null}
          {visibleDataStatus === 'ready' && <div className="mesasToolbar">
            <button id="novaMesa" onClick={handleCriarMesa}>+ Mesa</button>
          </div>}
          {visibleDataStatus === 'ready' && <div id="mapa">
            {data.mesas.map(mesa => {
              return (
              <div
                key={mesa.id}
                className="mesa"
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
          </div>}
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

      {qrcodeMesa && (
        <QRCodeModal
          mesa={qrcodeMesa}
          empresaSlug={empresaNome}
          andarId={andarId}
          onClose={() => setQrcodeMesa(null)}
        />
      )}
    </div>
    </AuthenticatedShell>
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
