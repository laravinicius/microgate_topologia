# Plano: Corrigir sobreposiçāo de mesas no "3 andar - Lado Rack"

## Problema Identificado

A funçāo `encontrarYLivre` em `frontend/src/App.jsx:40-51` tem um bug que causa sobreposiçāo de mesas:

1. **Bug principal**: A condiçāo `if (m.y + m.altura > y)` verifica apenas se uma mesa fixada termina ACIMA de `y`, nāo se hă sobreposiçāo real. Isso faz com que mesas nāo fixadas sejam empurradas para o final da coluna, mesmo quando hă espaco livre no topo.

2. **Exemplo concreto**: Mesa 02 (nāo fixada) deveria ficar em y=20, mas como Mesa 04 (fixada em y=520) está na mesma coluna (x=280), o algoritmo empurra Mesa 02 para y=5520 (após a última mesa fixada).

3. **Bug secundário**: Os loops de overlap em `calcularPosicoes` (lines 70-80) sāo single-pass, ou seja, apó `y` ser atualizado devido a uma sobreposiçāo, o loop nāo re-verifica mesas anteriores, podendo causar sobreposiçōes residuais.

## Soluçāo

### 1. Corrigir `encontrarYLivre` (App.jsx:40-51)

**Antes:**
```javascript
function encontrarYLivre(col, yInicial, mesasOcupadas) {
  let y = yInicial;
  const x = getMesaX(col);
  for (const m of mesasOcupadas) {
    const colM = Math.round((m.x - MESA_PADDING) / (MESA_LARGURA + MESA_GAP));
    if (colM !== col) continue;
    if (m.y + m.altura > y) {
      y = m.y + m.altura + MESA_GAP;
    }
  }
  return y;
}
```

**Depois:**
```javascript
function encontrarYLivre(col, yInicial, mesasOcupadas, h) {
  let y = yInicial;
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of mesasOcupadas) {
      const colM = Math.round((m.x - MESA_PADDING) / (MESA_LARGURA + MESA_GAP));
      if (colM !== col) continue;
      if (y + h > m.y && m.y + m.altura > y) {
        y = m.y + m.altura + MESA_GAP;
        changed = true;
      }
    }
  }
  return y;
}
```

**Mudançās:**
- Adicionar parâmetro `h` (altura da mesa) para verificaçāo bidirecional
- Usar loop `while(changed)` para convergência
- Verificar sobreposiçāo real: `y + h > m.y && m.y + m.altura > y`

### 2. Corrigir loops de overlap em `calcularPosicoes` (App.jsx:67-80)

**Antes:**
```javascript
y = encontrarYLivre(col, y, fixadas);

const x = getMesaX(col);
for (const fp of fixadas) {
  if (checkOverlap(x, y, h, fp.x, fp.y, fp.altura)) {
    y = fp.y + fp.altura + MESA_GAP;
  }
}

for (const pp of posicoes) {
  if (checkOverlap(x, y, h, pp.x, pp.y, pp.altura)) {
    y = pp.y + pp.altura + MESA_GAP;
  }
}
```

**Depois:**
```javascript
y = encontrarYLivre(col, y, fixadas, h);

const x = getMesaX(col);
let changed = true;
while (changed) {
  changed = false;
  for (const fp of fixadas) {
    if (checkOverlap(x, y, h, fp.x, fp.y, fp.altura)) {
      y = fp.y + fp.altura + MESA_GAP;
      changed = true;
    }
  }
  for (const pp of posicoes) {
    if (checkOverlap(x, y, h, pp.x, pp.y, pp.altura)) {
      y = pp.y + pp.altura + MESA_GAP;
      changed = true;
    }
  }
}
```

**Mudançās:**
- Passar `h` para `encontrarYLivre`
- Envolver loops em `while(changed)` para convergência

### 3. Arquivos a modificar

- `/var/www/topologia/frontend/src/App.jsx` (lines 40-80)

### 4. Verificaçāo

Após a correçāo, verificar que:
1. Mesa 01 fica em y=20, col 0
2. Mesa 02 fica em y=20, col 1
3. Mesa 03 fica em y=520, col 0 (após Mesa 01)
4. Nenhuma mesa se sobrepõe
5. Mesas fixadas mantêm suas posiçōes
