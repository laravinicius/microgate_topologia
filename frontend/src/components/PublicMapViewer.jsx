import { useState, useEffect, useCallback, useRef } from 'react';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

export default function PublicMapViewer({ empresaSlug, mesaId, andarId }) {
  const [empresaNome, setEmpresaNome] = useState('');
  const [andares, setAndares] = useState([]);
  const [activeAndarId, setActiveAndarId] = useState(null);
  const [elements, setElements] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [racks, setRacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoElement, setInfoElement] = useState(null);
  const [infoPatchPanel, setInfoPatchPanel] = useState(null);
  const [rackConnections, setRackConnections] = useState([]);
  const [rackConnectionsLoading, setRackConnectionsLoading] = useState(false);

  const canvasRef = useRef(null);
  const hasAutoZoomed = useRef(false);

  // --- Load data ---
  const loadAndares = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/andares?empresa=${encodeURIComponent(empresaSlug)}`);
      const data = await res.json();
      if (data.success) {
        setAndares(data.andares);
        setActiveAndarId(data.andares.length > 0 ? data.andares[0].id : null);
      }
    } catch {
      setError('Erro ao carregar andares');
    }
  }, [empresaSlug]);

  const loadMapData = useCallback(async (andarId) => {
    try {
      let url = `/api/public/map-elements?empresa=${encodeURIComponent(empresaSlug)}`;
      if (andarId) url += `&andarId=${andarId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        const normalized = (data.elements || []).map(el => ({
          ...el,
          andarId: el.andar_id ?? el.andarId ?? null,
          font_size: el.font_size ?? 12,
        }));
        setElements(normalized);
      }

      let url2 = `/api/public/racks?empresa=${encodeURIComponent(empresaSlug)}`;
      if (andarId) url2 += `&andarId=${andarId}`;
      const res2 = await fetch(url2);
      const data2 = await res2.json();
      if (data2.success) {
        setMesas(data2.mesas || []);
        setRacks(data2.racks || []);
      }
    } catch {
      setError('Erro ao carregar mapa');
    }
  }, [empresaSlug]);

  useEffect(() => {
    loadAndares();
  }, [loadAndares]);

  // Set active andar from URL param if provided
  useEffect(() => {
    if (andarId && activeAndarId === null) {
      setActiveAndarId(andarId);
    }
  }, [andarId, activeAndarId]);

  useEffect(() => {
    hasAutoZoomed.current = false;
    if (activeAndarId !== null) {
      loadMapData(activeAndarId);
    } else {
      loadMapData();
    }
  }, [activeAndarId, loadMapData]);

  // Set empresa name from slug
  useEffect(() => {
    fetch(`/api/public/empresa?nome=${encodeURIComponent(empresaSlug)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEmpresaNome(data.empresa.nome);
          document.title = `Mapa - ${data.empresa.nome}`;
        }
      })
      .catch(() => {});
  }, [empresaSlug]);

  // Auto zoom to fit when elements load
  useEffect(() => {
    if (elements.length > 0 && !hasAutoZoomed.current) {
      hasAutoZoomed.current = true;
      const timer = setTimeout(() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || elements.length === 0) return;
        const allItems = elements;
        if (allItems.length === 0) return;
        const minX = Math.min(...allItems.map(e => e.x));
        const minY = Math.min(...allItems.map(e => e.y));
        const maxX = Math.max(...allItems.map(e => e.x + e.largura));
        const maxY = Math.max(...allItems.map(e => e.y + e.altura));
        const padding = 80;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        const scaleX = rect.width / contentWidth;
        const scaleY = rect.height / contentHeight;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        setZoom(newZoom);
        setPan({
          x: rect.width / 2 - centerX * newZoom,
          y: rect.height / 2 - centerY * newZoom,
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [elements]);

  // Auto-open mesa info modal when mesaId is provided and data is loaded
  useEffect(() => {
    if (mesaId && elements.length > 0) {
      const targetElement = elements.find(el => el.tipo === 'mesa' && el.dados_json?.mesaId === mesaId);
      if (targetElement) {
        const timer = setTimeout(() => {
          openInfoModal(targetElement);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [mesaId, elements]);

  // --- Info modal ---
  const openInfoModal = useCallback((el) => {
    setInfoElement(el);
    setInfoPatchPanel(null);
    setShowInfoModal(true);
  }, []);

  const closeInfoModal = useCallback(() => {
    setShowInfoModal(false);
    setInfoElement(null);
    setInfoPatchPanel(null);
    setRackConnections([]);
  }, []);

  const selectPatchPanel = useCallback(async (pp) => {
    setInfoPatchPanel(pp);
    setRackConnectionsLoading(true);
    setRackConnections([]);
    try {
      const rack = racks.find(r => r.nome === infoElement?.nome);
      if (rack) {
        const res = await fetch(`/api/public/rack-connections?rackId=${rack.id}&patchId=${pp.id}&empresa=${encodeURIComponent(empresaSlug)}`);
        const data = await res.json();
        if (data.success) {
          setRackConnections(data.connections || []);
        }
      }
    } catch {
      // ignore
    } finally {
      setRackConnectionsLoading(false);
    }
  }, [racks, infoElement, empresaSlug]);

  const backToRack = useCallback(() => {
    setInfoPatchPanel(null);
    setRackConnections([]);
  }, []);

  // --- Zoom ---
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));

    const scale = newZoom / zoom;
    setPan(prev => ({
      x: mouseX - (mouseX - prev.x) * scale,
      y: mouseY - (mouseY - prev.y) * scale,
    }));
    setZoom(newZoom);
  }, [zoom]);

  const handleZoomBtn = useCallback((delta) => {
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
  }, []);

  // --- Zoom to fit ---
  const zoomToFit = useCallback(() => {
    if (elements.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const allItems = elements;
    const minX = Math.min(...allItems.map(e => e.x));
    const minY = Math.min(...allItems.map(e => e.y));
    const maxX = Math.max(...allItems.map(e => e.x + e.largura));
    const maxY = Math.max(...allItems.map(e => e.y + e.altura));

    const padding = 80;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = rect.width / contentWidth;
    const scaleY = rect.height / contentHeight;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    });
  }, [elements]);

  // --- Pan ---
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.preventDefault();
    } else if (e.button === 0 && (e.target === canvasRef.current?.firstChild || e.target === canvasRef.current)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning.current) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // --- Canvas size ---
  const canvasSize = { width: 4000, height: 3000 };

  if (loading && elements.length === 0) {
    return (
      <div className="map-editor-wrapper">
        <div className="map-editor-header">
          <span className="map-title">🗺 Carregando...</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b', fontSize: '15px' }}>
          Carregando mapa...
        </div>
      </div>
    );
  }

  if (error && elements.length === 0) {
    return (
      <div className="map-editor-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#ef4444', fontSize: '15px' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="map-editor-wrapper">
      {/* Header */}
      <div className="map-editor-header">

        <span className="map-title">🗺 Mapa — {empresaNome}</span>

        <div className="map-andar-tabs">
          {andares.map(a => (
            <button
              key={a.id}
              className={`map-andar-tab ${activeAndarId === a.id ? 'active' : ''}`}
              onClick={() => setActiveAndarId(a.id)}
            >
              {a.nome}
            </button>
          ))}
          {andares.length === 0 && (
            <span className="map-andar-tab-disabled">Nenhum andar</span>
          )}
        </div>

        <div className="map-header-actions">
          <span className="map-mode-badge">👁 Visualização</span>
        </div>
      </div>

      <div className="map-editor-body">
        {/* Canvas */}
        <div className="map-canvas-wrapper" ref={canvasRef} onWheel={handleWheel}>
          <div
            className="map-canvas"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
            onMouseDown={handleCanvasMouseDown}
          >
            {/* Map elements */}
            {elements.map(el => (
              <div
                key={el.id}
                className="map-element"
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.largura,
                  height: el.altura,
                  backgroundColor: el.cor,
                  transform: el.rotacao ? `rotate(${el.rotacao}deg)` : undefined,
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openInfoModal(el);
                }}
              >
                <div className="map-element-label" style={{ fontSize: `${el.font_size || 12}px` }}>{el.nome}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="map-zoom-controls">
          <button onClick={() => handleZoomBtn(ZOOM_STEP)}>+</button>
          <span className="map-zoom-value">{Math.round(zoom * 100)}%</span>
          <button onClick={() => handleZoomBtn(-ZOOM_STEP)}>−</button>
          <button
            className="map-btn-reset"
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Resetar visualização"
          >
            ⟲
          </button>
          <button
            className="map-btn-reset"
            onClick={zoomToFit}
            title="Ajustar à tela"
          >
            ⤡
          </button>
        </div>
      </div>

      {/* Info Modal Overlay */}
      {showInfoModal && infoElement && (
        <div className="map-info-overlay" onClick={closeInfoModal}>
          <div className="map-info-panel" onClick={(e) => e.stopPropagation()}>
            {/* Mesa info */}
            {infoElement.tipo === 'mesa' && (() => {
              const mesaId = infoElement.dados_json?.mesaId;
              const mesa = mesas.find(m => m.id === mesaId);
              return (
                <>
                  <div className="map-info-header">
                    <h3>{mesa ? mesa.nome : infoElement.nome}</h3>
                    <button className="map-info-close" onClick={closeInfoModal}>✕</button>
                  </div>
                  {mesa && mesa.pontos && mesa.pontos.length > 0 ? (
                    <table className="map-info-table">
                      <thead>
                        <tr>
                          <th>Ponto</th>
                          <th>Rack</th>
                          <th>Patch Panel</th>
                          <th>Porta</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mesa.pontos.map(ponto => {
                          const rack = racks.find(r => r.id === ponto.rackId);
                          let patchPanel = null;
                          if (rack) {
                            patchPanel = rack.patchPanels.find(pp => pp.id === ponto.patchId);
                          }
                          const vinculado = ponto.rackId && ponto.patchId && ponto.porta;
                          return (
                            <tr key={ponto.id} className={!vinculado ? 'map-info-row-empty' : ponto.atencao ? 'map-info-row-atencao' : ''}>
                              <td>P{ponto.id}</td>
                              <td>{rack ? rack.nome : '-'}</td>
                              <td>{patchPanel ? patchPanel.nome : '-'}</td>
                              <td>{ponto.porta || '-'}</td>
                              <td>
                                {vinculado
                                  ? <span className={ponto.atencao ? 'map-info-status-atencao' : 'map-info-status-ok'}>
                                      {ponto.atencao ? '⚠ Atenção' : '✓ Vinculado'}
                                    </span>
                                  : <span className="map-info-status-livre">Livre</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="map-info-empty">Nenhum ponto configurado</div>
                  )}
                </>
              );
            })()}

            {/* Rack info */}
            {infoElement.tipo === 'rack' && (() => {
              if (infoPatchPanel) {
                const rack = racks.find(r => r.nome === infoElement.nome);
                const patchPanel = rack?.patchPanels.find(pp => pp.id === infoPatchPanel.id);
                return (
                  <>
                    <div className="map-info-header">
                      <div>
                        <button className="map-info-back" onClick={backToRack}>← {rack?.nome || infoElement.nome}</button>
                        <h3>{patchPanel ? patchPanel.nome : 'Patch Panel'}</h3>
                      </div>
                      <button className="map-info-close" onClick={closeInfoModal}>✕</button>
                    </div>
                    {rackConnectionsLoading ? (
                      <div className="map-info-empty">Carregando...</div>
                    ) : patchPanel ? (
                      <table className="map-info-table">
                        <thead>
                          <tr>
                            <th>Porta</th>
                            <th>Mesa</th>
                            <th>Ponto</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: patchPanel.portas }, (_, i) => i + 1).map(porta => {
                            const conn = rackConnections.find(c => c.porta === porta);
                            return (
                              <tr key={porta} className={!conn ? 'map-info-row-empty' : conn.atencao ? 'map-info-row-atencao' : ''}>
                                <td>{porta}</td>
                                <td>{conn ? `${conn.andarNome ? conn.andarNome + ' / ' : ''}${conn.mesaNome}` : '-'}</td>
                                <td>{conn ? `P${conn.pontoId}` : '-'}</td>
                                <td>
                                  {conn
                                    ? <span className={conn.atencao ? 'map-info-status-atencao' : 'map-info-status-ok'}>
                                        {conn.atencao ? '⚠ Atenção' : '✓ Vinculado'}
                                      </span>
                                    : <span className="map-info-status-livre">Livre</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="map-info-empty">Patch panel não encontrado</div>
                    )}
                  </>
                );
              } else {
                const rack = racks.find(r => r.nome === infoElement.nome);
                const patchPanels = rack?.patchPanels || [];
                return (
                  <>
                    <div className="map-info-header">
                      <h3>{rack ? rack.nome : infoElement.nome}</h3>
                      <button className="map-info-close" onClick={closeInfoModal}>✕</button>
                    </div>
                    {patchPanels.length > 0 ? (
                      <div className="map-info-patch-list">
                        <div className="map-info-patch-list-title">Patch Panels</div>
                        {patchPanels.map(pp => (
                          <button
                            key={pp.id}
                            className="map-info-patch-item"
                            onClick={() => selectPatchPanel(pp)}
                          >
                            <span className="map-info-patch-name">{pp.nome}</span>
                            <span className="map-info-patch-portas">{pp.portas} portas</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="map-info-empty">Nenhum patch panel cadastrado</div>
                    )}
                  </>
                );
              }
            })()}

            {/* Objeto info */}
            {infoElement.tipo === 'objeto' && (
              <>
                <div className="map-info-header">
                  <h3>{infoElement.nome}</h3>
                  <button className="map-info-close" onClick={closeInfoModal}>✕</button>
                </div>
                <div className="map-info-empty">Objeto sem informações de vínculo</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
