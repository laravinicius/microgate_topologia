require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
        porta: toNullableNumber(ponto.porta)
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
      'SELECT mesa_id, numero, rack_id, patch_panel_id, porta FROM mesa_pontos WHERE mesa_id IN (SELECT id FROM mesas WHERE empresa_id = ? AND andar_id = ?) ORDER BY numero',
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
        porta: row.porta === null ? null : Number(row.porta)
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
    `SELECT mesa_id, numero, rack_id, patch_panel_id, porta
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
      porta: row.porta === null ? null : Number(row.porta)
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
        await connection.query('INSERT INTO mesa_pontos (id, mesa_id, numero, rack_id, patch_panel_id, porta) VALUES (?, ?, ?, ?, ?, ?)', [(mesa.id * 100) + ponto.id, mesa.id, ponto.id, ponto.rackId, ponto.patchId, ponto.porta]);
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

app.get('/api/racks', requireAuth, requireEmpresa, async (req, res) => {
  try {
    const [racksData, mesas] = await Promise.all([
      loadData(req.user.empresaId, null),
      loadAllMesas(req.user.empresaId)
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
