import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { usePrompt } from './PromptModal';
import RackListView from './RackListView';
import { api, requireSuccess } from '../api';
import AuthenticatedShell from './AuthenticatedShell';

export default function CompanyDashboard({ navigation, onAndarSelected, isViewer = false, demoData = null,
  andares = [], reloadAndares, selectedAndarId = null, onViewerAndarSelected }) {
  const { empresaNome, selectAndar } = useAuth();
  const { success, error } = useNotification();
  const prompt = usePrompt();

  const [racks, setRacks] = useState([]);
  const [mesas, setMesas] = useState([]);
  const andarExpandido = selectedAndarId;
  const [selecionandoAndarId, setSelecionandoAndarId] = useState(null);
  const selecaoAndarEmAndamento = useRef(false);
  const selectedFloorRef = useRef(null);
  const nomeEmpresa = demoData?.empresaNome || empresaNome;

  const loadAndares = reloadAndares;

  const loadRacks = useCallback(async () => {
    if (demoData) {
      setRacks(demoData.racks);
      setMesas(demoData.mesas);
      return;
    }
    try {
      const data = await api.get('/api/racks');
      if (data.success) {
        setRacks(data.racks);
        setMesas(data.mesas || []);
      }
    } catch {
      error('Erro ao carregar racks');
    }
  }, [demoData, error]);

  useEffect(() => {
    loadRacks();
  }, [loadRacks]);

  useEffect(() => {
    if (isViewer && selectedAndarId !== null) selectedFloorRef.current?.scrollIntoView({ block: 'start' });
  }, [isViewer, selectedAndarId, andares]);

  const handleSelectAndar = async (andar) => {
    if (selecaoAndarEmAndamento.current) return;
    selecaoAndarEmAndamento.current = true;
    setSelecionandoAndarId(andar.id);
    try {
      const data = await selectAndar(andar.id);
      if (data.success) {
        onAndarSelected?.(andar.id);
      } else {
        error(data.message || 'Não foi possível selecionar este andar.');
      }
    } catch {
      error('Erro ao selecionar andar');
    } finally {
      selecaoAndarEmAndamento.current = false;
      setSelecionandoAndarId(null);
    }
  };

  const handleAddAndar = () => prompt.text('Novo andar', 'Nome do andar / setor', '', {
    onSubmit: async nome => {
      requireSuccess(await api.post('/api/andares', { nome }));
      success('Andar criado');
      await loadAndares();
    }
  });

  const handleEditAndar = andar => prompt.text('Editar andar', 'Nome do andar / setor', andar.nome, {
    onSubmit: async nome => {
      if (nome === andar.nome) return;
      requireSuccess(await api.put(`/api/andares/${andar.id}`, { nome }));
      success('Andar atualizado');
      await loadAndares();
    }
  });

  const handleDeleteAndar = andar => prompt.confirm('Excluir andar', `Excluir "${andar.nome}"? Todas as mesas deste andar serão removidas. Esta ação não pode ser desfeita.`, {
    onConfirm: async () => {
      requireSuccess(await api.del(`/api/andares/${andar.id}`));
      success('Andar excluído');
      await loadAndares();
      await loadRacks();
    }
  });

  const handleCriarRack = () => prompt.text('Novo rack', 'Nome do rack', '', {
    onSubmit: async nome => {
      requireSuccess(await api.post('/api/racks', { nome }));
      success('Rack criado');
      await loadRacks();
    }
  });

  const handleEditRack = rack => prompt.text('Editar rack', 'Nome do rack', rack.nome, {
    onSubmit: async nome => {
      if (nome === rack.nome) return;
      requireSuccess(await api.put(`/api/racks/${rack.id}`, { nome }));
      success('Rack atualizado');
      await loadRacks();
    }
  });

  const handleApagarRack = rack => prompt.confirm('Excluir rack', `Excluir o rack ${rack.nome}, seus patch panels e vínculos dos pontos?`, {
    onConfirm: async () => {
      const atual = requireSuccess(await api.get('/api/racks'));
      requireSuccess(await api.put('/api/racks', { mesas: [], racks: atual.racks.filter(r => r.id !== rack.id) }));
      success('Rack excluído');
      await loadRacks();
    }
  });

  const handleCriarPatchPanel = rackId => prompt.text('Novo patch panel', 'Nome do patch panel', '', {
    onSubmit: async nome => {
      const atual = requireSuccess(await api.get('/api/racks'));
      if (!atual.racks.some(r => r.id === rackId)) throw new Error('O rack não está mais disponível.');
      const newRacks = atual.racks.map(r => r.id === rackId ? { ...r, patchPanels: [...r.patchPanels, { id: Date.now(), nome, portas: 24 }] } : r);
      requireSuccess(await api.put('/api/racks', { mesas: [], racks: newRacks }));
      success('Patch panel criado');
      await loadRacks();
    }
  });

  const handleApagarPatchPanel = (rackId, pp) => prompt.confirm('Excluir patch panel', `Excluir o patch panel ${pp.nome} e os vínculos dos pontos?`, {
    onConfirm: async () => {
      const atual = requireSuccess(await api.get('/api/racks'));
      const newRacks = atual.racks.map(r => r.id === rackId ? { ...r, patchPanels: r.patchPanels.filter(p => p.id !== pp.id) } : r);
      requireSuccess(await api.put('/api/racks', { mesas: [], racks: newRacks }));
      success('Patch panel excluído');
      await loadRacks();
    }
  });

  const handleTogglePortaAtencao = (rackId, patchId, porta) => {
    const rack = racks.find(r => r.id === rackId);
    const pp = rack?.patchPanels.find(p => p.id === patchId);
    const mesa = mesas.find(m => m.pontos.some(p => p.rackId === rackId && p.patchId === patchId && p.porta === porta));
    const ponto = mesa?.pontos.find(p => p.rackId === rackId && p.patchId === patchId && p.porta === porta);
    if (!ponto) return;
    return prompt.form('Destaque da porta', `${rack.nome} / ${pp.nome} / Porta ${porta} · ${mesa.nome} / P${ponto.id}`, [
      { key: 'atencao', label: 'Destacar como atenção', type: 'checkbox', initialValue: Boolean(ponto.atencao) }
    ], {
      onSubmit: async values => {
        const atual = requireSuccess(await api.get('/api/racks'));
        const current = (atual.mesas || []).flatMap(m => m.pontos).find(p => p.rackId === rackId && p.patchId === patchId && p.porta === porta);
        if (!current) throw new Error('A conexão não está mais disponível.');
        if (values.atencao === Boolean(current.atencao)) return;
        requireSuccess(await api.put('/api/ponto/toggle-atencao', { rackId, patchId, porta }));
        success('Destaque atualizado');
        await loadRacks();
      }
    });
  };

  const formatPontoResumo = (p) => {
    if (!p.rackId || !p.patchId || !p.porta) return null;
    const rack = racks.find(r => r.id === p.rackId);
    const pp = rack && rack.patchPanels.find(x => x.id === p.patchId);
    if (!rack || !pp) return null;
    return `${rack.nome} | ${pp.nome} | Porta ${p.porta}`;
  };

  return (
    <AuthenticatedShell
      title={nomeEmpresa || 'InfraMap'}
      context="Empresa"
      {...navigation}
      className="dashboard-shell"
    >
    <div className="companyScreenWrapper">
      <div className="companyScreen">
        <div className="dashboardContainer">
          <div className="dashboardHeader">
            <h1>{nomeEmpresa}</h1>
          </div>

          <div className="dashboardColumns">
            <div className="dashboardColumn">
              <h2 className="dashboardSectionTitle">Andares / Setores</h2>
              <div className="companyList">
                {andares.length === 0 && (
                  <p className="empty-message">Nenhum andar cadastrado.</p>
                )}
                {andares.map(andar => (
                  <div
                    key={andar.id}
                    ref={isViewer && andarExpandido === andar.id ? selectedFloorRef : undefined}
                    className={`company-card${isViewer ? ' company-card-passive company-card-expandable' : ''}`}
                    onClick={isViewer ? () => onViewerAndarSelected?.(andarExpandido === andar.id ? null : andar.id) : () => handleSelectAndar(andar)}
                    aria-busy={!isViewer && selecionandoAndarId === andar.id}
                  >
                    {isViewer && (
                      <span className="rackToggle">{andarExpandido === andar.id ? '▼' : '▶'}</span>
                    )}
                    <span className="company-card-name">{andar.nome}</span>
                    {!isViewer && (
                      <div className="company-card-actions" onClick={e => e.stopPropagation()}>
                        <button className="btn-edit-company" onClick={() => handleEditAndar(andar)}>Editar</button>
                        <button className="btn-delete-company" onClick={() => handleDeleteAndar(andar)}>Excluir</button>
                      </div>
                    )}
                    {isViewer && andarExpandido === andar.id && (
                      <div className="andarMesas">
                        {mesas.filter(m => m.andarNome === andar.nome).length === 0 && (
                          <p className="empty-message">Nenhuma mesa neste andar.</p>
                        )}
                        {mesas.filter(m => m.andarNome === andar.nome).map(mesa => (
                          <div key={mesa.id} className="andarMesa">
                            <span className="andarMesaNome">{mesa.nome}</span>
                            <div className="andarMesaPontos">
                              {mesa.pontos.map(p => {
                                const resumo = formatPontoResumo(p);
                                return (
                                  <span key={p.id} className={`andarPonto${resumo ? ' used' : ''}`}>
                                    P{p.id}
                                    {resumo ? ` · ${resumo}` : ' · Livre'}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!isViewer && <button className="btn-add-company" onClick={handleAddAndar}>+ Novo Andar</button>}
            </div>

            <div className="dashboardColumn">
              <h2 className="dashboardSectionTitle">Racks</h2>
              <RackListView
                racks={racks}
                mesas={mesas}
                readOnly={isViewer}
                onEditRack={handleEditRack}
                onApagarRack={handleApagarRack}
                onCriarPatchPanel={handleCriarPatchPanel}
                onApagarPatchPanel={handleApagarPatchPanel}
                onTogglePortaAtencao={handleTogglePortaAtencao}
              />
              {!isViewer && (
                <button className="btnNovoRack" onClick={handleCriarRack}>
                  + Rack
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </AuthenticatedShell>
  );
}
