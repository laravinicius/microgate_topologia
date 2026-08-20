import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { api } from '../api';

export default function Administracao({ onVoltar }) {
  const { logout } = useAuth();
  const { success, error } = useNotification();

  const [users, setUsers] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newEmpresas, setNewEmpresas] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get('/api/users');
      if (data.success) setUsers(data.users);
    } catch {
      error('Erro ao carregar usuários');
    }
  }, [error]);

  const loadEmpresas = useCallback(async () => {
    try {
      const data = await api.get('/api/empresas');
      if (data.success) setEmpresas(data.empresas);
    } catch {
      error('Erro ao carregar empresas');
    }
  }, [error]);

  useEffect(() => { loadUsers(); loadEmpresas(); }, [loadUsers, loadEmpresas]);

  const handleCreate = async () => {
    if (!newUser.trim() || !newPass.trim()) return;
    try {
      const data = await api.post('/api/users', {
        username: newUser.trim(),
        password: newPass,
        is_admin: newIsAdmin,
        empresaIds: newEmpresas
      });
      if (data.success) {
        success('Usuário criado');
        setNewUser('');
        setNewPass('');
        setNewIsAdmin(false);
        setNewEmpresas([]);
        setShowForm(false);
        loadUsers();
      }
    } catch (err) {
      error('Erro ao criar usuário');
    }
  };

  const handleChangePerfil = async (user, isAdmin) => {
    try {
      const data = await api.put(`/api/users/${user.id}`, { is_admin: isAdmin });
      if (data.success) {
        success(`${user.username} agora é ${isAdmin ? 'administrador' : 'visualizador'}`);
        loadUsers();
      }
    } catch (err) {
      error('Erro ao alterar perfil');
    }
  };

  const handleToggleEmpresa = async (user, empresaId, checked) => {
    const atual = user.empresas.map(e => e.id);
    const novo = checked ? [...atual, Number(empresaId)] : atual.filter(id => id !== Number(empresaId));
    try {
      const data = await api.put(`/api/users/${user.id}`, { empresaIds: novo });
      if (data.success) {
        success('Acessos atualizados');
        loadUsers();
      }
    } catch (err) {
      error('Erro ao atualizar acessos');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const data = await api.put(`/api/users/${user.id}`, { is_active: !user.is_active });
      if (data.success) {
        success(user.is_active ? 'Usuário desativado' : 'Usuário ativado');
        loadUsers();
      }
    } catch (err) {
      error('Erro ao atualizar usuário');
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = prompt(`Nova senha para "${user.username}":`);
    if (!newPassword) return;
    try {
      const data = await api.put(`/api/users/${user.id}`, { password: newPassword });
      if (data.success) success('Senha redefinida');
    } catch (err) {
      error('Erro ao redefinir senha');
    }
  };

  return (
    <div className="companyScreenWrapper">
      <div className="companyScreen">
        <header>
          <div className="headerLeft desktop-nav">
            <button className="btnLogoff" onClick={onVoltar}>← Empresas</button>
          </div>
          <img src="/img/microgate2.png" alt="Logo" className="headerLogo" />
          <div className="headerRight">
            <div className="desktop-nav">
              <button className="btnLogoff" onClick={logout}>Sair</button>
            </div>
          </div>
        </header>

        <div className="companyContainer">
          <div className="companyHeader">
            <h1>Administração</h1>
            <p>Gerenciamento de usuários e permissões</p>
          </div>

          <div className="secaoUsuarios">
            <div className="usuariosContainer">
              {users.map(u => (
                <div key={u.id} className="usuarioItem">
                  <div className="usuarioInfo">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="usuarioNome">{u.username}</span>
                      {!u.is_active && <span className="usuarioInativo">(inativo)</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <select
                        className="usuarioPerfilSelect"
                        value={u.is_admin ? 'admin' : 'visualizador'}
                        onChange={e => handleChangePerfil(u, e.target.value === 'admin')}
                        title="Perfil de acesso"
                      >
                        <option value="visualizador">Visualizador</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <button
                        className="btnAcao"
                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                      >
                        {expandedUser === u.id ? 'Ocultar empresas' : 'Empresas'}
                      </button>
                    </div>
                    {expandedUser === u.id && (
                      <div className="usuarioEmpresas">
                        {empresas.length === 0 && (
                          <span className="usuarioInativo">Nenhuma empresa cadastrada</span>
                        )}
                        {empresas.map(emp => {
                          const marcada = u.empresas.some(e => e.id === emp.id);
                          return (
                            <label key={emp.id} className="empresaCheckbox">
                              <input
                                type="checkbox"
                                checked={marcada}
                                disabled={u.is_admin}
                                onChange={e => handleToggleEmpresa(u, emp.id, e.target.checked)}
                              />
                              <span>{emp.nome}</span>
                            </label>
                          );
                        })}
                        {u.is_admin && (
                          <span className="usuarioInativo">Administrador tem acesso a todas as empresas</span>
                        )}
                      </div>
                    )}
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
              <div className="novoUsuarioForm">
                <input
                  type="text" placeholder="Usuário" value={newUser}
                  onChange={e => setNewUser(e.target.value)}
                />
                <input
                  type="password" placeholder="Senha" value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                />
                <select
                  className="usuarioPerfilSelect"
                  value={newIsAdmin ? 'admin' : 'visualizador'}
                  onChange={e => setNewIsAdmin(e.target.value === 'admin')}
                >
                  <option value="visualizador">Visualizador</option>
                  <option value="admin">Administrador</option>
                </select>
                {!newIsAdmin && (
                  <div className="usuarioEmpresas">
                    <span className="usuarioInativo">Empresas com acesso:</span>
                    {empresas.map(emp => (
                      <label key={emp.id} className="empresaCheckbox">
                        <input
                          type="checkbox"
                          checked={newEmpresas.includes(emp.id)}
                          onChange={e => {
                            const id = emp.id;
                            setNewEmpresas(prev =>
                              e.target.checked
                                ? [...prev, id]
                                : prev.filter(x => x !== id)
                            );
                          }}
                        />
                        <span>{emp.nome}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleCreate} className="btnSecao">Salvar</button>
                  <button className="btnSecundario" onClick={() => { setShowForm(false); setNewUser(''); setNewPass(''); setNewIsAdmin(false); setNewEmpresas([]); }}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button className="btnSecao" onClick={() => setShowForm(true)}>+ Novo Usuário</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}