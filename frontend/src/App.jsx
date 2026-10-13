import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotification } from './components/Notification';
import { PromptProvider, usePrompt } from './components/PromptModal';
import LoginScreen from './components/LoginScreen';
import CompanyScreen from './components/CompanyScreen';
import CompanyDashboard from './components/CompanyDashboard';
import Administracao from './components/Administracao';
import AuthenticatedShell from './components/AuthenticatedShell';
import MapEditor from './components/MapEditor';
import QRCodeBatchPrint from './components/QRCodeBatchPrint';

import VinculoPanel from './components/VinculoPanel';
import PublicMapViewer from './components/PublicMapViewer';
import QRCodeModal from './components/QRCodeModal';
import { api, getToken, requireSuccess } from './api';
import { DEMO_DATA } from './data/demoData';

function AppContent() {
  const { user, isAdmin, loading, empresaId, empresaNome, andarId, andarNome, selectAndar, logout } = useAuth();
  const prompt = usePrompt();
  const { error: showError } = useNotification();

  const [activeScreen, setActiveScreen] = useState('empresas');
  const [demoMode, setDemoMode] = useState(false);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const [mapAndarId, setMapAndarId] = useState(null);
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [viewerAndarId, setViewerAndarId] = useState(null);
  const [floorNavigation, setFloorNavigation] = useState({ context: null, andares: [] });
  const floorRequestRef = useRef(0);
  const mapEditorRef = useRef(null);
  const navigationInProgress = useRef(false);
  const isDemo = !user && demoMode;
  const canManage = isAdmin && !isDemo;
  const hasCompany = isDemo || Boolean(empresaId);
  const floorNavigationContext = isDemo ? 'demo' : user && empresaId ? empresaId : null;
  const navigationAndares = floorNavigation.context === floorNavigationContext ? floorNavigation.andares : [];
  const currentScreen = isDemo
    ? (activeScreen === 'map' ? 'map' : 'dashboard')
    : activeScreen === 'admin' && isAdmin ? 'admin'
    : !empresaId || activeScreen === 'empresas' ? 'empresas'
    : (activeScreen === 'mesas' && !andarId) || (['edit', 'qr', 'mesas', 'admin'].includes(activeScreen) && !isAdmin)
      ? 'dashboard' : activeScreen;

  const [data, setData] = useState({ mesas: [], racks: [] });
  const [dataStatus, setDataStatus] = useState('idle');
  const [dataContext, setDataContext] = useState(null);
  const currentDataContext = empresaId && andarId ? `${empresaId}:${andarId}` : null;
  const visibleDataStatus = dataContext === currentDataContext ? dataStatus : 'loading';

  const [vinculo, setVinculo] = useState(null);
  const [qrcodeMesa, setQrcodeMesa] = useState(null);
  const dataRequestRef = useRef(0);

  useEffect(() => {
    setActiveScreen('empresas');
    setMapAndarId(null);
    setVinculo(null);
    setQrcodeMesa(null);
    setViewerAndarId(null);
  }, [user]);

  const loadNavigationAndares = useCallback(async () => {
    const requestId = ++floorRequestRef.current;
    if (floorNavigationContext === 'demo') {
      setFloorNavigation({ context: floorNavigationContext, andares: DEMO_DATA.andares });
      return;
    }
    if (!floorNavigationContext) {
      setFloorNavigation({ context: null, andares: [] });
      return;
    }
    try {
      const response = requireSuccess(await api.get('/api/andares'));
      if (requestId === floorRequestRef.current) {
        setFloorNavigation({ context: floorNavigationContext, andares: response.andares });
      }
    } catch {
      if (requestId === floorRequestRef.current) showError('Erro ao carregar andares');
    }
  }, [floorNavigationContext, showError]);

  useEffect(() => {
    loadNavigationAndares();
    return () => { floorRequestRef.current++; };
  }, [loadNavigationAndares]);

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

  const handleCriarMesa = useCallback(() => prompt.form('Nova mesa', '', [
    { key: 'nome', label: 'Nome da mesa', required: true },
    { key: 'qtdPontos', label: 'Quantidade de pontos', type: 'number', initialValue: 8, min: 1, max: 255, integer: true }
  ], {
    onSubmit: async values => {
      const atual = requireSuccess(await api.get('/api/data'));
      const novaMesa = { id: Date.now(), nome: values.nome, x: 0, y: 0, fixada: false,
        pontos: Array.from({ length: Number(values.qtdPontos) }, (_, i) => ({ id: i + 1, rackId: null, patchId: null, porta: null, atencao: false })) };
      requireSuccess(await api.put('/api/data', { ...atual, mesas: [...atual.mesas, novaMesa] }));
      await carregarDadosServidor();
    }
  }), [data, prompt, carregarDadosServidor]);

  const handleRenomearMesa = useCallback(mesa => prompt.text('Editar mesa', 'Nome da mesa', mesa.nome, {
    onSubmit: async nome => {
      if (nome === mesa.nome) return;
      requireSuccess(await api.put(`/api/mesas/${mesa.id}`, { nome }));
      await carregarDadosServidor();
    }
  }), [prompt, carregarDadosServidor]);

  const handleApagarMesa = useCallback(mesa => prompt.confirm('Excluir mesa', `Excluir a mesa ${mesa.nome} e seus pontos? Esta ação não pode ser desfeita.`, {
    onConfirm: async () => {
      const atual = requireSuccess(await api.get('/api/data'));
      requireSuccess(await api.put('/api/data', { ...atual, mesas: atual.mesas.filter(m => m.id !== mesa.id) }));
      await carregarDadosServidor();
    }
  }), [data, prompt, carregarDadosServidor]);

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
      porta: ponto.porta || null,
      ponto,
      mesaNome: mesa.nome,
      mesas: data.allMesas
    });
  }, [data]);

  const handleSelectRackVinculo = useCallback((rackId) => {
    setVinculo(prev => ({ ...prev, rackId, patchId: null, porta: null, etapa: 'patch' }));
  }, []);

  const handleSelectPatchVinculo = useCallback((patchId) => {
    setVinculo(prev => ({ ...prev, patchId, porta: null, etapa: 'porta' }));
  }, []);

  const handleSelectPortaVinculo = useCallback(porta => {
    setVinculo(prev => ({ ...prev, porta }));
  }, []);

  const handleSalvarVinculo = useCallback(async () => {
    if (!vinculo?.porta) throw new Error('Selecione uma porta.');
    const { mesaId, pontoId, rackId, patchId, porta } = vinculo;
    const atual = requireSuccess(await api.get('/api/data'));
    const mesa = atual.mesas.find(m => m.id === mesaId);
    if (!mesa?.pontos.some(p => p.id === pontoId)) throw new Error('O ponto não está mais disponível.');
    const pp = atual.racks.find(r => r.id === rackId)?.patchPanels.find(p => p.id === patchId);
    if (!pp || porta < 1 || porta > pp.portas) throw new Error('A porta não está mais disponível.');
    if ((atual.allMesas || atual.mesas).some(m => m.pontos.some(p => !(m.id === mesaId && p.id === pontoId) && p.rackId === rackId && p.patchId === patchId && p.porta === porta))) {
      throw new Error('Essa porta não está mais livre. Selecione outra porta.');
    }
    const mesas = atual.mesas.map(m => m.id === mesaId ? { ...m, pontos: m.pontos.map(p => p.id === pontoId ? { ...p, rackId, patchId, porta } : p) } : m);
    requireSuccess(await api.put('/api/data', { ...atual, mesas }));
    await carregarDadosServidor();
    setVinculo(null);
  }, [vinculo, carregarDadosServidor]);

  const handleVoltarVinculo = useCallback(() => {
    setVinculo(prev => {
      if (prev.etapa === 'patch') return { ...prev, etapa: 'rack', rackId: null, patchId: null, porta: null };
      if (prev.etapa === 'porta') return { ...prev, etapa: 'patch', patchId: null, porta: null };
      return null;
    });
  }, []);

  const handleCancelarVinculo = useCallback(() => setVinculo(null), []);

  const handleDesvincular = useCallback(async () => {
    if (!vinculo) return;
    const { mesaId, pontoId } = vinculo;
    const confirmado = await prompt.confirm('Limpar vínculo', `Remover o vínculo de ${vinculo.mesaNome} / P${pontoId}?`, {
      submitLabel: 'Limpar',
      onConfirm: async () => {
        const atual = requireSuccess(await api.get('/api/data'));
        const mesas = atual.mesas.map(m => m.id === mesaId ? { ...m, pontos: m.pontos.map(p => p.id === pontoId ? { ...p, rackId: null, patchId: null, porta: null } : p) } : m);
        requireSuccess(await api.put('/api/data', { ...atual, mesas }));
        await carregarDadosServidor();
      }
    });
    if (confirmado) setVinculo(null);
  }, [vinculo, prompt, carregarDadosServidor]);

  const navigate = async (screen, action) => {
    if (navigationInProgress.current) return false;
    if (!action && screen === currentScreen) return true;
    navigationInProgress.current = true;
    setNavigationBusy(true);
    try {
      if (currentScreen === 'edit') await mapEditorRef.current?.flushPendingChanges();
      if (action) await action();
      else setActiveScreen(screen);
      setVinculo(null);
      setQrcodeMesa(null);
      return true;
    } catch (err) {
      showError(err.message || 'Não foi possível salvar o mapa. Tente novamente antes de sair.');
      return false;
    } finally {
      navigationInProgress.current = false;
      setNavigationBusy(false);
    }
  };
  const navItem = (screen, label, needsCompany = false) => ({
    label,
    active: currentScreen === screen,
    disabled: needsCompany && !hasCompany,
    description: needsCompany && !hasCompany ? 'Selecione uma empresa' : undefined,
    onClick: () => navigate(screen)
  });
  const navigateToAndar = andar => navigate(canManage ? 'mesas' : 'dashboard', async () => {
    if (canManage) {
      requireSuccess(await selectAndar(andar.id));
      setMapAndarId(andar.id);
      setActiveScreen('mesas');
    } else {
      setViewerAndarId(andar.id);
      setActiveScreen('dashboard');
    }
    setPanelExpanded(true);
  });
  const navigation = {
    busy: navigationBusy,
    items: [
      ...(!isDemo ? [navItem('empresas', 'Empresas')] : []),
      {
        ...navItem('dashboard', 'Painel da empresa', true),
        id: 'company-panel',
        active: currentScreen === 'dashboard' && !viewerAndarId,
        expanded: panelExpanded,
        onToggle: () => setPanelExpanded(expanded => !expanded),
        onClick: () => navigate('dashboard', () => {
          setViewerAndarId(null);
          setActiveScreen('dashboard');
        }),
        children: navigationAndares.map(andar => ({
          id: `andar-${andar.id}`,
          label: andar.nome,
          active: canManage ? currentScreen === 'mesas' && andarId === andar.id
            : currentScreen === 'dashboard' && viewerAndarId === andar.id,
          onClick: () => navigateToAndar(andar)
        }))
      },
      navItem('map', 'Ver mapa', true),
      ...(canManage ? [
        navItem('edit', 'Editar mapa', true),
        navItem('qr', 'QR Codes', true)
      ] : [])
    ],
    accountItems: [
      ...(canManage ? [navItem('admin', 'Administração')] : []),
      {
        label: isDemo ? 'Sair da demonstração' : 'Sair',
        danger: true,
        onClick: () => navigate(null, isDemo ? () => {
          setDemoMode(false);
          setActiveScreen('empresas');
          setMapAndarId(null);
          setViewerAndarId(null);
        } : logout)
      }
    ]
  };

  if (loading) return null;
  if (!user && !isDemo) return <LoginScreen onDemo={() => { setActiveScreen('dashboard'); setDemoMode(true); }} />;
  if (currentScreen === 'admin') return <Administracao navigation={navigation} />;
  if (currentScreen === 'empresas') {
    return <CompanyScreen navigation={navigation} onCompanySelected={() => {
      setMapAndarId(null);
      setViewerAndarId(null);
      setPanelExpanded(true);
      setActiveScreen('dashboard');
    }} />;
  }
  if (currentScreen === 'dashboard') {
    return <CompanyDashboard navigation={navigation} isViewer={!canManage} demoData={isDemo ? DEMO_DATA : null}
      andares={navigationAndares} reloadAndares={loadNavigationAndares}
      selectedAndarId={viewerAndarId} onViewerAndarSelected={setViewerAndarId}
      onAndarSelected={id => { setMapAndarId(id); setPanelExpanded(true); setActiveScreen('mesas'); }} />;
  }
  if (currentScreen === 'map' || currentScreen === 'edit') {
    return <AuthenticatedShell title={isDemo ? DEMO_DATA.empresaNome : empresaNome}
      context={currentScreen === 'map' ? 'Visualização do mapa' : 'Edição do mapa'} {...navigation}
      className="dashboard-shell map-workspace-shell">
      <MapEditor ref={mapEditorRef} onVoltar={() => navigate('dashboard')} readOnly={currentScreen === 'map'}
        demoData={isDemo ? DEMO_DATA : null} initialAndarId={mapAndarId ?? andarId} onAndarChange={setMapAndarId} />
    </AuthenticatedShell>;
  }
  if (currentScreen === 'qr') {
    return <AuthenticatedShell title={empresaNome || 'QR Codes'} context="Impressão de QR Codes"
      {...navigation} className="dashboard-shell qr-workspace-shell">
      <QRCodeBatchPrint empresaSlug={empresaNome} onClose={() => navigate('dashboard')} embedded />
    </AuthenticatedShell>;
  }

  return (
    <AuthenticatedShell
      title={andarNome || 'Mapa'}
      context={empresaNome || 'Empresa'}
      {...navigation}
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
          onSalvar={handleSalvarVinculo}
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
