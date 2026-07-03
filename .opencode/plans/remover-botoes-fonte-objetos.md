# Plan: Remover botões A-/A+ dos objetos do mapa

## Objetivo
Remover os botões A-/A+ que aparecem sobre os objetos do mapa (Map Editor), mantendo apenas o controle de fonte no painel de propriedades.

## Alterações necessárias

### 1. `frontend/src/components/MapEditor.jsx`

**a) Remover os botões de fonte da renderização dos elementos** (linhas 667-672)
- Remover o bloco JSX que renderiza `.map-font-controls` com os botões `A-`/`A+` sobre cada elemento

**b) Remover as funções auxiliares `increaseFontSize` e `decreaseFontSize`** (linhas 230-240)
- Estas funções só eram usadas pelos botões sobre os elementos
- O painel de propriedades usa `updateElement` diretamente, não precisa delas

### 2. `frontend/src/styles.css`

**Remover as classes `.map-font-controls` e `.map-font-btn`**
- Estes estilos só serviam para os botões sobre os elementos
- O painel de propriedades reutiliza `.map-rotate-controls` e `.map-rotate-btn`

## Resumo

| Arquivo | Ação |
|---------|------|
| `frontend/src/components/MapEditor.jsx` | Remover bloco JSX dos botões + funções auxiliares |
| `frontend/src/styles.css` | Remover `.map-font-controls` e `.map-font-btn` |

Após: `npm run build` + `pm2 restart topologia-server`
