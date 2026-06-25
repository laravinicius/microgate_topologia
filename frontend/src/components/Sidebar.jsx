import { useState } from 'react';

export default function Sidebar({ racks, onCriarMesa, onCriarRack, onApagarRack, onCriarPatchPanel, onApagarPatchPanel, onAbrirDetalhesPatch }) {
  const [racksExpandidos, setRacksExpandidos] = useState({});
  const [racksSectionOpen, setRacksSectionOpen] = useState(true);

  const togglePatchPanels = (rackId) => {
    setRacksExpandidos(prev => ({ ...prev, [rackId]: !prev[rackId] }));
  };

  return (
    <aside id="sidebar">
      <h3>Infraestrutura</h3>

      <button id="novaMesa" onClick={onCriarMesa}>+ Mesa</button>
      <button id="novoRack" onClick={onCriarRack}>+ Rack</button>

      <div className="secaoRacks">
        <button
          id="toggleRacks"
          className="secaoTitulo"
          onClick={() => setRacksSectionOpen(!racksSectionOpen)}
        >
          {racksSectionOpen ? '▼' : '▶'} Racks
        </button>

        {racksSectionOpen && (
          <div id="listaRacks" className="racksContainer">
            {racks.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px', textAlign: 'center' }}>
                Nenhum rack cadastrado
              </div>
            )}
            {racks.map(rack => (
              <div key={rack.id} className="rack">
                <div className="cabecalhoRack" onClick={() => togglePatchPanels(rack.id)}>
                  <span className="rackToggle">
                    {racksExpandidos[rack.id] ? '▼' : '▶'}
                  </span>
                  <h4>{rack.nome}</h4>
                  <div className="rackAcoes">
                    <button onClick={(e) => { e.stopPropagation(); onApagarRack(rack); }}>
                      Apagar
                    </button>
                  </div>
                </div>

                <button onClick={() => onCriarPatchPanel(rack.id)}>
                  + Patch Panel
                </button>

                <div
                  className={`patchPanelsContainer${racksExpandidos[rack.id] ? '' : ' oculto'}`}
                  id={`pp-${rack.id}`}
                >
                  {rack.patchPanels.map(pp => (
                    <div
                      key={pp.id}
                      className="patch"
                      onClick={() => onAbrirDetalhesPatch(rack.id, pp.id)}
                    >
                      <div>
                        {pp.nome} ({pp.portas} portas)
                      </div>
                      <div className="rackAcoes">
                        <button onClick={(e) => { e.stopPropagation(); onApagarPatchPanel(rack.id, pp); }}>
                          Apagar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
