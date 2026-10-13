import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { api, requireSuccess } from '../api';
import { usePrompt } from './PromptModal';
import AuthenticatedShell from './AuthenticatedShell';

export default function CompanyScreen({ onCompanySelected, navigation }) {
  const { selectCompany, isAdmin } = useAuth();
  const { success, error } = useNotification();
  const [empresas, setEmpresas] = useState([]);
  const prompt = usePrompt();

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
        if (onCompanySelected) onCompanySelected();
      }
    } catch (err) {
      error('Erro ao selecionar empresa');
    }
  };

  const handleAdd = () => prompt.text('Nova empresa', 'Nome da empresa', '', {
    onSubmit: async nome => {
      requireSuccess(await api.post('/api/empresas', { nome }));
      success('Empresa criada');
      await loadEmpresas();
    }
  });

  const handleEdit = empresa => prompt.text('Editar empresa', 'Nome da empresa', empresa.nome, {
    onSubmit: async nome => {
      if (nome === empresa.nome) return;
      requireSuccess(await api.put(`/api/empresas/${empresa.id}`, { nome }));
      success('Empresa atualizada');
      await loadEmpresas();
    }
  });

  const handleDelete = empresa => prompt.confirm('Excluir empresa', `Excluir "${empresa.nome}" e os dados associados? Esta ação não pode ser desfeita.`, {
    onConfirm: async () => {
      requireSuccess(await api.del(`/api/empresas/${empresa.id}`));
      success('Empresa excluída');
      await loadEmpresas();
    }
  });

  return (
    <AuthenticatedShell
      title="Empresas"
      context="Seleção de empresa"
      {...navigation}
      className="company-selection-shell"
    >
    <div className="companyScreenWrapper">
      <div className="companyScreen">
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
                {isAdmin && (
                  <div className="company-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn-edit-company" onClick={() => handleEdit(emp)}>Editar</button>
                    <button className="btn-delete-company" onClick={() => handleDelete(emp)}>Excluir</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {isAdmin && <button className="btn-add-company" onClick={handleAdd}>+ Nova Empresa</button>}
        </div>
      </div>
    </div>
    </AuthenticatedShell>
  );
}
