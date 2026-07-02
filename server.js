require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'inframap-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

// --- SSE: conexões ativas ---
const sseClients = new Set();

function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const disconnected = [];
  for (const res of sseClients) {
    try {
      if (!res.write(message)) disconnected.push(res);
    } catch {
      disconnected.push(res);
    }
  }
  for (const res of disconnected) sseClients.delete(res);
}

setInterval(() => {
  const disconnected = [];
  for (const res of sseClients) {
    try { res.write(': heartbeat\n\n'); }
    catch { disconnected.push(res); }
  }
  for (const res of disconnected) sseClients.delete(res);
}, 15000);

// --- Middleware ---
app.use(cors({
  origin: [
    'http://topologia.microgateinformatica.com.br',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json());

// --- JWT Helpers ---
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.query.token) return req.query.token;
  return null;
}

// --- Middleware de autenticação JWT ---
function requireAuth(req, res, next) {
  const token = extractToken(req);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }
  req.user = decoded;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.username !== 'admin') {
    return res.status(403).json({ success: false, message: 'Apenas admin pode gerenciar usuários' });
  }
  next();
}

function requireEmpresa(req, res, next) {
  if (!req.user?.empresaId) {
    return res.status(403).json({ success: false, message: 'Selecione uma empresa' });
  }
  next();
}

function requireAndar(req, res, next) {
  if (!req.user?.andarId) {
    return res.status(403).json({ success: false, message: 'Selecione um andar' });
  }
  next();
}

// --- Servir arquivos estáticos ---
app.use(express.static(__dirname));
app.use('/img', express.static(path.join(__dirname, 'img')));

// --- Auth endpoints ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuário e senha necessários' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, username, password_hash, is_active FROM users WHERE username = ?',
      [username.trim().toLowerCase()]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    const token = signToken({ username: user.username, userId: user.id, empresaId: null });
    res.json({ success: true, token, username: user.username });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = extractToken(req);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    username: decoded.username,
    empresaId: decoded.empresaId || null,
    andarId: decoded.andarId || null
  });
});

app.get('/api/auth/session-info', (req, res) => {
  const token = extractToken(req);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.json({ empresaId: null, empresaNome: null, andarId: null, andarNome: null, isAdmin: false });
  }

  const isAdmin = decoded.username === 'admin';

  if (!decoded.empresaId) {
    return res.json({ empresaId: null, empresaNome: null, andarId: null, andarNome: null, isAdmin });
  }

  (async () => {
    try {
      const [empRows] = await db.query('SELECT nome FROM empresas WHERE id = ?', [decoded.empresaId]);
      let andarNome = null;
      if (decoded.andarId) {
        const [andRows] = await db.query('SELECT nome FROM andares WHERE id = ?', [decoded.andarId]);
        andarNome = andRows.length > 0 ? andRows[0].nome : null;
      }
      res.json({
        empresaId: decoded.empresaId,
        empresaNome: empRows.length > 0 ? empRows[0].nome : null,
        andarId: decoded.andarId || null,
        andarNome,
        isAdmin
      });
    } catch {
      res.json({ empresaId: decoded.empresaId, empresaNome: null, andarId: decoded.andarId || null, andarNome: null, isAdmin });
    }
  })();
});

