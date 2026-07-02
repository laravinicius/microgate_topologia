import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { api } from '../api';

const GRID = 20;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

const DEFAULTS = {
  mesa: { largura: 60, altura: 180, cor: '#3f3f3f' },
  rack: { largura: 80, altura: 200, cor: '#2563eb' },
  objeto: { largura: 100, altura: 60, cor: '#374151' },
};

function snap(val) {
  return Math.round(val / GRID) * GRID;
}

export default function MapEditor({ onVoltar, readOnly = false }) {
  const { empresaId, empresaNome } = useAuth();
  const { success, error: showError } = useNotification();

  const [andares, setAndares] = useState([]);
  const [activeAndarId, setActiveAndarId] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [racks, setRacks] = useState([]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [saveStatus, setSaveStatus] = useState('saved'); // saved | saving | unsaved
  const saveStatusRef = useRef('saved');
  const elementsRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);

  const [showMesaMenu, setShowMesaMenu] = useState(false);
  const [newMesaNome, setNewMesaNome] = useState('');
  const [newMesaPontos, setNewMesaPontos] = useState(8);

  const [showRackMenu, setShowRackMenu] = useState(false);
  const [newRackNome, setNewRackNome] = useState('');

  const [showPropPanel, setShowPropPanel] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoElement, setInfoElement] = useState(null);
  const [infoPatchPanel, setInfoPatchPanel] = useState(null);

  const canvasRef = useRef(null);
  const saveTimerRef = useRef(null);

  // --- Selection box (drag-to-select) ---
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionBoxRef = useRef(null);
  const isSelecting = useRef(false);
  const hasDragged = useRef(false);
  const selectionStart = useRef({ x: 0, y: 0 });
  const SELECTION_THRESHOLD = 5;

  // --- Load data ---
  const loadAndares = useCallback(async () => {
    try {
      const data = await api.get('/api/andares');
      if (data.success) {
        setAndares(data.andares);
        setActiveAndarId(data.andares.length > 0 ? data.andares[0].id : null);
      }
    } catch {
      showError('Erro ao carregar andares');
    }
  }, [showError]);

  const loadMesas = useCallback(async (andarId) => {
    try {
      const url = andarId ? `/api/racks?andarId=${andarId}` : '/api/racks';
      const data = await api.get(url);
      if (data.success) {
        setMesas(data.mesas || []);
        setRacks(data.racks || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadElements = useCallback(async (andarId) => {
    try {
      const url = andarId ? `/api/map-elements?andarId=${andarId}` : '/api/map-elements';
      const data = await api.get(url);
      if (data.success) {
        const normalized = (data.elements || []).map(el => ({
          ...el,
          andarId: el.andar_id ?? el.andarId ?? null,
        }));
        setElements(normalized);
      }
    } catch {
      showError('Erro ao carregar elementos');
    }
  }, [showError]);

  useEffect(() => {
    loadAndares();
  }, [loadAndares]);

  useEffect(() => {
    if (activeAndarId !== null) {
      loadElements(activeAndarId);
      loadMesas(activeAndarId);
    } else {
      loadElements();
      loadMesas();
    }
  }, [activeAndarId, loadElements, loadMesas]);

  // --- Save ---
  const saveElements = useCallback(async () => {
    if (saveStatusRef.current === 'saving') return;
    saveStatusRef.current = 'saving';
    setSaveStatus('saving');
    try {
      const data = await api.put('/api/map-elements/bulk', { elements: elementsRef.current, andarId: activeAndarId });
      if (data.success) {
        saveStatusRef.current = 'saved';
        setSaveStatus('saved');
      }
    } catch {
      saveStatusRef.current = 'unsaved';
      setSaveStatus('unsaved');
      showError('Erro ao salvar');
    }
  }, [showError, activeAndarId]);

  const scheduleSave = useCallback(() => {
    if (saveStatusRef.current === 'saving') {
      saveStatusRef.current = 'unsaved';
      setSaveStatus('unsaved');
      return;
    }
    saveStatusRef.current = 'unsaved';
    setSaveStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveElements();
    }, 1000);
  }, [saveElements]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // --- Element operations ---
  const updateElement = useCallback((id, updates) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    scheduleSave();
  }, [scheduleSave]);

  const addElement = useCallback((el) => {
    setElements(prev => [...prev, el]);
    scheduleSave();
  }, [scheduleSave]);

  const deleteElement = useCallback((id) => {
    setElements(prev => prev.filter(e => e.id !== id));
    setSelectedIds(prev => prev.filter(sid => sid !== id));
    scheduleSave();
  }, [scheduleSave]);

  const createNewElement = useCallback((tipo, nome, entityId) => {
    const def = DEFAULTS[tipo];
    const el = {
      id: `temp-${Date.now()}`,
      empresa_id: empresaId,
      andarId: activeAndarId,
      tipo,
      nome: nome || `${tipo} ${elements.length + 1}`,
      x: snap(200),
      y: snap(200),
      largura: def.largura,
      altura: def.altura,
      cor: def.cor,
      rotacao: 0,
      ordem: elements.length,
      dados_json: entityId ? (tipo === 'mesa' ? { mesaId: entityId } : { rackId: entityId }) : null,
    };
    addElement(el);
    setSelectedIds([el.id]);
  }, [empresaId, activeAndarId, elements.length, addElement]);

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

  // --- Zoom to fit all elements ---
  const zoomToFit = useCallback(() => {
    if (elements.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const minX = Math.min(...elements.map(e => e.x));
    const minY = Math.min(...elements.map(e => e.y));
    const maxX = Math.max(...elements.map(e => e.x + e.largura));
    const maxY = Math.max(...elements.map(e => e.y + e.altura));

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
    } else if (e.button === 0 && canvasRef.current?.contains(e.target)) {
      if (readOnly) {
        isPanning.current = true;
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        return;
      }
      if (e.shiftKey) {
        isSelecting.current = true;
        selectionStart.current = { x: e.clientX, y: e.clientY };
        setSelectionBox(null);
        hasDragged.current = false;
      } else {
        isPanning.current = true;
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    }
  }, [pan, readOnly]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning.current) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
    if (isSelecting.current) {
      const dx = e.clientX - selectionStart.current.x;
      const dy = e.clientY - selectionStart.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Só considerar drag se moveu mais que o threshold
      if (dist < SELECTION_THRESHOLD) return;
      hasDragged.current = true;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startCanvas = {
        x: (selectionStart.current.x - rect.left - pan.x) / zoom,
        y: (selectionStart.current.y - rect.top - pan.y) / zoom,
      };
      const endCanvas = {
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      };
      const box = {
        left: Math.min(startCanvas.x, endCanvas.x),
        top: Math.min(startCanvas.y, endCanvas.y),
        right: Math.max(startCanvas.x, endCanvas.x),
        bottom: Math.max(startCanvas.y, endCanvas.y),
      };
      selectionBoxRef.current = box;
      setSelectionBox(box);
    }
  }, [pan, zoom]);

  const handleMouseUp = useCallback((e) => {
    isPanning.current = false;
    if (isSelecting.current) {
      isSelecting.current = false;
      if (!canvasRef.current?.contains(e.target)) {
        setSelectionBox(null);
        hasDragged.current = false;
        return;
      }
      const box = selectionBoxRef.current;
      if (hasDragged.current && box) {
        const newSelected = elementsRef.current.filter(el => {
          return (
            el.x < box.right &&
            el.x + el.largura > box.left &&
            el.y < box.bottom &&
            el.y + el.altura > box.top
          );
        }).map(el => el.id);
        setSelectedIds(newSelected);
      } else {
        setSelectedIds([]);
      }
      setSelectionBox(null);
      selectionBoxRef.current = null;
      hasDragged.current = false;
    } else if (e.target.classList?.contains('map-canvas')) {
      setSelectedIds([]);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // --- Element drag ---
  const dragging = useRef(null);

  const handleElementMouseDown = useCallback((e, el, handle) => {
    if (readOnly) return;
    e.stopPropagation();
    e.preventDefault();

    // Ctrl+click = toggle selection
    if ((e.ctrlKey || e.metaKey) && !handle) {
      setSelectedIds(prev =>
        prev.includes(el.id)
          ? prev.filter(id => id !== el.id)
          : [...prev, el.id]
      );
      return;
    }

    // Normal click = select single (unless already selected)
    if (!selectedIds.includes(el.id) && !handle) {
      setSelectedIds([el.id]);
    }

    if (handle === 'pan') {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (handle) {
      // Resize
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = el.largura;
      const startH = el.altura;
      const startLeft = el.x;
      const startTop = el.y;
      const dirX = handle.includes('r') ? 1 : handle.includes('l') ? -1 : 0;
      const dirY = handle.includes('b') ? 1 : handle.includes('t') ? -1 : 0;

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        const newW = snap(Math.max(GRID * 2, startW + dx * dirX));
        const newH = snap(Math.max(GRID * 2, startH + dy * dirY));
        const newX = dirX !== 0 ? snap(startLeft + (dirX > 0 ? 0 : dx * dirX)) : startLeft;
        const newY = dirY !== 0 ? snap(startTop + (dirY > 0 ? 0 : dy * dirY)) : startTop;
        updateElement(el.id, {
          largura: newW,
          altura: newH,
          x: newX,
          y: newY,
        });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    } else {
      // Drag (multi-element support)
      const mouseStartX = e.clientX;
      const mouseStartY = e.clientY;
      // Store initial positions of all selected elements
      const initialPositions = new Map();
      elements.forEach(item => {
        if (selectedIds.includes(item.id)) {
          initialPositions.set(item.id, { x: item.x, y: item.y });
        }
      });

      const onMove = (ev) => {
        const dx = (ev.clientX - mouseStartX) / zoom;
        const dy = (ev.clientY - mouseStartY) / zoom;
        // Threshold: só mover se moveu mais que 5px
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        setElements(prev => prev.map(item => {
          const init = initialPositions.get(item.id);
          if (!init) return item;
          return {
            ...item,
            x: snap(init.x + dx),
            y: snap(init.y + dy),
          };
        }));
        scheduleSave();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  }, [zoom, pan, selectedIds, elements, scheduleSave]);

  // --- Keyboard ---
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        // Don't delete if editing input
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        selectedIds.forEach(id => deleteElement(id));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIds, deleteElement]);

  // --- Double click to edit ---
  const handleDoubleClick = useCallback((el) => {
    if (readOnly) return;
    const novoNome = prompt('Nome do elemento:', el.nome);
    if (novoNome !== null) {
      updateElement(el.id, { nome: novoNome });
    }
  }, [updateElement]);

  // --- Selected element ---
  const selected = selectedIds.length > 0 ? elements.find(e => e.id === selectedIds[0]) : null;

  // --- Info modal for read-only mode ---
  const openInfoModal = useCallback((el) => {
    setInfoElement(el);
    setInfoPatchPanel(null);
    setShowInfoModal(true);
  }, []);

  const closeInfoModal = useCallback(() => {
    setShowInfoModal(false);
    setInfoElement(null);
    setInfoPatchPanel(null);
  }, []);

  const selectPatchPanel = useCallback((pp) => {
    setInfoPatchPanel(pp);
  }, []);

  const backToRack = useCallback(() => {
    setInfoPatchPanel(null);
  }, []);

  // --- Create element from existing mesa ---
  const createFromMesa = useCallback((mesa) => {
    createNewElement('mesa', mesa.nome, mesa.id);
    setShowMesaMenu(false);
  }, [createNewElement]);

  const createNewMesa = useCallback(() => {
    if (!newMesaNome.trim()) return;
    createNewElement('mesa', newMesaNome.trim());
    setNewMesaNome('');
    setNewMesaPontos(8);
    setShowMesaMenu(false);
  }, [newMesaNome, createNewElement]);

  // --- Create element from existing rack ---
  const createFromRack = useCallback((rack) => {
    createNewElement('rack', rack.nome, rack.id);
    setShowRackMenu(false);
  }, [createNewElement]);

  const createNewRack = useCallback(async () => {
    if (!newRackNome.trim()) return;
    try {
      const data = await api.post('/api/racks', { nome: newRackNome.trim() });
      if (data.success) {
        createNewElement('rack', data.rack.nome, data.rack.id);
        setNewRackNome('');
        setShowRackMenu(false);
        loadMesas(activeAndarId);
      }
    } catch {
      // ignore
    }
  }, [newRackNome, createNewElement, loadMesas, activeAndarId]);

  // --- Canvas size ---
  const canvasSize = { width: 4000, height: 3000 };

  return (
    <div className="map-editor-wrapper">
      {/* Header */}
      <div className="map-editor-header">
        <button className="map-btn-voltar" onClick={onVoltar}>← Voltar</button>
        <span className="map-title">🗺 Mapa — {empresaNome}</span>

        <div className="map-andar-tabs">
          {andares.map(a => (
            <button
              key={a.id}
              className={`map-andar-tab ${activeAndarId === a.id ? 'active' : ''}`}
              onClick={() => { setActiveAndarId(a.id); setSelectedIds([]); }}
            >
              {a.nome}
            </button>
          ))}
          {andares.length === 0 && (
            <span className="map-andar-tab-disabled">Nenhum andar</span>
          )}
        </div>

        <div className="map-header-actions">
          {!readOnly && (
            <span className={`map-save-status ${saveStatus}`}>
              {saveStatus === 'saved' && '✓ Salvo'}
              {saveStatus === 'saving' && 'Salvando...'}
              {saveStatus === 'unsaved' && '● Não salvo'}
            </span>
          )}
          {readOnly && <span className="map-mode-badge">👁 Visualização</span>}
          {!readOnly && (
            <button
              className="map-btn-icon"
              onClick={() => setShowPropPanel(p => !p)}
              title="Propriedades"
            >
              {showPropPanel ? '✕' : '⚙'}
            </button>
          )}
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
            {/* Grid is rendered via CSS background */}

            {/* Elements */}
            {elements.map(el => (
              <div
                key={el.id}
                className={`map-element ${!readOnly && selectedIds.includes(el.id) ? 'selected' : ''}`}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.largura,
                  height: el.altura,
                  backgroundColor: el.cor,
                  transform: el.rotacao ? `rotate(${el.rotacao}deg)` : undefined,
                  cursor: readOnly ? 'pointer' : 'grab',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (readOnly) openInfoModal(el);
                }}
                onMouseDown={(e) => handleElementMouseDown(e, el, null)}
                onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(el); }}
              >
                <div className="map-element-label">{el.nome}</div>
                <div className="map-element-type">{el.tipo}</div>

                {/* Resize handles */}
                {!readOnly && selectedIds.includes(el.id) && (
                  <>
                    <div className="map-handle map-handle-tl" onMouseDown={(e) => handleElementMouseDown(e, el, 'tl')} />
                    <div className="map-handle map-handle-tr" onMouseDown={(e) => handleElementMouseDown(e, el, 'tr')} />
                    <div className="map-handle map-handle-bl" onMouseDown={(e) => handleElementMouseDown(e, el, 'bl')} />
                    <div className="map-handle map-handle-br" onMouseDown={(e) => handleElementMouseDown(e, el, 'br')} />
                  </>
                )}
              </div>
            ))}

            {/* Selection box */}
            {selectionBox && (
              <div
                className="map-selection-box"
                style={{
                  left: selectionBox.left,
                  top: selectionBox.top,
                  width: selectionBox.right - selectionBox.left,
                  height: selectionBox.bottom - selectionBox.top,
                }}
              />
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {!readOnly && showPropPanel && selected && (
          <div className="map-properties">
            <h3>Propriedades{selectedIds.length > 1 ? ` (${selectedIds.length} selecionados)` : ''}</h3>
            <div className="map-prop-group">
              <label>Nome</label>
              <input
                type="text"
                value={selected.nome}
                onChange={(e) => updateElement(selected.id, { nome: e.target.value })}
              />
            </div>
            <div className="map-prop-group">
              <label>Tipo</label>
              <span className="map-prop-value">{selected.tipo}</span>
            </div>
            <div className="map-prop-group">
              <label>Cor</label>
              <input
                type="color"
                value={selected.cor}
                onChange={(e) => updateElement(selected.id, { cor: e.target.value })}
              />
            </div>
            <div className="map-prop-row">
              <div className="map-prop-group">
                <label>Largura</label>
                <input
                  type="number"
                  value={selected.largura}
                  min={GRID * 2}
                  step={GRID}
                  onChange={(e) => updateElement(selected.id, { largura: snap(Number(e.target.value)) })}
                />
              </div>
              <div className="map-prop-group">
                <label>Altura</label>
                <input
                  type="number"
                  value={selected.altura}
                  min={GRID * 2}
                  step={GRID}
                  onChange={(e) => updateElement(selected.id, { altura: snap(Number(e.target.value)) })}
                />
              </div>
            </div>
            <div className="map-prop-row">
              <div className="map-prop-group">
                <label>X</label>
                <input
                  type="number"
                  value={selected.x}
                  step={GRID}
                  onChange={(e) => updateElement(selected.id, { x: snap(Number(e.target.value)) })}
                />
              </div>
              <div className="map-prop-group">
                <label>Y</label>
                <input
                  type="number"
                  value={selected.y}
                  step={GRID}
                  onChange={(e) => updateElement(selected.id, { y: snap(Number(e.target.value)) })}
                />
              </div>
            </div>
            <div className="map-prop-group">
              <label>Rotação</label>
              <input
                type="range"
                min={0}
                max={360}
                value={selected.rotacao || 0}
                onChange={(e) => updateElement(selected.id, { rotacao: Number(e.target.value) })}
              />
              <div className="map-rotate-controls">
                <button
                  className="map-rotate-btn"
                  onClick={() => updateElement(selected.id, { rotacao: ((selected.rotacao || 0) - 90 + 360) % 360 })}
                >
                  ← 90°
                </button>
                <span className="map-prop-value">{selected.rotacao || 0}°</span>
                <button
                  className="map-rotate-btn"
                  onClick={() => updateElement(selected.id, { rotacao: ((selected.rotacao || 0) + 90) % 360 })}
                >
                  90° →
                </button>
              </div>
            </div>
            <button
              className="map-btn-delete"
              onClick={() => selectedIds.forEach(id => deleteElement(id))}
            >
              🗑 Apagar{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}
            </button>
          </div>
        )}

        {/* Toolbar */}
        {!readOnly && (
          <div className="map-toolbar">
            <div className="map-toolbar-group">
              <button
                className="map-btn-add"
                onClick={() => setShowMesaMenu(p => !p)}
              >
                + Mesa
              </button>
              <button
                className="map-btn-add"
                onClick={() => setShowRackMenu(p => !p)}
              >
                + Rack
              </button>
              <button
                className="map-btn-add"
                onClick={() => createNewElement('objeto')}
              >
                + Objeto
              </button>
            </div>

            {/* Mesa creation menu */}
            {showMesaMenu && (
              <div className="map-mesa-menu">
                <h4>Adicionar Mesa</h4>
                {mesas.filter(m => !elements.some(e => e.dados_json?.mesaId === m.id)).length > 0 && (
                  <>
                    <div className="map-mesa-menu-section">Mesas existentes:</div>
                    {mesas
                      .filter(m => !elements.some(e => e.dados_json?.mesaId === m.id))
                      .map(m => (
                        <button
                          key={m.id}
                          className="map-mesa-item"
                          onClick={() => createFromMesa(m)}
                        >
                          {m.nome} ({m.qtdPontos} pts)
                        </button>
                      ))}
                  </>
                )}
                <div className="map-mesa-menu-section">Nova mesa:</div>
                <input
                  type="text"
                  placeholder="Nome da mesa"
                  value={newMesaNome}
                  onChange={(e) => setNewMesaNome(e.target.value)}
                  className="map-input"
                />
                <div className="map-prop-group">
                  <label>Pontos: {newMesaPontos}</label>
                  <input
                    type="range"
                    min={2}
                    max={24}
                    value={newMesaPontos}
                    onChange={(e) => setNewMesaPontos(Number(e.target.value))}
                  />
                </div>
                <button className="map-btn-save" onClick={createNewMesa}>
                  Criar mesa
                </button>
              </div>
            )}

            {/* Rack creation menu */}
            {showRackMenu && (
              <div className="map-mesa-menu">
                <h4>Adicionar Rack</h4>
                {racks.filter(r => !elements.some(e => e.dados_json?.rackId === r.id)).length > 0 && (
                  <>
                    <div className="map-mesa-menu-section">Racks existentes:</div>
                    {racks
                      .filter(r => !elements.some(e => e.dados_json?.rackId === r.id))
                      .map(r => (
                        <button
                          key={r.id}
                          className="map-mesa-item"
                          onClick={() => createFromRack(r)}
                        >
                          {r.nome} ({r.patchPanels?.length || 0} PP)
                        </button>
                      ))}
                  </>
                )}
                <div className="map-mesa-menu-section">Novo rack:</div>
                <input
                  type="text"
                  placeholder="Nome do rack"
                  value={newRackNome}
                  onChange={(e) => setNewRackNome(e.target.value)}
                  className="map-input"
                />
                <button className="map-btn-save" onClick={createNewRack}>
                  Criar rack
                </button>
              </div>
            )}
          </div>
        )}

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
                    {patchPanel ? (
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
                            let mesaNome = null;
                            let pontoId = null;
                            let atencao = false;
                            let andarNome = null;
                            for (const mesa of mesas) {
                              for (const ponto of mesa.pontos || []) {
                                if (ponto.patchId === patchPanel.id && ponto.porta === porta) {
                                  mesaNome = mesa.nome;
                                  pontoId = ponto.id;
                                  atencao = ponto.atencao;
                                  andarNome = mesa.andarNome || null;
                                  break;
                                }
                              }
                              if (mesaNome) break;
                            }
                            return (
                              <tr key={porta} className={!mesaNome ? 'map-info-row-empty' : atencao ? 'map-info-row-atencao' : ''}>
                                <td>{porta}</td>
                                <td>{mesaNome ? `${andarNome ? andarNome + ' / ' : ''}${mesaNome}` : '-'}</td>
                                <td>{pontoId ? `P${pontoId}` : '-'}</td>
                                <td>
                                  {mesaNome
                                    ? <span className={atencao ? 'map-info-status-atencao' : 'map-info-status-ok'}>
                                        {atencao ? '⚠ Atenção' : '✓ Vinculado'}
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
