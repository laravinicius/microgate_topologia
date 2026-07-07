# InfraMap

Sistema web para gestão de infraestrutura de rede, com cadastro de empresas, andares, mesas, racks, patch panels, usuários e geração de QR Codes.

## Stack

- Backend: Node.js + Express
- Banco de dados: MySQL
- Autenticação: JWT + bcrypt
- Frontend: React + Vite
- Geração de QR Code: `qrcode`
- Desenho/arte para QR e imagens: `canvas`

## Requisitos

- Node.js 18+ recomendado
- npm
- MySQL acessível pela aplicação

## Instalação

```bash
npm install
cd frontend && npm install
```

## Configuração

Crie um arquivo `.env` na raiz com base em `.env.example`.

Variáveis esperadas:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `PORT`
- `ADMIN_PASSWORD`

## Execução

### Backend

```bash
npm run dev
```

### Frontend

```bash
npm run dev:frontend
```

### Build do frontend

```bash
npm run build
```

## Scripts úteis

- `npm start`: inicia o backend
- `npm run dev`: inicia o backend com watch
- `npm run dev:frontend`: sobe o Vite no diretório `frontend`
- `npm run build`: gera o build do frontend
- `npm run install:frontend`: instala dependências do frontend

## Estrutura resumida

- `server.js`: API principal
- `db.js`: conexão com banco
- `database/migrations/`: migrations SQL
- `frontend/`: aplicação React/Vite
- `img/`: imagens usadas pela interface
- `ecosystem.config.js`: configuração para PM2

## Observações

- O frontend usa `frontend/dist/` apenas como saída de build; o diretório não deve ser versionado.
- Arquivos temporários, logs e sobras de ferramentas de IA devem permanecer fora do Git.
- Se alterar o schema do banco, revise também as migrations antes de subir para produção.
