# Topologia — Mapa de Infraestrutura de Rede

Sistema interno da Microgate para mapeamento visual de mesas, racks, patch panels e portas de rede. Permite vincular pontos de rede de cada mesa a portas físicas de patch panels, com suporte a múltiplas empresas.

## Stack

- **Backend:** Node.js + Express 5, CommonJS (`require`)
- **Banco:** MySQL via `mysql2/promise` (pool de conexões em `db.js`)
- **Auth:** Sessões em memória (Map), cookie `session_token`, sem JWT
- **Realtime:** SSE (Server-Sent Events) em `/api/sse` para sincronização entre clientes
- **Frontend:** HTML/CSS/JS vanilla — sem framework, sem build step
- **Deploy:** PM2 (`ecosystem.config.js`), Nginx Proxy, produção em `/var/www/topologia`
- **Config:** `.env` com `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`

## Estrutura do projeto

```
topologia/
├── server.js          # Toda a lógica de backend e rotas REST
├── db.js              # Pool mysql2 (importado como `pool`)
├── db.sql             # Schema completo + criação de usuário MySQL
├── ecosystem.config.js # PM2 config
├── index.html         # SPA única — todo o HTML está aqui
├── css/style.css      # Estilos globais
├── js/
│   ├── app.js         # Init, SSE listener, troca de empresa
│   ├── mapa.js        # Renderização do mapa, mesas, pontos, vínculos
│   ├── racks.js       # CRUD de racks e patch panels
│   ├── empresas.js    # CRUD de empresas
│   ├── users.js       # CRUD de usuários
│   ├── storage.js     # Persistência via API (GET/PUT /api/data)
│   ├── prompts.js     # Modais/overlays de criação/edição
│   └── ...
├── database/
│   └── migrations/    # SQL de migração (ex: adiciona_empresas)
└── .verboo/
    └── settings.local.json  # Permissões de ferramentas do agente
```

## Banco de dados (inframap)

Tabelas principais:
- `users` — autenticação (username, password_hash bcrypt, is_active)
- `empresas` — multi-tenant: cada sessão tem empresa selecionada
- `racks` — racks de rede (id BIGINT gerado no frontend)
- `patch_panels` — pertence a rack, tem N portas (padrão 24), FK CASCADE
- `mesas` — mesas de trabalho com posição x/y no mapa
- `mesa_pontos` — pontos de rede de cada mesa; vínculo: rack_id + patch_panel_id + porta (UNIQUE)
- `app_config` — configurações chave-valor (ex: admin_password_hash)

IDs são BIGINT gerados no frontend (timestamp/random), não AUTO_INCREMENT.

## Rotas da API

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/session
POST   /api/auth/select-company
GET    /api/auth/session-info

GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id

GET    /api/empresas
POST   /api/empresas
PUT    /api/empresas/:id
DELETE /api/empresas/:id

GET    /api/sse           # SSE — sincronização em tempo real
GET    /api/data          # Retorna estado completo (racks, mesas, etc) da empresa
PUT    /api/data          # Salva estado completo da empresa

GET    /api/test-db       # Diagnóstico de conexão
```

Rotas protegidas por `requireAuth`. `/api/data` também exige `requireEmpresa` (empresa selecionada na sessão).

## Padrões de código

- Backend: `async/await` com try/catch, respostas `res.json({...})`
- Frontend: funções globais no escopo do módulo JS correspondente
- Estado do mapa é salvo inteiro via `saveData()` → `PUT /api/data`
- Após salvar, `broadcastSSE({type: 'update'})` notifica outros clientes
- Overlays/modais são gerados como HTML string e injetados no DOM
- CSS já inclui classes para estados: `.ocupado`, `.vinculoDesvincular`, etc.

## Ambiente de desenvolvimento

```bash
npm run dev          # node --watch server.js (hot reload nativo)
npm start            # produção sem PM2
pm2 start ecosystem.config.js  # produção com PM2
```

Servidor local: `http://localhost:3001`
Produção: `http://topologia.microgateinformatica.com.br`

## Regras para o agente

- Antes de editar qualquer arquivo, apresente um plano resumido das mudanças
- Prefira edições cirúrgicas — evite reescrever funções inteiras sem necessidade
- IDs nunca são AUTO_INCREMENT: respeitar o padrão de geração no frontend
- Nunca expor credenciais — `.env` não vai para o git (já no `.gitignore`)
- Ao adicionar rotas: seguir o padrão `requireAuth` + `requireEmpresa` onde aplicável
- Ao alterar schema: criar migration em `database/migrations/` com prefixo numérico
- Comentários em português BR
- Após mudanças no backend que afetam dados: verificar se `broadcastSSE` precisa ser chamado