import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from './Notification';
import { api, requireSuccess } from '../api';

import { usePrompt } from './PromptModal';
import SystemModal, { hasOpenModal } from './SystemModal';

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

const MapEditor = forwardRef(function MapEditor({ onVoltar, readOnly = false, demoData = null, initialAndarId = null, onAndarChange }, ref) {
  const { empresaId, empresaNome } = useAuth();
  const { success, error: showError } = useNotification();
  const prompt = usePrompt();
  const writeQueue = useRef(Promise.resolve());
  const activeAndarRef = useRef(null);
  const initialAndarRef = useRef(initialAndarId);

  const [andares, setAndares] = useState([]);
  const [activeAndarId, setActiveAndarId] = useState(null);
  activeAndarRef.current = activeAndarId;
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

  const [showPropPanel, setShowPropPanel] = useState(true);
  const [hamburguerOpen, setHamburguerOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoElement, setInfoElement] = useState(null);
  const [infoPatchPanel, setInfoPatchPanel] = useState(null);
  const [rackConnections, setRackConnections] = useState([]);
  const [rackConnectionsLoading, setRackConnectionsLoading] = useState(false);

  const canvasRef = useRef(null);
  const saveTimerRef = useRef(null);
  const hasAutoZoomed = useRef(false);

  // --- Selection box (drag-to-select) ---
  const [selectionBox, setSelectionBox] = useState(null);
  const selectionBoxRef = useRef(null);
  const isSelecting = useRef(false);
  const hasDragged = useRef(false);
  const selectionStart = useRef({ x: 0, y: 0 });
  const SELECTION_THRESHOLD = 5;

  // --- Load data ---
  const loadAndares = useCallback(async () => {
    if (demoData) {
      setAndares(demoData.andares);
      setActiveAndarId(current => current ?? (demoData.andares.some(a => a.id === initialAndarRef.current)
        ? initialAndarRef.current : demoData.andares[0]?.id ?? null));
      return;
    }
    try {
      const data = await api.get('/api/andares');
      if (data.success) {
        setAndares(data.andares);
        setActiveAndarId(data.andares.some(a => a.id === initialAndarRef.current)
          ? initialAndarRef.current : data.andares[0]?.id ?? null);
      }
    } catch {
      showError('Erro ao carregar andares');
    }
  }, [demoData, showError]);

  const loadMesas = useCallback(async (andarId) => {
    if (demoData) {
      setMesas(demoData.mesas.filter(mesa => !andarId || mesa.andarId === andarId));
      setRacks(demoData.racks);
      return;
    }
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
  }, [demoData]);

  const loadElements = useCallback(async (andarId) => {
    if (demoData) {
      setElements(demoData.elements.filter(element => !andarId || element.andarId === andarId));
      return;
    }
    try {
      const url = andarId ? `/api/map-elements?andarId=${andarId}` : '/api/map-elements';
      const data = await api.get(url);
      if (data.success) {
        const normalized = (data.elements || []).map(el => ({
          ...el,
          andarId: el.andar_id ?? el.andarId ?? null,
          font_size: el.font_size ?? 12,
        }));
        setElements(normalized);
      }
    } catch {
      showError('Erro ao carregar elementos');
    }
  }, [demoData, showError]);

  useEffect(() => {
    loadAndares();
  }, [loadAndares]);

  useEffect(() => {
    if (activeAndarId !== null) onAndarChange?.(activeAndarId);
  }, [activeAndarId, onAndarChange]);

  useEffect(() => {
    hasAutoZoomed.current = false;
    if (activeAndarId !== null) {
      loadElements(activeAndarId);
      loadMesas(activeAndarId);
    } else {
      loadElements();
      loadMesas();
    }
  }, [activeAndarId, loadElements, loadMesas]);

  // Auto zoom to fit when elements load
  useEffect(() => {
    if (elements.length > 0 && !hasAutoZoomed.current) {
      hasAutoZoomed.current = true;
      const timer = setTimeout(() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || elements.length === 0) return;
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
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [elements]);

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
    setRackConnections([]);
  }, []);

  const selectPatchPanel = useCallback(async (pp) => {
    setInfoPatchPanel(pp);
    setRackConnectionsLoading(true);
    setRackConnections([]);
    try {
      const rack = racks.find(r => r.nome === infoElement?.nome);
      if (rack) {
        if (demoData) {
          const connections = demoData.mesas.flatMap(mesa =>
            mesa.pontos
              .filter(ponto => ponto.rackId === rack.id && ponto.patchId === pp.id && ponto.porta)
              .map(ponto => ({
                porta: ponto.porta,
                mesaNome: mesa.nome,
                andarNome: mesa.andarNome,
                pontoId: ponto.id,
                atencao: Boolean(ponto.atencao),
              }))
          );
          setRackConnections(connections);
        } else {
          const data = await api.get(`/api/rack-connections?rackId=${rack.id}&patchId=${pp.id}`);
          if (data.success) setRackConnections(data.connections || []);
        }
      }
    } catch {
      // ignore
    } finally {
      setRackConnectionsLoading(false);
    }
  }, [demoData, racks, infoElement]);

  const backToRack = useCallback(() => {
    setInfoPatchPanel(null);
    setRackConnections([]);
  }, []);

  // Serializa o salvamento dos gestos e dos formulários, sem aplicar rascunhos.
  const persistElements = useCallback(transform => {
    const floor = activeAndarId;
    const operation = writeQueue.current.catch(() => {}).then(async () => {
      if (activeAndarRef.current !== floor) throw new Error('O andar selecionado mudou.');
      const snapshot = transform ? transform(elementsRef.current) : elementsRef.current;
      saveStatusRef.current = 'saving';
      setSaveStatus('saving');
      try {
        requireSuccess(await api.put('/api/map-elements/bulk', { elements: snapshot, andarId: floor }));
        if (activeAndarRef.current !== floor) return;
        if (transform) {
          elementsRef.current = snapshot;
          setElements(snapshot);
        }
        const status = snapshot === elementsRef.current ? 'saved' : 'unsaved';
        saveStatusRef.current = status;
        setSaveStatus(status);
      } catch (err) {
        if (activeAndarRef.current === floor) {
          saveStatusRef.current = 'unsaved';
          setSaveStatus('unsaved');
        }
        throw err;
      }
    });
    writeQueue.current = operation;
    return operation;
  }, [activeAndarId]);

  const saveElements = useCallback(() => persistElements().catch(err => showError(err.message || 'Erro ao salvar')), [persistElements, showError]);
  // A navegação só desmonta o editor depois de concluir a fila e o último gesto.
  const flushPendingChanges = useCallback(async () => {
    clearTimeout(saveTimerRef.current);
    if (saveStatusRef.current === 'saving') await writeQueue.current;
    else await writeQueue.current.catch(() => {});
    if (saveStatusRef.current === 'unsaved') await persistElements();
  }, [persistElements]);
  useImperativeHandle(ref, () => ({ flushPendingChanges }), [flushPendingChanges]);
  const scheduleSave = useCallback(() => {
    saveStatusRef.current = 'unsaved';
    setSaveStatus('unsaved');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveElements, 1000);
  }, [saveElements]);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const updateElement = useCallback((id, updates) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    scheduleSave();
  }, [scheduleSave]);

  const commitPopup = useCallback(async transform => {
    clearTimeout(saveTimerRef.current);
    await persistElements(transform);
    success('Mapa atualizado');
  }, [persistElements, success]);

  const buildElement = (tipo, nome, entityId) => ({
    id: `temp-${Date.now()}`, empresa_id: empresaId, andarId: activeAndarId, tipo, nome,
    x: snap(200), y: snap(200), ...DEFAULTS[tipo], rotacao: 0, ordem: elementsRef.current.length,
    font_size: 12, dados_json: entityId ? (tipo === 'mesa' ? { mesaId: entityId } : { rackId: entityId }) : null
  });

  const openCreate = tipo => {
    if (readOnly) return;
    const available = (tipo === 'mesa' ? mesas : racks).filter(entity => !elementsRef.current.some(el => el.dados_json?.[tipo === 'mesa' ? 'mesaId' : 'rackId'] === entity.id));
    const fields = tipo === 'objeto' ? [] : [{ key: 'entityId', label: `Selecionar ${tipo}`, type: 'select', initialValue: '',
      options: [{ value: '', label: tipo === 'mesa' ? 'Nova representação de mesa' : 'Novo rack' }, ...available.map(entity => ({ value: String(entity.id), label: entity.nome }))] }];
    fields.push({ key: 'nome', label: 'Nome', required: true, visibleWhen: values => !values.entityId });
    let createdRack = null;
    return prompt.form(`Adicionar ${tipo}`, tipo === 'mesa' ? 'Adicione uma representação ao mapa ou selecione uma mesa cadastrada para exibir seus pontos.' : '', fields, {
      onSubmit: async values => {
        let entityId = Number(values.entityId) || null;
        let nome = entityId ? available.find(entity => entity.id === entityId)?.nome : values.nome;
        if (tipo === 'rack' && !entityId) {
          if (!createdRack) createdRack = requireSuccess(await api.post('/api/racks', { nome })).rack;
          else if (createdRack.nome !== nome) {
            requireSuccess(await api.put(`/api/racks/${createdRack.id}`, { nome }));
            createdRack = { ...createdRack, nome };
          }
          entityId = createdRack.id;
          nome = createdRack.nome;
        }
        const el = buildElement(tipo, nome, entityId);
        await commitPopup(current => [...current, el]);
        setSelectedIds([el.id]);
        if (tipo === 'rack') await loadMesas(activeAndarId);
      }
    });
  };

  const openProperties = el => {
    if (readOnly) return;
    return prompt.form('Editar propriedades', `Tipo: ${el.tipo}`, [
      { key: 'nome', label: 'Nome', initialValue: el.nome, required: true },
      { key: 'cor', label: 'Cor', type: 'color', initialValue: el.cor },
      { key: 'largura', label: 'Largura', type: 'number', initialValue: el.largura, min: GRID * 2, step: GRID },
      { key: 'altura', label: 'Altura', type: 'number', initialValue: el.altura, min: GRID * 2, step: GRID },
      { key: 'x', label: 'Posição X', type: 'number', initialValue: el.x, step: GRID },
      { key: 'y', label: 'Posição Y', type: 'number', initialValue: el.y, step: GRID },
      { key: 'rotacao', label: 'Rotação (graus)', type: 'number', initialValue: el.rotacao || 0, min: 0, max: 360 },
      { key: 'font_size', label: 'Tamanho da fonte', type: 'number', initialValue: el.font_size || 12, min: 8, max: 36, integer: true }
    ], { wide: true, onSubmit: async values => {
      const updates = { ...values, largura: snap(Number(values.largura)), altura: snap(Number(values.altura)), x: snap(Number(values.x)), y: snap(Number(values.y)), rotacao: Number(values.rotacao), font_size: Number(values.font_size) };
      await commitPopup(current => {
        if (!current.some(item => item.id === el.id)) throw new Error('O elemento não está mais disponível.');
        return current.map(item => item.id === el.id ? { ...item, ...updates } : item);
      });
    } });
  };

  const openFont = () => {
    const ids = [...selectedIds];
    const first = elementsRef.current.find(el => ids.includes(el.id));
    return prompt.form('Editar tamanho da fonte', `${ids.length} elementos selecionados`, [
      { key: 'font_size', label: 'Tamanho da fonte', type: 'number', initialValue: first?.font_size || 12, min: 8, max: 36, integer: true }
    ], { onSubmit: values => commitPopup(current => current.map(el => ids.includes(el.id) ? { ...el, font_size: Number(values.font_size) } : el)) });
  };

  const requestDelete = useCallback(ids => {
    if (readOnly || !ids.length) return;
    const names = elementsRef.current.filter(el => ids.includes(el.id)).map(el => el.nome).join(', ');
    return prompt.confirm('Excluir do mapa', `Excluir ${names}? Apenas as representações serão removidas; mesas, racks e vínculos cadastrados serão mantidos.`, {
      onConfirm: async () => {
        await commitPopup(current => current.filter(el => !ids.includes(el.id)));
        setSelectedIds(current => current.filter(id => !ids.includes(id)));
      }
    });
  }, [readOnly, prompt, commitPopup]);

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
    } else if (e.target === canvasRef.current || e.target.classList?.contains('map-canvas')) {
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
    if (readOnly || hasOpenModal()) return;
    if (e.shiftKey && !handle) {
      return;
    }
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
        if ((selectedIds.includes(el.id) ? selectedIds : [el.id]).includes(item.id)) {
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
  }, [readOnly, zoom, pan, selectedIds, elements, scheduleSave, updateElement]);

  // Atalhos não atravessam popups, inclusive consultas e confirmações.
  useEffect(() => {
    const handleKey = e => {
      if (readOnly || hasOpenModal() || e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        e.preventDefault();
        requestDelete([...selectedIds]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [readOnly, selectedIds, requestDelete]);

  const selected = selectedIds.length ? elements.find(el => el.id === selectedIds[0]) : null;
  const handleDoubleClick = el => openProperties(el);

  // --- Canvas size ---
  const canvasSize = { width: 4000, height: 3000 };

  return (
    <div className="map-editor-wrapper">
      {/* Header */}
      <div className="map-editor-header">
        <button className="map-btn-voltar" onClick={onVoltar}>← Voltar</button>
        <span className="map-title">🗺 Mapa — {demoData?.empresaNome || empresaNome}</span>

        {!readOnly && (
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
        )}

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

      {readOnly && (
        <div className="map-hamburger">
          <button
            className="map-hamburger-btn"
            onClick={() => setHamburguerOpen(o => !o)}
            aria-label="Andares"
          >
            ☰
          </button>
          <span className="map-hamburger-label">Andares</span>
          {hamburguerOpen && (
            <div className="map-hamburger-panel">
              {andares.map(a => (
                <button
                  key={a.id}
                  className={`map-andar-tab ${activeAndarId === a.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveAndarId(a.id);
                    setSelectedIds([]);
                    setHamburguerOpen(false);
                  }}
                >
                  {a.nome}
                </button>
              ))}
              {andares.length === 0 && (
                <span className="map-andar-tab-disabled">Nenhum andar</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="map-editor-body">
        {/* Canvas */}
        <div className="map-canvas-wrapper" ref={canvasRef} onWheel={handleWheel} onMouseDown={handleCanvasMouseDown}>
          <div
            className="map-canvas"
            style={{
              width: canvasSize.width,
              height: canvasSize.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
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
                <div className="map-element-label" style={{ fontSize: `${el.font_size || 12}px` }}>{el.nome}</div>

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

        {!readOnly && showPropPanel && selected && <div className="map-properties">
          <h3>Propriedades{selectedIds.length > 1 ? ` (${selectedIds.length} selecionados)` : ''}</h3>
          {selectedIds.length === 1 ? <>
            <div className="map-prop-group"><label>Nome</label><span className="map-prop-value">{selected.nome}</span></div>
            <div className="map-prop-group"><label>Tipo</label><span className="map-prop-value">{selected.tipo}</span></div>
            <div className="map-prop-group"><label>Dimensões</label><span className="map-prop-value">{selected.largura} × {selected.altura}</span></div>
            <div className="map-prop-group"><label>Posição</label><span className="map-prop-value">{selected.x}, {selected.y}</span></div>
            <div className="map-prop-group"><label>Rotação</label><span className="map-prop-value">{selected.rotacao || 0}°</span></div>
            <div className="map-prop-group"><label>Cor / fonte</label><span className="map-prop-value">{selected.cor} / {selected.font_size || 12}px</span></div>
            <button className="map-btn-save" onClick={() => openProperties(selected)}>Editar propriedades</button>
          </> : <button className="map-btn-save" onClick={openFont}>Editar tamanho da fonte</button>}
          <button className="map-btn-delete" onClick={() => requestDelete([...selectedIds])}>Excluir{selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}</button>
        </div>}
        {!readOnly && <div className="map-toolbar"><div className="map-toolbar-group">
          <button className="map-btn-add" onClick={() => openCreate('mesa')}>+ Mesa</button>
          <button className="map-btn-add" onClick={() => openCreate('rack')}>+ Rack</button>
          <button className="map-btn-add" onClick={() => openCreate('objeto')}>+ Objeto</button>
        </div></div>}

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
        <SystemModal title={infoPatchPanel?.nome || infoElement.nome} onClose={closeInfoModal} dismissOnBackdrop overlayClass="map-info-overlay" panelClass="map-info-panel">
            {/* Mesa info */}
            {infoElement.tipo === 'mesa' && (() => {
              const mesaId = infoElement.dados_json?.mesaId;
              const mesa = mesas.find(m => m.id === mesaId);
              return (
                <>
                  <div className="map-info-header">
                    <h3>{mesa ? mesa.nome : infoElement.nome}</h3>
                    <button className="map-info-close" aria-label="Fechar informações" onClick={closeInfoModal}>✕</button>
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
                      <button className="map-info-close" aria-label="Fechar informações" onClick={closeInfoModal}>✕</button>
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
                      <button className="map-info-close" aria-label="Fechar informações" onClick={closeInfoModal}>✕</button>
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
                  <button className="map-info-close" aria-label="Fechar informações" onClick={closeInfoModal}>✕</button>
                </div>
                <div className="map-info-empty">Objeto sem informações de vínculo</div>
              </>
            )}
        </SystemModal>
      )}
    </div>
  );
});

export default MapEditor;
