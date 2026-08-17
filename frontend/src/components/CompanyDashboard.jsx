import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { usePrompt } from './PromptModal';
import RackListView from './RackListView';
import MapEditor from './MapEditor';
import QRCodeBatchPrint from './QRCodeBatchPrint';
import { api } from '../api';

export default function CompanyDashboard({ onAndarSelected, onSwitchCompany, isViewer = false }) {
  const { empresaNome, andarNome, selectAndar, logout } = useAuth();
  const { success, error } = useNotification();
  const prompt = usePrompt();

  const [showMap, setShowMap] = useState(null); // null | 'view' | 'edit'
  const [showBatchQR, setShowBatchQR] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [andares, setAndares] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [racks, setRacks] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [andarExpandido, setAndarExpandido] = useState(null);

  const loadAndares = useCallback(async () => {
    try {
      const data = await api.get('/api/andares');
      if (data.success) setAndares(data.andares);
    } catch {
      error('Erro ao carregar andares');
    }
  }, [error]);

  const loadRacks = useCallback(async () => {
    try {
      const data = await api.get('/api/racks');
      if (data.success) {
        setRacks(data.racks);
        setMesas(data.mesas || []);
      }
    } catch {
      error('Erro ao carregar racks');
    }
  }, [error]);

  useEffect(() => {
    loadAndares();
    loadRacks();
  }, [loadAndares, loadRacks]);

  const handleSelectAndar = async (andar) => {
    try {
      const data = await selectAndar(andar.id);
      if (data.success) {
        success(`Andar "${andar.nome}" selecionado`);
        if (onAndarSelected) onAndarSelected();
      }
    } catch {
      error('Erro ao selecionar andar');
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
    return <MapEditor onVoltar={() => setShowMap(null)} readOnly={showMap === 'view'} />;
  }

  if (showBatchQR) {
    return <QRCodeBatchPrint empresaSlug={empresaNome} onClose={() => setShowBatchQR(false)} />;
  }

  return (
    <div className="companyScreenWrapper">
      <div className="companyScreen">
        <header>
          <div className="headerLeft desktop-nav">
            <button className="btnNav btn-map-view" onClick={() => setShowMap('view')}>👁 Ver Mapa</button>
            {!isViewer && (
              <button className="btnNav btn-map-edit" onClick={() => setShowMap('edit')}>✏ Editar Mapa</button>
            )}
          </div>
          <img src="/img/microgate2.png" alt="Logo" className="headerLogo" />
          <div className="headerRight">
            <div className="desktop-nav">
              {!isViewer && (
                <button className="btnNav btn-batch-qr" onClick={() => setShowBatchQR(true)}>📷 QR Codes</button>
              )}
              <button className="btnNav" onClick={() => { if (onSwitchCompany) onSwitchCompany(); }}>Trocar empresa</button>
              <button className="btnLogoff" onClick={logout}>Sair</button>
            </div>
            <div className="mobile-menu">
              <button
                className="mobile-menu-btn"
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Menu"
              >
                ☰
              </button>
              {menuOpen && (
                <div className="mobile-menu-panel">
                  <button
                    className="btnNav btn-map-view"
                    onClick={() => { setMenuOpen(false); setShowMap('view'); }}
                  >
                    👁 Ver Mapa
                  </button>
                  {!isViewer && (
                    <button
                      className="btnNav btn-map-edit"
                      onClick={() => { setMenuOpen(false); setShowMap('edit'); }}
                    >
                      ✏ Editar Mapa
                    </button>
                  )}
                  {!isViewer && (
                    <button
                      className="btnNav btn-batch-qr"
                      onClick={() => { setMenuOpen(false); setShowBatchQR(true); }}
                    >
                      📷 QR Codes
                    </button>
                  )}
                  <button
                    className="btnNav"
                    onClick={() => { setMenuOpen(false); if (onSwitchCompany) onSwitchCompany(); }}
                  >
                    Trocar empresa
                  </button>
                  <button
                    className="btnLogoff"
                    onClick={() => { setMenuOpen(false); logout(); }}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboardContainer">
          <div className="dashboardHeader">
            <h1>{empresaNome}</h1>
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
  );
}
