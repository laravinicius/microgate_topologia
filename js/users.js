// --- Gerenciamento de Usuários ---

let usuariosCache = [];

async function carregarUsuarios() {
    try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
            usuariosCache = data.users;
            renderizarUsuarios();
        }
    } catch (err) {
        console.error('Erro ao carregar usuários:', err);
    }
}

function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderizarUsuarios() {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;

    container.innerHTML = usuariosCache.map(u => `
        <div class="usuarioItem" data-id="${u.id}">
            <span class="usuarioNome">
                ${escapeHTML(u.username)}
                ${!u.is_active ? '<span class="usuarioInativo">(inativo)</span>' : ''}
            </span>
            <div class="usuarioAcoes">
                <button class="btnAcao btnEditarUsuario" onclick="editarUsuario(${u.id})" title="Editar">✎</button>
                <button class="btnAcao btnDesativarUsuario" onclick="desativarUsuario(${u.id})" title="Desativar">✕</button>
            </div>
        </div>
    `).join('');
}

async function criarUsuario() {
    const username = await solicitarTexto('Novo Usuário', 'Nome de usuário:');
    if (!username) return;

    const password = await solicitarTexto('Nova Senha', 'Senha para ' + username + ':');
    if (!password) return;

    try {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            await carregarUsuarios();
        } else {
            await mostrarAviso('Erro', data.message);
        }
    } catch (err) {
        await mostrarAviso('Erro', 'Erro de conexão');
    }
}

async function editarUsuario(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;

    const password = await solicitarTexto('Alterar Senha', 'Nova senha para ' + usuario.username + ':');
    if (!password) return;

    try {
        const res = await fetch('/api/users/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
            await carregarUsuarios();
        } else {
            await mostrarAviso('Erro', data.message);
        }
    } catch (err) {
        await mostrarAviso('Erro', 'Erro de conexão');
    }
}

async function desativarUsuario(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;

    const confirm = await solicitarConfirmacao(
        'Desativar Usuário',
        'Deseja desativar ' + usuario.username + '?'
    );
    if (!confirm) return;

    try {
        const res = await fetch('/api/users/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            await carregarUsuarios();
        } else {
            await mostrarAviso('Erro', data.message);
        }
    } catch (err) {
        await mostrarAviso('Erro', 'Erro de conexão');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('novoUsuario');
    if (btn) btn.addEventListener('click', criarUsuario);
});
