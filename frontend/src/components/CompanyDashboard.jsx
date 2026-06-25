import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { usePrompt } from './PromptModal';
import RackListView from './RackListView';
import { api } from '../api';

export default function CompanyDashboard({ onAndarSelected, onSwitchCompany }) {
  const { empresaNome, selectAndar, logout } = useAuth();
  const { success, error } = useNotification();
  const prompt = usePrompt();

  const [andares, setAndares] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [racks, setRacks] = useState([]);
  const [mesas, setMesas] = useState([]);

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

  return (
    <div className="companyScreenWrapper">
      <div className="companyScreen">
        <header>
          <img src="/img/microgate2.png" alt="Logo" className="headerLogo" />
          <div className="headerRight">
            <button className="btnNav" onClick={() => { if (onSwitchCompany) onSwitchCompany(); }}>Trocar empresa</button>
            <button className="btnLogoff" onClick={logout}>Sair</button>
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
                  <div key={andar.id} className="company-card" onClick={() => handleSelectAndar(andar)}>
                    <span className="company-card-name">{andar.nome}</span>
                    <div className="company-card-actions" onClick={e => e.stopPropagation()}>
                      <button className="btn-edit-company" onClick={() => handleEditAndar(andar)}>Editar</button>
                      <button className="btn-delete-company" onClick={() => handleDeleteAndar(andar)}>Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
              {showAddForm ? (
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
              )}
            </div>

            <div className="dashboardColumn">
              <h2 className="dashboardSectionTitle">Racks</h2>
              <RackListView
                racks={racks}
                mesas={mesas}
                onCriarRack={handleCriarRack}
                onApagarRack={handleApagarRack}
                onCriarPatchPanel={handleCriarPatchPanel}
                onApagarPatchPanel={handleApagarPatchPanel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