app.post('/api/auth/select-company', requireAuth, async (req, res) => {
  const { empresaId } = req.body;
  if (!empresaId) {
    return res.status(400).json({ success: false, message: 'Dados inválidos' });
  }

  try {
    const [rows] = await db.query('SELECT nome FROM empresas WHERE id = ?', [empresaId]);
    const empresaNome = rows.length > 0 ? rows[0].nome : null;

    const token = signToken({
      username: req.user.username,
      userId: req.user.userId,
      empresaId: Number(empresaId),
      andarId: null
    });

    res.json({ success: true, token, empresaId: Number(empresaId), empresaNome });
  } catch (error) {
    console.error('Erro ao selecionar empresa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.post('/api/auth/select-andar', requireAuth, requireEmpresa, async (req, res) => {
  const { andarId } = req.body;
  if (!andarId) {
    return res.status(400).json({ success: false, message: 'Dados inválidos' });
  }

  try {
    const [rows] = await db.query('SELECT nome FROM andares WHERE id = ? AND empresa_id = ?', [andarId, req.user.empresaId]);
    const andarNome = rows.length > 0 ? rows[0].nome : null;

    const token = signToken({
      username: req.user.username,
      userId: req.user.userId,
      empresaId: req.user.empresaId,
      andarId: Number(andarId)
    });

    res.json({ success: true, token, andarId: Number(andarId), andarNome });
  } catch (error) {
    console.error('Erro ao selecionar andar:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- CRUD de Usuários ---
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, username, is_active, created_at FROM users ORDER BY username');
    res.json({ success: true, users: rows });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Usuário e senha necessários' });
  }

  try {
    const hash = await bcrypt.hash(password, 8);
    await db.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username.trim().toLowerCase(), hash]);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Usuário já existe' });
    }
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password, is_active } = req.body;

  const updates = [];
  const values = [];

  if (password) {
    updates.push('password_hash = ?');
    values.push(await bcrypt.hash(password, 8));
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Nada para atualizar' });
  }

  values.push(id);
  try {
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- CRUD de Empresas ---
app.get('/api/empresas', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, created_at FROM empresas ORDER BY nome');
    res.json({ success: true, empresas: rows });
  } catch (error) {
    console.error('Erro ao listar empresas:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.post('/api/empresas', requireAuth, async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome da empresa necessário' });
  }
  try {
    const [result] = await db.query('INSERT INTO empresas (nome) VALUES (?)', [nome.trim()]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Empresa já existe' });
    }
    console.error('Erro ao criar empresa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.put('/api/empresas/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome necessário' });
  }
  try {
    await db.query('UPDATE empresas SET nome = ? WHERE id = ?', [nome.trim(), id]);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Nome já existe' });
    }
    console.error('Erro ao atualizar empresa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.delete('/api/empresas/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM empresas WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- CRUD de Andares ---
app.get('/api/andares', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, nome, created_at FROM andares WHERE empresa_id = ? ORDER BY nome', [req.user.empresaId]);
    res.json({ success: true, andares: rows });
  } catch (error) {
    console.error('Erro ao listar andares:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.post('/api/andares', requireAuth, requireEmpresa, async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome do andar necessário' });
  }
  try {
    const [result] = await db.query('INSERT INTO andares (empresa_id, nome) VALUES (?, ?)', [req.user.empresaId, nome.trim()]);
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Andar já existe nesta empresa' });
    }
    console.error('Erro ao criar andar:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.put('/api/andares/:id', requireAuth, requireEmpresa, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome necessário' });
  }
  try {
    await db.query('UPDATE andares SET nome = ? WHERE id = ? AND empresa_id = ?', [nome.trim(), id, req.user.empresaId]);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Nome já existe nesta empresa' });
    }
    console.error('Erro ao atualizar andar:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.delete('/api/andares/:id', requireAuth, requireEmpresa, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM andares WHERE id = ? AND empresa_id = ?', [id, req.user.empresaId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar andar:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- SSE ---
app.get('/api/sse', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  sseClients.add(res);

  req.on('close', () => sseClients.delete(res));
});

// --- Data endpoints ---
function toBool(value) {
  return value === true || value === 1 || value === '1';
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeData(data) {
  const mesas = Array.isArray(data?.mesas) ? data.mesas : [];
  const racks = Array.isArray(data?.racks) ? data.racks : [];

  return {
    mesas: mesas.map(mesa => ({
      id: Number(mesa.id),
      nome: String(mesa.nome || '').trim(),
      x: Number.isFinite(Number(mesa.x)) ? Number(mesa.x) : 100,
      y: Number.isFinite(Number(mesa.y)) ? Number(mesa.y) : 100,
      fixada: toBool(mesa.fixada),
        pontos: Array.isArray(mesa.pontos) ? mesa.pontos.map(ponto => ({
          id: Number(ponto.id),
          rackId: toNullableNumber(ponto.rackId),
          patchId: toNullableNumber(ponto.patchId),
          porta: toNullableNumber(ponto.porta),
          atencao: Boolean(ponto.atencao)
        })) : []
    })),
    racks: racks.map(rack => ({
      id: Number(rack.id),
      nome: String(rack.nome || '').trim(),
      patchPanels: Array.isArray(rack.patchPanels) ? rack.patchPanels.map(pp => ({
        id: Number(pp.id),
        nome: String(pp.nome || '').trim(),
        portas: Number.isFinite(Number(pp.portas)) ? Number(pp.portas) : 24
      })) : []
    }))
  };
}

function validateData(data) {
  const ids = { mesas: new Set(), racks: new Set(), patchPanels: new Set() };
  const patchPanelRack = new Map();

  for (const mesa of data.mesas) {
    if (!Number.isSafeInteger(mesa.id) || !mesa.nome) return 'Mesa inválida.';
    if (ids.mesas.has(mesa.id)) return `Mesa duplicada: ${mesa.id}.`;
    ids.mesas.add(mesa.id);

    const pontos = new Set();
    for (const ponto of mesa.pontos) {
      if (!Number.isSafeInteger(ponto.id) || ponto.id < 1 || ponto.id > 255) return `Ponto inválido na mesa ${mesa.nome}.`;
      if (pontos.has(ponto.id)) return `Ponto duplicado na mesa ${mesa.nome}.`;
      pontos.add(ponto.id);
    }
  }

  for (const rack of data.racks) {
    if (!Number.isSafeInteger(rack.id) || !rack.nome) return 'Rack inválido.';
    if (ids.racks.has(rack.id)) return `Rack duplicado: ${rack.id}.`;
    ids.racks.add(rack.id);

    for (const pp of rack.patchPanels) {
      if (!Number.isSafeInteger(pp.id) || !pp.nome) return `Patch panel inválido no rack ${rack.nome}.`;
      if (!Number.isInteger(pp.portas) || pp.portas < 1 || pp.portas > 255) return `Quantidade de portas inválida no patch panel ${pp.nome}.`;
      if (ids.patchPanels.has(pp.id)) return `Patch panel duplicado: ${pp.id}.`;
      ids.patchPanels.add(pp.id);
      patchPanelRack.set(pp.id, rack.id);
    }
  }

  for (const mesa of data.mesas) {
    for (const ponto of mesa.pontos) {
      const vazio = !ponto.rackId && !ponto.patchId && !ponto.porta;
      if (vazio) continue;
      if (!ids.racks.has(ponto.rackId) || !ids.patchPanels.has(ponto.patchId) || !ponto.porta) return `Vínculo inválido no ponto ${ponto.id} da mesa ${mesa.nome}.`;
      if (patchPanelRack.get(ponto.patchId) !== ponto.rackId) return `Vínculo inválido no ponto ${ponto.id} da mesa ${mesa.nome}.`;
    }
  }

  return null;
}

async function loadData(empresaId, andarId) {
  const [racksRows] = await db.query(
    'SELECT id, nome FROM racks WHERE empresa_id = ? ORDER BY created_at, id', [empresaId]
  );
  const [patchPanelRows] = await db.query(
    'SELECT id, rack_id, nome, portas FROM patch_panels WHERE rack_id IN (SELECT id FROM racks WHERE empresa_id = ?) ORDER BY created_at, id', [empresaId]
  );

  const racksById = new Map();
  const racks = racksRows.map(row => {
    const rack = { id: Number(row.id), nome: row.nome, patchPanels: [] };
    racksById.set(rack.id, rack);
    return rack;
  });

  patchPanelRows.forEach(row => {
    const rack = racksById.get(Number(row.rack_id));
    if (!rack) return;
    rack.patchPanels.push({ id: Number(row.id), nome: row.nome, portas: Number(row.portas) });
  });

  let mesas = [];
  if (andarId) {
    const [mesasRows] = await db.query(
      `SELECT m.id, m.nome, m.x, m.y, m.fixada,
              COALESCE(a.nome, '') AS andar_nome
       FROM mesas m
       LEFT JOIN andares a ON a.id = m.andar_id
       WHERE m.empresa_id = ? AND m.andar_id = ?
       ORDER BY m.created_at, m.id`,
      [empresaId, andarId]
    );
    const [pontosRows] = await db.query(
      'SELECT mesa_id, numero, rack_id, patch_panel_id, porta, atencao FROM mesa_pontos WHERE mesa_id IN (SELECT id FROM mesas WHERE empresa_id = ? AND andar_id = ?) ORDER BY numero',
      [empresaId, andarId]
    );

    const mesasById = new Map();
    mesas = mesasRows.map(row => {
      const mesa = {
        id: Number(row.id), nome: row.nome, x: Number(row.x), y: Number(row.y),
        fixada: Boolean(row.fixada), andarNome: row.andar_nome, pontos: []
      };
      mesasById.set(mesa.id, mesa);
      return mesa;
    });

    pontosRows.forEach(row => {
      const mesa = mesasById.get(Number(row.mesa_id));
      if (!mesa) return;
      mesa.pontos.push({
        id: Number(row.numero),
        rackId: row.rack_id === null ? null : Number(row.rack_id),
        patchId: row.patch_panel_id === null ? null : Number(row.patch_panel_id),
        porta: row.porta === null ? null : Number(row.porta),
        atencao: Boolean(row.atencao)
      });
    });
  }

  return { mesas, racks };
}

async function loadAllMesas(empresaId) {
  const [mesasRows] = await db.query(
    `SELECT m.id, m.nome, m.x, m.y, m.fixada,
            COALESCE(a.nome, '') AS andar_nome
     FROM mesas m
     LEFT JOIN andares a ON a.id = m.andar_id
     WHERE m.empresa_id = ?
     ORDER BY a.nome, m.created_at, m.id`,
    [empresaId]
  );
  const [pontosRows] = await db.query(
    `SELECT mesa_id, numero, rack_id, patch_panel_id, porta, atencao
     FROM mesa_pontos
     WHERE mesa_id IN (SELECT id FROM mesas WHERE empresa_id = ?)
     ORDER BY numero`,
    [empresaId]
  );

  const mesasById = new Map();
  const mesas = mesasRows.map(row => {
    const mesa = {
      id: Number(row.id), nome: row.nome, x: Number(row.x), y: Number(row.y),
      fixada: Boolean(row.fixada), andarNome: row.andar_nome, pontos: []
    };
    mesasById.set(mesa.id, mesa);
    return mesa;
  });

  pontosRows.forEach(row => {
    const mesa = mesasById.get(Number(row.mesa_id));
    if (!mesa) return;
    mesa.pontos.push({
      id: Number(row.numero),
      rackId: row.rack_id === null ? null : Number(row.rack_id),
      patchId: row.patch_panel_id === null ? null : Number(row.patch_panel_id),
      porta: row.porta === null ? null : Number(row.porta),
      atencao: Boolean(row.atencao)
    });
  });

  return mesas;
}

async function loadAllMesasByAndar(empresaId, andarId) {
  const [mesasRows] = await db.query(
    `SELECT m.id, m.nome, m.x, m.y, m.fixada,
            COALESCE(a.nome, '') AS andar_nome
     FROM mesas m
     LEFT JOIN andares a ON a.id = m.andar_id
     WHERE m.empresa_id = ? AND m.andar_id = ?
     ORDER BY m.created_at, m.id`,
    [empresaId, andarId]
  );
  const [pontosRows] = await db.query(
    `SELECT mesa_id, numero, rack_id, patch_panel_id, porta, atencao
     FROM mesa_pontos
     WHERE mesa_id IN (SELECT id FROM mesas WHERE empresa_id = ? AND andar_id = ?)
     ORDER BY numero`,
    [empresaId, andarId]
  );

  const mesasById = new Map();
  const mesas = mesasRows.map(row => {
    const mesa = {
      id: Number(row.id), nome: row.nome, x: Number(row.x), y: Number(row.y),
      fixada: Boolean(row.fixada), andarNome: row.andar_nome, pontos: []
    };
    mesasById.set(mesa.id, mesa);
    return mesa;
  });

  pontosRows.forEach(row => {
    const mesa = mesasById.get(Number(row.mesa_id));
    if (!mesa) return;
    mesa.pontos.push({
      id: Number(row.numero),
      rackId: row.rack_id === null ? null : Number(row.rack_id),
      patchId: row.patch_panel_id === null ? null : Number(row.patch_panel_id),
      porta: row.porta === null ? null : Number(row.porta),
      atencao: Boolean(row.atencao)
    });
  });

  return mesas;
}

async function saveMesasData(mesas, empresaId, andarId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM mesa_pontos WHERE mesa_id IN (SELECT id FROM mesas WHERE empresa_id = ? AND andar_id = ?)', [empresaId, andarId]);
    await connection.query('DELETE FROM mesas WHERE empresa_id = ? AND andar_id = ?', [empresaId, andarId]);

    for (const mesa of mesas) {
      await connection.query('INSERT INTO mesas (id, nome, x, y, fixada, empresa_id, andar_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [mesa.id, mesa.nome, mesa.x, mesa.y, mesa.fixada ? 1 : 0, empresaId, andarId]);
      for (const ponto of mesa.pontos) {
        await connection.query('INSERT INTO mesa_pontos (id, mesa_id, numero, rack_id, patch_panel_id, porta, atencao) VALUES (?, ?, ?, ?, ?, ?, ?)', [(mesa.id * 100) + ponto.id, mesa.id, ponto.id, ponto.rackId, ponto.patchId, ponto.porta, ponto.atencao ? 1 : 0]);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveRacksData(racks, empresaId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existingRacks] = await connection.query(
      'SELECT id FROM racks WHERE empresa_id = ?', [empresaId]
    );
    const existingRackIds = new Set(existingRacks.map(r => Number(r.id)));

    const [existingPPs] = await connection.query(
      'SELECT id FROM patch_panels WHERE rack_id IN (SELECT id FROM racks WHERE empresa_id = ?)', [empresaId]
    );
    const existingPPIds = new Set(existingPPs.map(p => Number(p.id)));

    const newRackIds = new Set(racks.map(r => Number(r.id)));
    const newPPIds = new Set();
    for (const rack of racks) {
      for (const pp of rack.patchPanels) {
        newPPIds.add(Number(pp.id));
      }
    }

    for (const id of existingPPIds) {
      if (!newPPIds.has(id)) {
        await connection.query('DELETE FROM patch_panels WHERE id = ?', [id]);
      }
    }

    for (const id of existingRackIds) {
      if (!newRackIds.has(id)) {
        await connection.query('DELETE FROM racks WHERE id = ?', [id]);
      }
    }

    for (const rack of racks) {
      await connection.query(
        'INSERT INTO racks (id, nome, empresa_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nome = VALUES(nome)',
        [rack.id, rack.nome, empresaId]
      );
      for (const pp of rack.patchPanels) {
        await connection.query(
          'INSERT INTO patch_panels (id, rack_id, nome, portas) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rack_id = VALUES(rack_id), nome = VALUES(nome), portas = VALUES(portas)',
          [pp.id, rack.id, pp.nome, pp.portas]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

app.get('/api/data', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const [data, allMesas] = await Promise.all([
      loadData(req.user.empresaId, req.user.andarId),
      loadAllMesas(req.user.empresaId)
    ]);
    res.json({ success: true, mesas: data.mesas, racks: data.racks, allMesas });
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    res.status(500).json({ success: false, message: 'Falha ao carregar dados do banco', error: error.message });
  }
});

app.post('/api/racks', requireAuth, requireEmpresa, async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome do rack necessario' });
  }
  try {
    const [maxRows] = await db.query('SELECT MAX(id) as maxId FROM racks');
    const newId = (maxRows[0].maxId || 0) + 1;
    await db.query('INSERT INTO racks (id, nome, empresa_id) VALUES (?, ?, ?)', [newId, nome.trim(), req.user.empresaId]);
    res.json({ success: true, rack: { id: newId, nome: nome.trim() } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Rack ja existe nesta empresa' });
    }
    console.error('Erro ao criar rack:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.get('/api/racks', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const { andarId } = req.query;
    const [racksData, mesas] = await Promise.all([
      loadData(req.user.empresaId, null),
      andarId ? loadAllMesasByAndar(req.user.empresaId, Number(andarId)) : loadAllMesas(req.user.empresaId)
    ]);
    res.json({ success: true, racks: racksData.racks, mesas });
  } catch (error) {
    console.error('Erro ao carregar racks:', error);
    res.status(500).json({ success: false, message: 'Falha ao carregar racks do banco', error: error.message });
  }
});

app.put('/api/data', requireAuth, requireEmpresa, requireAndar, async (req, res) => {
  try {
    const data = normalizeData(req.body);
    const validationError = validateData(data);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    await saveMesasData(data.mesas, req.user.empresaId, req.user.andarId);
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    res.status(500).json({ success: false, message: 'Falha ao salvar dados no banco', error: error.message });
  }
});

app.put('/api/racks', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const data = normalizeData(req.body);
    const validationError = validateData(data);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    await saveRacksData(data.racks, req.user.empresaId);
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao salvar racks:', error);
    res.status(500).json({ success: false, message: 'Falha ao salvar racks no banco', error: error.message });
  }
});

app.put('/api/racks/:id', requireAuth, requireEmpresa, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome necessário' });
  }
  try {
    await db.query('UPDATE racks SET nome = ? WHERE id = ? AND empresa_id = ?', [nome.trim(), id, req.user.empresaId]);
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Nome já existe nesta empresa' });
    }
    console.error('Erro ao atualizar rack:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.put('/api/mesas/:id', requireAuth, requireEmpresa, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ success: false, message: 'Nome necessário' });
  }
  try {
    await db.query('UPDATE mesas SET nome = ? WHERE id = ? AND empresa_id = ?', [nome.trim(), id, req.user.empresaId]);
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Nome já existe nesta empresa' });
    }
    console.error('Erro ao atualizar mesa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.put('/api/ponto/toggle-atencao', requireAuth, requireEmpresa, async (req, res) => {
  const { rackId, patchId, porta } = req.body;
  if (rackId == null || patchId == null || porta == null) {
    return res.status(400).json({ success: false, message: 'rackId, patchId e porta são obrigatórios' });
  }
  try {
    const [rows] = await db.query(
      'SELECT mp.id FROM mesa_pontos mp JOIN mesas m ON mp.mesa_id = m.id WHERE mp.rack_id = ? AND mp.patch_panel_id = ? AND mp.porta = ? AND m.empresa_id = ?',
      [rackId, patchId, porta, req.user.empresaId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ponto não encontrado' });
    }
    for (const row of rows) {
      await db.query('UPDATE mesa_pontos SET atencao = NOT atencao WHERE id = ?', [row.id]);
    }
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao toggle atencao:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- QR Code: gerar imagem PNG ---
app.get('/api/mesas/:id/qr', requireAuth, requireEmpresa, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT id FROM mesas WHERE id = ? AND empresa_id = ?',
      [id, req.user.empresaId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mesa não encontrada' });
    }
    const baseUrl = process.env.QR_BASE_URL || 'http://topologia.microgateinformatica.com.br';
    const url = `${baseUrl}/mesa/${id}`;
    const pngBuffer = await QRCode.toBuffer(url, { width: 400, margin: 2 });
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="mesa-${id}-qr.png"`
    });
    res.send(pngBuffer);
  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar QR code' });
  }
});

// --- QR Code: dados públicos da mesa (sem auth) ---
app.get('/api/mesas/por-id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [mesaRows] = await db.query(
      `SELECT m.id, m.nome, e.nome AS empresa_nome, a.nome AS andar_nome
       FROM mesas m
       JOIN empresas e ON e.id = m.empresa_id
       LEFT JOIN andares a ON a.id = m.andar_id
       WHERE m.id = ?`,
      [id]
    );
    if (mesaRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mesa não encontrada' });
    }

    const [pontosRows] = await db.query(
      `SELECT mp.numero AS ponto, r.nome AS rack_nome, pp.nome AS patch_nome, mp.porta, mp.atencao
       FROM mesa_pontos mp
       LEFT JOIN racks r ON r.id = mp.rack_id
       LEFT JOIN patch_panels pp ON pp.id = mp.patch_panel_id
       WHERE mp.mesa_id = ?
       ORDER BY mp.numero`,
      [id]
    );

    const pontos = pontosRows.map(row => ({
      ponto: Number(row.ponto),
      rackNome: row.rack_nome || null,
      patchNome: row.patch_nome || null,
      porta: row.porta || null,
      atencao: Boolean(row.atencao),
      vinculado: !!(row.rack_nome && row.patch_nome && row.porta)
    }));

    res.json({
      success: true,
      mesa: {
        id: mesaRows[0].id,
        nome: mesaRows[0].nome,
        empresaNome: mesaRows[0].empresa_nome,
        andarNome: mesaRows[0].andar_nome || null,
        pontos
      }
    });
  } catch (error) {
    console.error('Erro ao buscar mesa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- Página pública da mesa (target do QR code) ---
app.get('/mesa/:id', (req, res) => {
  const mesaId = req.params.id;
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mesa</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0e17;color:#e0e6ed;padding:16px}
.card{background:#111827;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #1e293b}
h1{font-size:22px;margin-bottom:4px}
.sub{color:#94a3b8;font-size:14px;margin-bottom:0}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;margin-top:8px}
.badge-empresa{background:#1e3a5f;color:#60a5fa}
.badge-andar{background:#1e3a5f;color:#60a5fa}
table{width:100%;border-collapse:collapse}
th{padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #1e293b}
td{padding:10px 12px;border-bottom:1px solid #1e293b;font-size:14px}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}
.dot-on{background:#22c55e}
.dot-off{background:#475569}
.dot-atn{background:#f59e0b}
.link{color:#60a5fa;font-size:13px}
.loading{text-align:center;padding:60px 20px;color:#64748b}
.error{text-align:center;padding:60px 20px;color:#ef4444}
</style>
</head>
<body>
<div id="app">
<div class="loading">Carregando...</div>
</div>
<script>
(async()=>{
const id=${mesaId};
const el=document.getElementById('app');
try{
const res=await fetch('/api/mesas/por-id/'+id);
const json=await res.json();
if(!json.success||!json.mesa){el.innerHTML='<div class="error">Mesa não encontrada</div>';return}
const m=json.mesa;
let h='<div class="card"><h1>'+esc(m.nome)+'</h1>';
if(m.empresaNome)h+='<span class="badge badge-empresa">'+esc(m.empresaNome)+'</span>';
if(m.andarNome)h+='<span class="badge badge-andar">'+esc(m.andarNome)+'</span>';
h+='</div>';
h+='<div class="card"><table><thead><tr><th>Ponto</th><th>Status</th><th>Vínculo</th></tr></thead><tbody>';
for(const p of m.pontos){
const dot=p.vinculado?(p.atencao?'dot-on dot-atn':'dot-on'):'dot-off';
const status=p.vinculado?(p.atencao?'Atenção':'Vinculado'):'Livre';
const link=p.vinculado?esc(p.rackNome)+' / '+esc(p.patchNome)+' #'+p.porta:'—';
h+='<tr><td>P'+p.ponto+'</td><td><span class="dot '+dot+'"></span>'+status+'</td><td class="link">'+link+'</td></tr>';
}
h+='</tbody></table></div>';
el.innerHTML=h;
}catch(e){el.innerHTML='<div class="error">Erro ao carregar dados</div>'}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
})();
</script>
</body>
</html>`);
});

// --- Mapa: CRUD de elementos ---
app.get('/api/map-elements', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const { andarId } = req.query;
    let query = 'SELECT * FROM map_elements WHERE empresa_id = ?';
    const params = [req.user.empresaId];
    if (andarId) {
      query += ' AND andar_id = ?';
      params.push(Number(andarId));
    } else {
      query += ' AND andar_id IS NULL';
    }
    query += ' ORDER BY ordem, id';
    const [rows] = await db.query(query, params);
    res.json({ success: true, elements: rows.map(r => ({ ...r, dados_json: r.dados_json ? JSON.parse(r.dados_json) : null })) });
  } catch (error) {
    console.error('Erro ao carregar elementos do mapa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.post('/api/map-elements', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const { andarId, tipo, nome, x, y, largura, altura, cor, rotacao, ordem, dados_json } = req.body;
    const [result] = await db.query(
      'INSERT INTO map_elements (empresa_id, andar_id, tipo, nome, x, y, largura, altura, cor, rotacao, ordem, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.empresaId, andarId || null, tipo || 'objeto', nome || '', Number(x) || 0, Number(y) || 0, Number(largura) || 100, Number(altura) || 60, cor || '#374151', Number(rotacao) || 0, Number(ordem) || 0, dados_json ? JSON.stringify(dados_json) : null]
    );
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar elemento do mapa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// Bulk save MUST be before :id route so Express matches it first
app.put('/api/map-elements/bulk', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const { elements, andarId } = req.body;
    if (!Array.isArray(elements)) return res.status(400).json({ success: false, message: 'elements deve ser um array' });
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (andarId) {
        await connection.query('DELETE FROM map_elements WHERE empresa_id = ? AND andar_id = ?', [req.user.empresaId, Number(andarId)]);
      } else {
        await connection.query('DELETE FROM map_elements WHERE empresa_id = ? AND andar_id IS NULL', [req.user.empresaId]);
      }
      for (const el of elements) {
        await connection.query(
          'INSERT INTO map_elements (empresa_id, andar_id, tipo, nome, x, y, largura, altura, cor, rotacao, ordem, dados_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [req.user.empresaId, el.andarId || null, el.tipo || 'objeto', el.nome || '', Number(el.x) || 0, Number(el.y) || 0, Number(el.largura) || 100, Number(el.altura) || 60, el.cor || '#374151', Number(el.rotacao) || 0, Number(el.ordem) || 0, el.dados_json ? JSON.stringify(el.dados_json) : null]
        );
      }
      await connection.commit();
      broadcastSSE({ type: 'update', timestamp: Date.now() });
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro ao salvar elementos do mapa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.put('/api/map-elements/:id', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const { id } = req.params;
    const { andarId, tipo, nome, x, y, largura, altura, cor, rotacao, ordem, dados_json } = req.body;
    const [existing] = await db.query('SELECT * FROM map_elements WHERE id = ? AND empresa_id = ?', [id, req.user.empresaId]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Elemento não encontrado' });
    const old = existing[0];
    await db.query(
      'UPDATE map_elements SET andar_id = ?, tipo = ?, nome = ?, x = ?, y = ?, largura = ?, altura = ?, cor = ?, rotacao = ?, ordem = ?, dados_json = ? WHERE id = ? AND empresa_id = ?',
      [andarId !== undefined ? (andarId || null) : old.andar_id, tipo || old.tipo, nome !== undefined ? nome : old.nome, Number(x) ?? old.x, Number(y) ?? old.y, Number(largura) || old.largura, Number(altura) || old.altura, cor || old.cor, Number(rotacao) || old.rotacao, Number(ordem) ?? old.ordem, dados_json !== undefined ? (dados_json ? JSON.stringify(dados_json) : null) : old.dados_json, id, req.user.empresaId]
    );
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar elemento do mapa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

app.delete('/api/map-elements/:id', requireAuth, requireEmpresa, async (req, res) => {
  try {
    await db.query('DELETE FROM map_elements WHERE id = ? AND empresa_id = ?', [req.params.id, req.user.empresaId]);
    broadcastSSE({ type: 'update', timestamp: Date.now() });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar elemento do mapa:', error);
    res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

// --- Em produção, servir o build do frontend ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
  app.get('/{*path}', (req, res) => {
    if (req.path.startsWith('/api/')) return;
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  });
}

// --- Iniciar servidor ---
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
