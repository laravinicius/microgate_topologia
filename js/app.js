const db = dadosVazios();

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// --- Login ---
async function fazerLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('loginScreen').style.display = 'none';
      // Pequeno delay para garantir que o cookie foi processado
      setTimeout(async () => {
        // Verifica se já tem empresa selecionada
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();

        let empresaId = sessionData.empresaId;

        if (!empresaId) {
          empresaId = await restaurarEmpresaSalva();
        }

        if (empresaId) {
          document.getElementById('appContainer').classList.remove('oculto');
          atualizarEmpresaBadge(empresaId);
          carregarDados();
        } else {
          document.getElementById('companyScreen').classList.remove('oculto');
          carregarEmpresas();
          verificarAdmin();
        }
      }, 100);
    } else {
      errorEl.textContent = data.message;
      document.getElementById('loginPassword').value = '';
    }
  } catch (error) {
    errorEl.textContent = 'Erro de conexão';
  }
}

// Enter para login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') {
    fazerLogin();
  }
});

// --- Logoff ---
async function fazerLogoff() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignorar erro do servidor
  }
  localStorage.removeItem('inframap-empresa');
  document.getElementById('companyScreen').classList.add('oculto');
  document.getElementById('appContainer').classList.add('oculto');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent = '';
}

// --- Restaurar empresa do localStorage ---
async function restaurarEmpresaSalva() {
  const savedEmpresa = localStorage.getItem('inframap-empresa');
  if (!savedEmpresa) return null;
  try {
    const res = await fetch('/api/auth/select-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: Number(savedEmpresa) })
    });
    const data = await res.json();
    if (data.success) return data.empresaId;
  } catch {}
  return null;
}

// Verificar sessão ao carregar
(async () => {
  try {
    const res = await fetch('/api/auth/session');
    const data = await res.json();
    if (data.authenticated) {
      document.getElementById('loginScreen').style.display = 'none';
      let empresaId = data.empresaId;

      if (!empresaId) {
        empresaId = await restaurarEmpresaSalva();
      }

      if (empresaId) {
        document.getElementById('appContainer').classList.remove('oculto');
        atualizarEmpresaBadge(empresaId);
        carregarDados();
      } else {
        document.getElementById('companyScreen').classList.remove('oculto');
        carregarEmpresas();
        verificarAdmin();
      }
    }
  } catch {
    // Servidor indisponível — manter tela de login
  }
})();

// --- App ---
let dadosCarregados = false;
function carregarDados() {
  if (dadosCarregados) return;
  dadosCarregados = true;
  document.getElementById('novaMesa').addEventListener('click', criarMesa);
  document.getElementById('novoRack').addEventListener('click', criarRack);
  document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
  document.getElementById('syncBtn').addEventListener('click', sincronizarManual);
  sincronizarBanco();
}

function resetDadosCarregados() {
  dadosCarregados = false;
}

// --- Empresa Badge ---
async function atualizarEmpresaBadge(empresaId) {
  try {
    const res = await fetch('/api/auth/session-info');
    const data = await res.json();
    const badge = document.getElementById('empresaBadge');
    if (badge) {
      badge.textContent = data.empresaNome || 'Sem empresa';
      badge.title = 'Trocar empresa';
      badge.onclick = () => {
        document.getElementById('appContainer').classList.add('oculto');
        document.getElementById('companyScreen').classList.remove('oculto');
        carregarEmpresas();
      };
    }
  } catch (e) {
    console.error('Erro ao carregar info da empresa:', e);
  }
}

// --- Painel de Usu\u00e1rios ---
async function verificarAdmin() {
  try {
    const res = await fetch('/api/auth/session-info');
    const data = await res.json();
    const btn = document.getElementById('usuariosBtn');
    if (btn) {
      btn.style.display = data.isAdmin ? 'block' : 'none';
    }
  } catch {}
}

function toggleUsuariosPanel() {
  const panel = document.getElementById('usuariosPanel');
  panel.classList.toggle('oculto');
  if (!panel.classList.contains('oculto')) {
    carregarUsuarios();
  }
}
