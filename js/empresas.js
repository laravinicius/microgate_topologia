// --- Tela de Seleção de Empresas ---

async function carregarEmpresas() {
  try {
    const res = await fetch('/api/empresas');
    const data = await res.json();
    renderizarEmpresas(data.empresas || []);
  } catch (error) {
    console.error('Erro ao carregar empresas:', error);
  }
}

function renderizarEmpresas(empresas) {
  const list = document.getElementById('companyList');
  if (!list) return;

  if (empresas.length === 0) {
    list.innerHTML = '<p class="empty-message">Nenhuma empresa cadastrada. Crie uma abaixo.</p>';
    return;
  }

  list.innerHTML = empresas.map(emp => {
    const nome = emp.nome.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
    <div class="company-card" data-id="${emp.id}">
      <div class="company-card-name">${nome}</div>
      <div class="company-card-actions">
        <button class="btn-edit-company">✎</button>
        <button class="btn-delete-company">🗑</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.company-card').forEach(card => {
    const id = parseInt(card.dataset.id);
    const emp = empresas.find(e => e.id === id);

    card.querySelector('.btn-edit-company').addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      editarEmpresa(id, emp.nome);
      return false;
    });

    card.querySelector('.btn-delete-company').addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      deletarEmpresa(id, emp.nome);
      return false;
    });

    card.addEventListener('click', (e) => {
      if (e.target.closest('.company-card-actions')) return;
      selecionarEmpresa(id);
    });
  });
}

async function selecionarEmpresa(empresaId) {
  try {
    const res = await fetch('/api/auth/select-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('inframap-empresa', empresaId);
      document.getElementById('companyScreen').classList.add('oculto');
      document.getElementById('appContainer').classList.remove('oculto');
      atualizarEmpresaBadge(empresaId);
      resetDadosCarregados();
      carregarDados();
    }
  } catch (error) {
    console.error('Erro ao selecionar empresa:', error);
  }
}

async function criarEmpresa() {
  const nome = await solicitarTexto('Nova Empresa', 'Nome da empresa:');
  if (!nome) return;

  try {
    const res = await fetch('/api/empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome })
    });
    const data = await res.json();
    if (data.success) {
      carregarEmpresas();
    } else {
      await mostrarAviso('Erro', data.message || 'Erro ao criar empresa');
    }
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    await mostrarAviso('Erro', 'Erro ao criar empresa');
  }
}

async function editarEmpresa(id, nomeAtual) {
  const nome = await solicitarTexto('Editar Empresa', 'Nome da empresa:', nomeAtual);
  if (!nome || nome === nomeAtual) return;

  try {
    const res = await fetch(`/api/empresas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome })
    });
    const data = await res.json();
    if (data.success) {
      carregarEmpresas();
    } else {
      await mostrarAviso('Erro', data.message || 'Erro ao atualizar empresa');
    }
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    await mostrarAviso('Erro', 'Erro ao atualizar empresa');
  }
}

async function deletarEmpresa(id, nome) {
  const confirmado = await solicitarConfirmacao(
    'Excluir Empresa',
    `Tem certeza que deseja excluir a empresa "${nome}"?`
  );
  if (!confirmado) return;

  try {
    const res = await fetch(`/api/empresas/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      const savedEmpresa = localStorage.getItem('inframap-empresa');
      if (savedEmpresa && Number(savedEmpresa) === id) {
        localStorage.removeItem('inframap-empresa');
      }
      carregarEmpresas();
    } else {
      await mostrarAviso('Erro', data.message || 'Erro ao excluir empresa');
    }
  } catch (error) {
    console.error('Erro ao excluir empresa:', error);
    await mostrarAviso('Erro', 'Erro ao excluir empresa');
  }
}

// Event listener para botão de adicionar empresa
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('addCompanyBtn');
  if (btn) btn.addEventListener('click', criarEmpresa);
});
