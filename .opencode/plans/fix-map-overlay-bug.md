# Plano: Corrigir Bug de Sobreposição no Mapa Público

## Problema
No `PublicMapViewer.jsx`, as mesas são renderizadas DUAS vezes no canvas:
1. Como `map_elements` (elementos do tipo 'mesa' criados pelo usuário)
2. Como overlay separado via `mesas.map()` (linhas 326-358)

Isso causa itens maiores sobrepostos sobre o mapa correto.

## Solução
Remover a renderização duplicada de mesas no mapa público para que funcione igual ao `MapEditor` interno.

## Passos de Implementação

### 1. Remover renderização de mesas no PublicMapViewer.jsx
- **Arquivo:** `frontend/src/components/PublicMapViewer.jsx`
- **Remover:** Linhas 326-358 (bloco `{mesas.map(m => {...})}`)
- **Manter:** Apenas a renderização de `elements.map()`

### 2. Atualizar cálculo de auto-zoom
- **Linha 102:** Remover `mesas.map()` do `allItems`
- **De:** `[...elements, ...mesas.map(m => ({ x: m.x, y: m.y, largura: 240, altura: Math.max(120, (m.pontos?.length || 8) * 52 + 68) }))];`
- **Para:** `[...elements];`

### 3. Atualizar função zoomToFit
- **Linha 176:** Remover `mesas.map()` do `allItems`
- **De:** `[...elements, ...mesas.map(m => ({ x: m.x, y: m.y, largura: 240, altura: Math.max(120, (m.pontos?.length || 8) * 52 + 68) }))];`
- **Para:** `[...elements];`

### 4. Limpeza opcional
- Remover importação de `mesas` se não for mais necessária (mantê-la pois é usada no info modal)
- O state `mesas` continua necessário para o info modal (exibir pontos das mesas)

## Verificação
- Acessar o mapa público via URL `/empresa-slug`
- Verificar que as mesas aparecem corretamente sem sobreposição
- Comparar visualmente com o mapa interno "Ver Mapa"
