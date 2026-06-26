import { useState } from 'react';

function calcularConexoes(rack, pp, mesas) {
  const conexoes = [];
  for (let porta = 1; porta <= pp.portas; porta++) {
    let mesaNome = null;
    let mesaAndarNome = null;
    let pontoId = null;
    for (const mesa of mesas) {
      for (const ponto of mesa.pontos) {
        if (ponto.rackId === rack.id && ponto.patchId === pp.id && ponto.porta === porta) {
          mesaNome = mesa.nome;
          mesaAndarNome = mesa.andarNome || '';
          pontoId = ponto.id;
          break;
        }
      }
      if (mesaNome) break;
    }
    conexoes.push({ porta, mesaNome, mesaAndarNome, pontoId });
  }
  return conexoes;
}

export default function RackListView({ racks, mesas, onCriarRack, onEditRack, onApagarRack, onCriarPatchPanel, onApagarPatchPanel }) {
  const [rackExpandido, setRackExpandido] = useState(null);

  return (
    <main className="rackListView">
      {racks.length === 0 && (
        <div className="rackVazio">Nenhum rack cadastrado</div>
      )}

      <div className="rackLista">
        {racks.map(rack => {
          const expandido = rackExpandido === rack.id;
          return (
            <div key={rack.id} className={`rackItem ${expandido ? 'expanded' : ''}`}>
              <div className="rackItemHeader" onClick={() => setRackExpandido(expandido ? null : rack.id)}>
                <span className="rackToggle">{expandido ? '▼' : '▶'}</span>
                <h3>{rack.nome}</h3>
                <div className="rackItemAcoes">
                  <button className="btn-edit-company" onClick={(e) => { e.stopPropagation(); onEditRack(rack); }}>Editar</button>
                  <button className="botaoApagarRack" onClick={(e) => { e.stopPropagation(); onApagarRack(rack); }}>Apagar</button>
                </div>
              </div>

              {expandido && (
                <div className="rackItemBody">
                  {rack.patchPanels.length > 0 && (
                    <div className="patchCardList">
                      {rack.patchPanels.map(pp => {
                        const conexoes = calcularConexoes(rack, pp, mesas);
                        const usadas = conexoes.filter(c => c.mesaNome).length;
                        return (
                          <div key={pp.id} className="patchCard">
                            <div className="patchCardHeader">
                              <div className="patchCardTitle">
                                <span className="patchCardNome">{pp.nome}</span>
                                <span className="patchCardInfo">{pp.portas} portas &mdash; {usadas}/{pp.portas} usadas</span>
                              </div>
                              <button className="botaoApagarPatch" onClick={() => onApagarPatchPanel(rack.id, pp)}>Apagar</button>
                            </div>
                            <div className="portGrid">
                              {conexoes.map(cx => (
                                <div
                                  key={cx.porta}
                                  className={`portItem ${cx.mesaNome ? 'used' : 'free'}`}
                                >
                                  <span className="portNum">{cx.porta}</span>
                                  <span className="portLabel">
                                    {cx.mesaNome ? `${cx.mesaAndarNome} - ${cx.mesaNome} - P${cx.pontoId}` : 'Livre'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button className="btnNovoPatchPanel" onClick={() => onCriarPatchPanel(rack.id)}>+ Patch Panel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
