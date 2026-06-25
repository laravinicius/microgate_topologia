import { useState, useEffect, useCallback } from 'react';
import { useNotification } from './Notification';
import { api } from '../api';

export default function UserManagement() {
  const { success, error } = useNotification();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get('/api/users');
      if (data.success) setUsers(data.users);
    } catch {
      error('Erro ao carregar usuários');
    }
  }, [error]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!newUser.trim() || !newPass.trim()) return;
    try {
      const data = await api.post('/api/users', { username: newUser.trim(), password: newPass });
      if (data.success) {
        success('Usuário criado');
        setNewUser('');
        setNewPass('');
        setShowForm(false);
        loadUsers();
      }
    } catch (err) {
      error('Erro ao criar usuário');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/api/users/${user.id}`, { is_active: !user.is_active });
      success(user.is_active ? 'Usuário desativado' : 'Usuário ativado');
      loadUsers();
    } catch {
      error('Erro ao atualizar usuário');
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = prompt(`Nova senha para "${user.username}":`);
    if (!newPassword) return;
    try {
      await api.put(`/api/users/${user.id}`, { password: newPassword });
      success('Senha redefinida');
    } catch {
      error('Erro ao redefinir senha');
    }
  };

  return (
    <div className="secaoUsuarios">
      <div className="usuariosContainer">
        {users.map(u => (
          <div key={u.id} className="usuarioItem">
            <div>
              <span className="usuarioNome">{u.username}</span>
              {!u.is_active && <span className="usuarioInativo">(inativo)</span>}
            </div>
            <div className="usuarioAcoes">
              <button className="btnAcao" onClick={() => handleResetPassword(u)}>Senha</button>
              <button
                className={`btnAcao ${u.is_active ? 'btnDesativarUsuario' : ''}`}
                onClick={() => handleToggleActive(u)}
              >
                {u.is_active ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <input
            type="text" placeholder="Usuário" value={newUser}
            onChange={e => setNewUser(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text)', font: 'inherit', fontSize: '0.9rem'
            }}
          />
          <input
            type="password" placeholder="Senha" value={newPass}
            onChange={e => setNewPass(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text)', font: 'inherit', fontSize: '0.9rem'
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} className="btnSecao" style={{ flex: 1 }}>Salvar</button>
            <button onClick={() => { setShowForm(false); setNewUser(''); setNewPass(''); }}
              style={{
                padding: '10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text)', font: 'inherit', cursor: 'pointer'
              }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className="btnSecao" onClick={() => setShowForm(true)}>+ Usuário</button>
      )}
    </div>
  );
}
