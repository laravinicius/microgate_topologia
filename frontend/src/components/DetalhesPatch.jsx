export default function DetalhesPatch({ detalhes, racks, onClose }) {
  if (!detalhes) return null;

  const { rackId, patchId } = detalhes;
  const rack = racks.find(r => r.id === rackId);
  const patchPanel = rack?.patchPanels.find(pp => pp.id === patchId);
  if (!rack || !patchPanel) return null;

  const conexoes = [];
  for (let porta = 1; porta <= patchPanel.portas; porta++) {
    let mesaNome = null;
    let mesaAndarNome = null;
    let pontoId = null;
    for (const mesa of detalhes.mesas || []) {
      for (const ponto of mesa.pontos || []) {
        if (ponto.rackId === rackId && ponto.patchId === patchId && ponto.porta === porta) {
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

  return (
    <div className="detalhesPatchOverlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="detalhesPatchPainel">
        <div className="detalhesPatchCabecalho">
          <div className="detalhesPatchBreadcrumb">{rack.nome} &rarr; {patchPanel.nome}</div>
          <div className="detalhesPatchTitulo">Portas de {patchPanel.nome}</div>
        </div>

        <div className="detalhesPatchConteudo">
          <table className="detalhesPatchTabela">
            <thead>
              <tr><th>Porta</th><th>Conexão</th></tr>
            </thead>
            <tbody>
              {conexoes.map(cx => (
                <tr key={cx.porta}>
                  <td>{cx.porta}</td>
                  <td>
                    {cx.mesaNome
                      ? `${cx.mesaAndarNome} - ${cx.mesaNome} - P${cx.pontoId}`
                      : <span className="detalhesPatchLivre">Livre</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="detalhesPatchAcoes">
          <button className="detalhesPatchFechar" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
