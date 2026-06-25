import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { api } from '../api';

export default function AndarScreen({ onAndarSelected, onSwitchCompany }) {
  const { empresaNome, selectAndar, logout, clearAndar } = useAuth();
  const { success, error } = useNotification();
  const [andares, setAndares] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');

  const loadAndares = useCallback(async () => {
    try {
      const data = await api.get('/api/andares');
      if (data.success) setAndares(data.andares);
    } catch (err) {
      error('Erro ao carregar andares');
    }
  }, [error]);

  useEffect(() => {
    loadAndares();
  }, [loadAndares]);

  const handleSelect = async (andar) => {
    try {
      const data = await selectAndar(andar.id);
      if (data.success) {
        success(`Andar "${andar.nome}" selecionado`);
        if (onAndarSelected) onAndarSelected();
      }
    } catch (err) {
      error('Erro ao selecionar andar');
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const data = await api.post('/api/andares', { nome: newName.trim() });
      if (data.success) {
        success('Andar criado');
        setNewName('');
        setShowAddForm(false);
        loadAndares();
      }
    } catch (err) {
      error('Erro ao criar andar');
    }
  };

  const handleEdit = async (andar) => {
    const nome = prompt('Novo nome:', andar.nome);
    if (!nome || nome.trim() === andar.nome) return;
    try {
      const data = await api.put(`/api/andares/${andar.id}`, { nome: nome.trim() });
      if (data.success) {
        success('Andar atualizado');
        loadAndares();
      }
    } catch (err) {
      error('Erro ao atualizar andar');
    }
  };

  const handleDelete = async (andar) => {
    if (!confirm(`Excluir "${andar.nome}"? Todas as mesas deste andar serão removidas.`)) return;
    try {
      const data = await api.del(`/api/andares/${andar.id}`);
      if (data.success) {
        success('Andar excluído');
        loadAndares();
      }
    } catch (err) {
      error('Erro ao excluir andar');
    }
  };

  return (
    <div className="companyScreenWrapper">
      <div className="companyScreen">
        <header>
          <div className="headerLeft"></div>
          <img src="/img/microgate2.png" alt="Logo" className="headerLogo" />
          <div className="headerRight">
            <button className="btnNav" onClick={() => { clearAndar(); if (onSwitchCompany) onSwitchCompany(); }}>Trocar empresa</button>
            <button className="btnLogoff" onClick={logout}>Sair</button>
          </div>
        </header>
        <div className="companyContainer">
          <div className="companyHeader">
            <h1>{empresaNome}</h1>
            <p>Selecione um andar / setor</p>
          </div>
          <div className="companyList">
            {andares.length === 0 && (
              <p className="empty-message">Nenhum andar cadastrado. Crie um abaixo.</p>
            )}
            {andares.map(andar => (
              <div key={andar.id} className="company-card" onClick={() => handleSelect(andar)}>
                <span className="company-card-name">{andar.nome}</span>
                <div className="company-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-edit-company" onClick={() => handleEdit(andar)}>Editar</button>
                  <button className="btn-delete-company" onClick={() => handleDelete(andar)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
          {showAddForm ? (
            <div style={{ display: 'flex', gap: 8, maxWidth: 500, width: '100%' }}>
              <input
                type="text"
                placeholder="Nome do andar / setor"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', font: 'inherit', fontSize: '0.94rem'
                }}
                autoFocus
              />
              <button
                onClick={handleAdd}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--green)', border: 'none', color: 'white',
                  font: 'inherit', fontWeight: 600, cursor: 'pointer'
                }}
              >
                Salvar
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewName(''); }}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', font: 'inherit', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button className="btn-add-company" onClick={() => setShowAddForm(true)}>
              + Novo Andar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
