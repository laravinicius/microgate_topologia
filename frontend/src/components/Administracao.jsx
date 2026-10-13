import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { usePrompt } from './PromptModal';
import { api, requireSuccess } from '../api';
import AuthenticatedShell from './AuthenticatedShell';

export default function Administracao({ onVoltar }) {
  const { logout } = useAuth();
  const { success, error } = useNotification();
  const prompt = usePrompt();
  const [users, setUsers] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const loadUsers = useCallback(async () => {
    try { setUsers(requireSuccess(await api.get('/api/users')).users); }
    catch { error('Erro ao carregar usuários'); }
  }, [error]);
  const loadEmpresas = useCallback(async () => {
    try { setEmpresas(requireSuccess(await api.get('/api/empresas')).empresas); }
    catch { error('Erro ao carregar empresas'); }
  }, [error]);
  useEffect(() => { loadUsers(); loadEmpresas(); }, [loadUsers, loadEmpresas]);
  const accessFields = user => [
    { key: 'perfil', label: 'Perfil de acesso', type: 'select', initialValue: user?.is_admin ? 'admin' : 'visualizador',
      options: [{ value: 'visualizador', label: 'Visualizador' }, { value: 'admin', label: 'Administrador — acesso a todas as empresas' }] },
    { key: 'empresaIds', label: 'Empresas com acesso', type: 'checkbox-group', initialValue: user?.empresas.map(e => e.id) || [],
      options: empresas.map(e => ({ value: e.id, label: e.nome })), visibleWhen: values => values.perfil !== 'admin' }
  ];
  const handleCreate = () => prompt.form('Novo usuário', '', [
    { key: 'username', label: 'Usuário', required: true },
    { key: 'password', label: 'Senha', type: 'password', required: true },
    ...accessFields()
  ], { onSubmit: async values => {
    requireSuccess(await api.post('/api/users', { username: values.username, password: values.password, is_admin: values.perfil === 'admin', empresaIds: values.empresaIds }));
    success('Usuário criado');
    await loadUsers();
  } });
  const handleEdit = user => prompt.form('Editar usuário', user.username, accessFields(user), {
    onSubmit: async values => {
      requireSuccess(await api.put(`/api/users/${user.id}`, { is_admin: values.perfil === 'admin', empresaIds: values.empresaIds }));
      success('Perfil e acessos atualizados');
      await loadUsers();
    }
  });
  const handleToggleActive = user => prompt.confirm(user.is_active ? 'Desativar usuário' : 'Ativar usuário',
    `${user.is_active ? 'Desativar' : 'Ativar'} o acesso de "${user.username}"?`, {
      submitLabel: user.is_active ? 'Desativar' : 'Ativar', danger: Boolean(user.is_active),
      onConfirm: async () => {
        requireSuccess(await api.put(`/api/users/${user.id}`, { is_active: !user.is_active }));
        success(user.is_active ? 'Usuário desativado' : 'Usuário ativado');
        await loadUsers();
      }
    });
  const handleResetPassword = user => prompt.form('Redefinir senha', `Usuário: ${user.username}`, [
    { key: 'password', label: 'Nova senha', type: 'password', required: true }
  ], { onSubmit: async values => {
    requireSuccess(await api.put(`/api/users/${user.id}`, { password: values.password }));
    success('Senha redefinida');
  } });
  return <AuthenticatedShell title="Administração" context="Usuários e permissões" items={[{ label: 'Empresas', onClick: onVoltar }]} accountItems={[{ label: 'Sair', onClick: logout, danger: true }]} className="administration-shell">
    <div className="companyScreenWrapper"><div className="companyScreen"><div className="companyContainer">
      <div className="companyHeader"><h1>Administração</h1><p>Gerenciamento de usuários e permissões</p></div>
      <div className="secaoUsuarios"><div className="usuariosContainer">
        {users.map(u => <div key={u.id} className="usuarioItem">
          <div className="usuarioInfo">
            <span className="usuarioNome">{u.username}</span> {!u.is_active && <span className="usuarioInativo">(inativo)</span>}
            <p>{u.is_admin ? 'Administrador — todas as empresas' : 'Visualizador'}</p>
            {!u.is_admin && <span className="usuarioInativo">{u.empresas.map(e => e.nome).join(', ') || 'Sem empresas atribuídas'}</span>}
          </div>
          <div className="usuarioAcoes">
            <button className="btnAcao" onClick={() => handleEdit(u)}>Editar</button>
            <button className="btnAcao" onClick={() => handleResetPassword(u)}>Senha</button>
            <button className={`btnAcao ${u.is_active ? 'btnDesativarUsuario' : ''}`} onClick={() => handleToggleActive(u)}>{u.is_active ? 'Desativar' : 'Ativar'}</button>
          </div>
        </div>)}
      </div><button className="btnSecao" onClick={handleCreate}>+ Novo Usuário</button></div>
    </div></div></div>
  </AuthenticatedShell>;
}
