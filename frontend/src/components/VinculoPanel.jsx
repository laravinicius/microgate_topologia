import { useMemo } from 'react';

function getRackNome(racks, rackId) {
  const rack = racks.find(r => r.id === rackId);
  return rack ? rack.nome : '';
}

function getPatchNome(racks, rackId, patchId) {
  const rack = racks.find(r => r.id === rackId);
  if (!rack) return '';
  const pp = rack.patchPanels.find(p => p.id === patchId);
  return pp ? pp.nome : '';
}

function buildBreadcrumb(racks, vinculo) {
  if (!vinculo) return '';
  const { mesaId, pontoId, rackId, patchId } = vinculo;
  const parts = [];
  const mesaNome = vinculo.mesaNome || '';
  if (mesaNome) parts.push(mesaNome);
  parts.push('P' + pontoId);
  if (rackId) parts.push(getRackNome(racks, rackId));
  if (patchId) parts.push(getPatchNome(racks, rackId, patchId));
  return parts.join(' → ');
}

export default function VinculoPanel({ vinculo, racks, allMesas, mesasAtuais, onSelectRack, onSelectPatch, onSelectPorta, onVoltar, onCancelar, onDesvincular }) {
  if (!vinculo) return null;

  const { etapa, rackId, patchId, pontoId, mesaId, mesaNome } = vinculo;
  const ponto = vinculo.ponto;
  const breadcrumb = buildBreadcrumb(racks, vinculo);

  const rack = racks.find(r => r.id === rackId);
  const patchPanel = rack?.patchPanels.find(pp => pp.id === patchId);

  const ocupadas = useMemo(() => {
    if (!rackId || !patchId) return new Set();
    const set = new Set();
    const todasMesas = mesasAtuais || allMesas || [];
    for (const m of todasMesas) {
      for (const p of m.pontos || []) {
        if (p.id === pontoId && m.id === mesaId) continue;
        if (p.rackId === rackId && p.patchId === patchId && p.porta) {
          set.add(p.porta);
        }
      }
    }
    return set;
  }, [rackId, patchId, allMesas, mesasAtuais, pontoId, mesaId]);

  const portasLivres = useMemo(() => {
    if (!patchPanel) return [];
    return Array.from({ length: patchPanel.portas }, (_, i) => i + 1)
      .filter(p => !ocupadas.has(p));
  }, [patchPanel, ocupadas]);

  return (
    <div className="vinculoOverlay" onClick={(e) => { if (e.target === e.currentTarget) onCancelar(); }}>
      <div className="vinculoPainel">
        <div className="vinculoCabecalho">
          <div className="vinculoBreadcrumb">{breadcrumb}</div>
          {etapa === 'rack' && <div className="vinculoTitulo">Selecione um rack</div>}
          {etapa === 'patch' && <div className="vinculoTitulo">Selecione um patch panel</div>}
          {etapa === 'porta' && <div className="vinculoTitulo">Selecione uma porta</div>}
        </div>

        <div className="vinculoConteudo">
          {ponto && ponto.rackId && ponto.patchId && ponto.porta && (
            <div className="vinculoVinculoAtual">
              Vínculo atual: P{ponto.id} | {getRackNome(racks, ponto.rackId)} | {getPatchNome(racks, ponto.rackId, ponto.patchId)} | Porta {ponto.porta}
            </div>
          )}

          {etapa === 'rack' && (
            racks.length === 0
              ? <div className="vinculoVazio">Nenhum rack cadastrado.<br />Crie um rack no menu lateral.</div>
              : <div className="vinculoLista">
                  {racks.map(r => (
                    <button key={r.id} className="vinculoOpcao" onClick={() => onSelectRack(r.id)}>
                      {r.nome}
                    </button>
                  ))}
                </div>
          )}

          {etapa === 'patch' && (
            !rack || rack.patchPanels.length === 0
              ? <div className="vinculoVazio">Este rack não tem patch panels.<br />Crie um patch panel no menu lateral.</div>
              : <div className="vinculoLista">
                  {rack.patchPanels.map(pp => (
                    <button key={pp.id} className="vinculoOpcao" onClick={() => onSelectPatch(pp.id)}>
                      {pp.nome} ({pp.portas} portas)
                    </button>
                  ))}
                </div>
          )}

          {etapa === 'porta' && patchPanel && (
            portasLivres.length === 0
              ? <div className="vinculoVazio">Todas as portas estão ocupadas.</div>
              : <div className="vinculoOpcoesGrid">
                  {Array.from({ length: patchPanel.portas }, (_, i) => i + 1).map(porta => {
                    const livre = portasLivres.includes(porta);
                    return livre
                      ? <button key={porta} className="vinculoOpcao" onClick={() => onSelectPorta(porta)}>{porta}</button>
                      : <div key={porta} className="vinculoOpcao vinculoOpcao--disabled">{porta}</div>;
                  })}
                </div>
          )}
        </div>

        <div className="vinculoAcoes">
          {ponto && ponto.rackId && ponto.patchId && ponto.porta && (
            <button className="vinculoDesvincular" onClick={onDesvincular}>Limpar</button>
          )}
          {etapa !== 'rack' && (
            <button className="vinculoVoltar" onClick={onVoltar}>Voltar</button>
          )}
          <button className="vinculoCancelar" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
