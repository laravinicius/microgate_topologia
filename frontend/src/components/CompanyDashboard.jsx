import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { usePrompt } from './PromptModal';
import RackListView from './RackListView';
import MapEditor from './MapEditor';
import QRCodeBatchPrint from './QRCodeBatchPrint';
import { api } from '../api';
import AuthenticatedShell from './AuthenticatedShell';

export default function CompanyDashboard({ onSwitchCompany, onOpenAdmin, isViewer = false, demoData = null }) {
  const { empresaNome, andarNome, selectAndar, logout } = useAuth();
  const { success, error } = useNotification();
  const prompt = usePrompt();

  const [showMap, setShowMap] = useState(null); // null | 'view' | 'edit'
  const [showBatchQR, setShowBatchQR] = useState(false);
  const [andares, setAndares] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [racks, setRacks] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [andarExpandido, setAndarExpandido] = useState(null);
  const [selecionandoAndarId, setSelecionandoAndarId] = useState(null);
  const selecaoAndarEmAndamento = useRef(false);
  const isDemo = Boolean(demoData);
  const nomeEmpresa = demoData?.empresaNome || empresaNome;
  const shellItems = [
    { label: 'Ver mapa', onClick: () => setShowMap('view') },
    ...(!isViewer ? [
      { label: 'Editar mapa', onClick: () => setShowMap('edit') },
      { label: 'QR Codes', onClick: () => setShowBatchQR(true) }
    ] : []),
    { label: isDemo ? 'Sair da demonstração' : 'Trocar empresa', onClick: onSwitchCompany }
  ];
  const accountItems = [
    ...(!isDemo && onOpenAdmin ? [{ label: 'Administração', onClick: onOpenAdmin }] : []),
    ...(!isDemo ? [{ label: 'Sair', onClick: logout, danger: true }] : [])
  ];

  const loadAndares = useCallback(async () => {
    if (demoData) {
      setAndares(demoData.andares);
      return;
    }
    try {
      const data = await api.get('/api/andares');
      if (data.success) setAndares(data.andares);
    } catch {
      error('Erro ao carregar andares');
    }
  }, [demoData, error]);

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
    loadAndares();
    loadRacks();
  }, [loadAndares, loadRacks]);

  const handleSelectAndar = async (andar) => {
    if (selecaoAndarEmAndamento.current) return;
    selecaoAndarEmAndamento.current = true;
    setSelecionandoAndarId(andar.id);
    try {
      const data = await selectAndar(andar.id);
      if (data.success) {
        success(`Andar "${andar.nome}" selecionado`);
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

  const handleAddAndar = async () => {
    if (!newName.trim()) return;
    try {
      const data = await api.post('/api/andares', { nome: newName.trim() });
      if (data.success) {
        success('Andar criado');
        setNewName('');
        setShowAddForm(false);
        loadAndares();
      }
    } catch {
      error('Erro ao criar andar');
    }
  };

  const handleEditAndar = async (andar) => {
    const nome = window.prompt('Novo nome:', andar.nome);
    if (!nome || nome.trim() === andar.nome) return;
    try {
      const data = await api.put(`/api/andares/${andar.id}`, { nome: nome.trim() });
      if (data.success) {
        success('Andar atualizado');
        loadAndares();
      }
    } catch {
      error('Erro ao atualizar andar');
    }
  };

  const handleDeleteAndar = async (andar) => {
    if (!confirm(`Excluir "${andar.nome}"? Todas as mesas deste andar serao removidas.`)) return;
    try {
      const data = await api.del(`/api/andares/${andar.id}`);
      if (data.success) {
        success('Andar excluido');
        loadAndares();
      }
    } catch {
      error('Erro ao excluir andar');
    }
  };

  const handleCriarRack = async () => {
    const nome = await prompt.text('Novo rack', 'Nome do rack');
    if (!nome) return;
    const newData = { mesas: [], racks: [...racks, { id: Date.now(), nome, patchPanels: [] }] };
    try {
      await api.put('/api/racks', newData);
      success('Rack criado');
      loadRacks();
    } catch {
      error('Erro ao criar rack');
    }
  };

  const handleEditRack = async (rack) => {
    const nome = await prompt.text('Editar rack', 'Novo nome:', rack.nome);
    if (!nome || nome.trim() === rack.nome.trim()) return;
    try {
      const data = await api.put(`/api/racks/${rack.id}`, { nome: nome.trim() });
      if (data.success) {
        success('Rack atualizado');
        loadRacks();
      }
    } catch {
      error('Erro ao atualizar rack');
    }
  };

  const handleApagarRack = async (rack) => {
    const confirmado = await prompt.confirm('Apagar rack', `Deseja apagar o rack ${rack.nome} e seus patch panels?`);
    if (!confirmado) return;
    const newData = { mesas: [], racks: racks.filter(r => r.id !== rack.id) };
    try {
      await api.put('/api/racks', newData);
      success('Rack apagado');
      loadRacks();
    } catch {
      error('Erro ao apagar rack');
    }
  };

  const handleCriarPatchPanel = async (rackId) => {
    const nome = await prompt.text('Novo patch panel', 'Nome do patch panel');
    if (!nome) return;
    const newRacks = racks.map(r =>
      r.id === rackId ? { ...r, patchPanels: [...r.patchPanels, { id: Date.now(), nome, portas: 24 }] } : r
    );
    try {
      await api.put('/api/racks', { mesas: [], racks: newRacks });
      success('Patch panel criado');
      loadRacks();
    } catch {
      error('Erro ao criar patch panel');
    }
  };

  const handleApagarPatchPanel = async (rackId, pp) => {
    const confirmado = await prompt.confirm('Apagar patch panel', `Deseja apagar o patch panel ${pp.nome}?`);
    if (!confirmado) return;
    const newRacks = racks.map(r =>
      r.id === rackId ? { ...r, patchPanels: r.patchPanels.filter(p => p.id !== pp.id) } : r
    );
    try {
      await api.put('/api/racks', { mesas: [], racks: newRacks });
      success('Patch panel apagado');
      loadRacks();
    } catch {
      error('Erro ao apagar patch panel');
    }
  };

  const handleTogglePortaAtencao = async (rackId, patchId, porta) => {
    try {
      await api.put('/api/ponto/toggle-atencao', { rackId, patchId, porta });
      await loadRacks();
    } catch {
      error('Erro ao atualizar destaque');
    }
  };

  const formatPontoResumo = (p) => {
    if (!p.rackId || !p.patchId || !p.porta) return null;
    const rack = racks.find(r => r.id === p.rackId);
    const pp = rack && rack.patchPanels.find(x => x.id === p.patchId);
    if (!rack || !pp) return null;
    return `${rack.nome} | ${pp.nome} | Porta ${p.porta}`;
  };

  if (showMap) {
    return (
      <AuthenticatedShell
        title={nomeEmpresa || 'Mapa'}
        context={showMap === 'view' ? 'Visualização do mapa' : 'Edição do mapa'}
        items={[
          { label: 'Voltar ao painel', onClick: () => setShowMap(null) },
          ...(!isDemo ? [{ label: 'Trocar empresa', onClick: onSwitchCompany }] : [])
        ]}
        accountItems={accountItems}
        className="dashboard-shell map-workspace-shell"
      >
        <MapEditor onVoltar={() => setShowMap(null)} readOnly={showMap === 'view'} demoData={demoData} />
      </AuthenticatedShell>
    );
  }

  if (showBatchQR) {
    return (
      <AuthenticatedShell
        title={nomeEmpresa || 'QR Codes'}
        context="Impressão de QR Codes"
        items={[{ label: 'Voltar ao painel', onClick: () => setShowBatchQR(false) }]}
        accountItems={accountItems}
        className="dashboard-shell qr-workspace-shell"
      >
        <QRCodeBatchPrint empresaSlug={empresaNome} onClose={() => setShowBatchQR(false)} />
      </AuthenticatedShell>
    );
  }

  return (
    <AuthenticatedShell
      title={nomeEmpresa || 'InfraMap'}
      context="Empresa"
      items={shellItems}
      accountItems={accountItems}
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
                    className={`company-card${isViewer ? ' company-card-passive company-card-expandable' : ''}`}
                    onClick={isViewer ? () => setAndarExpandido(andarExpandido === andar.id ? null : andar.id) : () => handleSelectAndar(andar)}
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
              {!isViewer && (showAddForm ? (
                <div className="dashboardInlineForm">
                  <input
                    type="text"
                    placeholder="Nome do andar / setor"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddAndar()}
                    className="dashboardInput"
                    autoFocus
                  />
                  <button className="btnSave" onClick={handleAddAndar}>Salvar</button>
                  <button className="btnCancel" onClick={() => { setShowAddForm(false); setNewName(''); }}>Cancelar</button>
                </div>
              ) : (
                <button className="btn-add-company" onClick={() => setShowAddForm(true)}>
                  + Novo Andar
                </button>
              ))}
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
