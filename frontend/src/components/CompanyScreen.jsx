import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { api } from '../api';
import UserManagement from './UserManagement';

export default function CompanyScreen({ onCompanySelected }) {
  const { logout, selectCompany, user } = useAuth();
  const { success, error } = useNotification();
  const [empresas, setEmpresas] = useState([]);
  const [showUsers, setShowUsers] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [isAdmin] = useState(user === 'admin');

  const loadEmpresas = useCallback(async () => {
    try {
      const data = await api.get('/api/empresas');
      if (data.success) setEmpresas(data.empresas);
    } catch (err) {
      error('Erro ao carregar empresas');
    }
  }, [error]);

  useEffect(() => {
    loadEmpresas();
  }, [loadEmpresas]);

  const handleSelect = async (empresa) => {
    try {
      const data = await selectCompany(empresa.id);
      if (data.success) {
        success(`Empresa "${empresa.nome}" selecionada`);
        if (onCompanySelected) onCompanySelected();
      }
    } catch (err) {
      error('Erro ao selecionar empresa');
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const data = await api.post('/api/empresas', { nome: newName.trim() });
      if (data.success) {
        success('Empresa criada');
        setNewName('');
        setShowAddForm(false);
        loadEmpresas();
      }
    } catch (err) {
      error('Erro ao criar empresa');
    }
  };

  const handleEdit = async (empresa) => {
    const nome = prompt('Novo nome:', empresa.nome);
    if (!nome || nome.trim() === empresa.nome) return;
    try {
      const data = await api.put(`/api/empresas/${empresa.id}`, { nome: nome.trim() });
      if (data.success) {
        success('Empresa atualizada');
        loadEmpresas();
      }
    } catch (err) {
      error('Erro ao atualizar empresa');
    }
  };

  const handleDelete = async (empresa) => {
    if (!confirm(`Excluir "${empresa.nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const data = await api.del(`/api/empresas/${empresa.id}`);
      if (data.success) {
        success('Empresa excluída');
        loadEmpresas();
      }
    } catch (err) {
      error('Erro ao excluir empresa');
    }
  };

  return (
    <div className="companyScreenWrapper">
      <div className="companyScreen">
        <header>
          <img src="/img/microgate2.png" alt="Logo" className="headerLogo" />
          <div className="headerRight">
            {isAdmin && (
              <button
                className="btnLogoff"
                onClick={() => setShowUsers(!showUsers)}
                style={{ background: showUsers ? 'var(--blue)' : undefined }}
              >
                Usuários
              </button>
            )}
            <button className="btnLogoff" onClick={logout}>Sair</button>
          </div>
        </header>
        {showUsers && isAdmin && (
          <div id="usuariosPanel">
            <UserManagement />
          </div>
        )}
        <div className="companyContainer">
          <div className="companyHeader">
            <h1>InfraMap</h1>
            <p>Selecione uma empresa</p>
          </div>
          <div className="companyList">
            {empresas.length === 0 && (
              <p className="empty-message">Nenhuma empresa cadastrada</p>
            )}
            {empresas.map(emp => (
              <div key={emp.id} className="company-card" onClick={() => handleSelect(emp)}>
                <span className="company-card-name">{emp.nome}</span>
                <div className="company-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-edit-company" onClick={() => handleEdit(emp)}>Editar</button>
                  <button className="btn-delete-company" onClick={() => handleDelete(emp)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
          {showAddForm ? (
            <div style={{ display: 'flex', gap: 8, maxWidth: 500, width: '100%' }}>
              <input
                type="text"
                placeholder="Nome da empresa"
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
              + Nova Empresa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
