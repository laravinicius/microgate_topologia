import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useNotification } from './Notification';

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function pointCode(mesa, point) {
  return `${mesa.andarNome || 'Andar'} · ${mesa.nome} · P${String(point.id).padStart(2, '0')}`;
}

export default function PointsInventory({ mesas = [], racks = [], readOnly = false, onRefresh, demoData = null }) {
  const { andarId } = useAuth();
  const { success, error } = useNotification();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [selection, setSelection] = useState({ rackId: '', patchId: '', porta: '' });
  const [saving, setSaving] = useState(false);

  const floorMesas = useMemo(() => demoData ? mesas : mesas.filter(mesa => Number(mesa.andarId) === Number(andarId)), [mesas, andarId, demoData]);
  const rows = useMemo(() => floorMesas.flatMap(mesa => (mesa.pontos || []).map(point => ({ mesa, point, code: pointCode(mesa, point) }))).filter(row => {
    const text = `${row.code} ${row.mesa.andarNome || ''} ${row.mesa.nome}`.toLocaleLowerCase('pt-BR');
    return text.includes(search.toLocaleLowerCase('pt-BR'));
  }), [floorMesas, search]);

  const getLink = (point) => {
    const rack = racks.find(item => Number(item.id) === Number(point.rackId));
    const panel = rack?.patchPanels?.find(item => Number(item.id) === Number(point.patchId));
    return rack && panel && point.porta ? { rack, panel, text: `${rack.nome} · ${panel.nome} · Porta ${point.porta}` } : null;
  };

  const occupiedPorts = useMemo(() => {
    const occupied = new Set();
    mesas.forEach(mesa => (mesa.pontos || []).forEach(point => {
      if (!point.rackId || !point.patchId || !point.porta) return;
      occupied.add(`${point.rackId}:${point.patchId}:${point.porta}`);
    }));
    return occupied;
  }, [mesas]);

  const selectedRack = racks.find(rack => String(rack.id) === String(selection.rackId));
  const selectedPanel = selectedRack?.patchPanels?.find(panel => String(panel.id) === String(selection.patchId));

  const openEditor = (mesa, point) => {
    setEditing({ mesa, point });
    setSelection({ rackId: point.rackId || '', patchId: point.patchId || '', porta: point.porta || '' });
  };

  const saveLink = async (unlink = false) => {
    setSaving(true);
    try {
      const result = await api.put('/api/pontos/vinculo', {
        mesaId: editing.mesa.id,
        pontoId: editing.point.id,
        rackId: unlink ? null : Number(selection.rackId),
        patchId: unlink ? null : Number(selection.patchId),
        porta: unlink ? null : Number(selection.porta),
      });
      if (!result.success) throw new Error(result.message);
      setEditing(null);
      success(unlink ? 'Vínculo removido' : 'Ponto vinculado ao rack');
      if (onRefresh) await onRefresh();
    } catch (err) { error(err.message || 'Não foi possível salvar o vínculo'); }
    finally { setSaving(false); }
  };

  const printLabels = () => {
    const htmlRows = rows.map(({ mesa, point }) => {
      const link = getLink(point);
      const mapping = link ? htmlEscape(`${link.rack.nome} · ${link.panel.nome} · Porta ${point.porta}`) : 'Sem vínculo com rack';
      return `<article><small>${htmlEscape(mesa.andarNome || 'Andar')}</small><strong>${htmlEscape(mesa.nome)} · P${String(point.id).padStart(2, '0')}</strong><span>${mapping}</span></article>`;
    }).join('');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return error('Permita a janela de impressão no navegador');
    printWindow.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Etiquetas de pontos</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;margin:0;color:#182230}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:7mm}.sheet article{height:38mm;border:1px solid #9ca3af;border-radius:3mm;padding:4mm;display:flex;flex-direction:column;justify-content:center;gap:2mm;break-inside:avoid}.sheet small{font-size:8pt;color:#526071}.sheet strong{font-size:13pt}.sheet span{font-size:9pt;color:#354152}</style></head><body><main class="sheet">${htmlRows}</main><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    printWindow.document.close();
  };

  return (
    <main className="points-workspace">
      <header className="points-heading"><div><span className="workspace-eyebrow">IDENTIFICAÇÃO DE CABEAMENTO</span><h1>Pontos</h1><p>{rows.length} pontos {demoData ? 'na demonstração' : 'neste andar'}</p></div><div className="points-actions"><label className="points-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar mesa ou ponto" /></label>{!readOnly && <button className="rack-primary-action" onClick={printLabels} disabled={!rows.length}>Imprimir etiquetas</button>}</div></header>

      <section className="points-table-card"><div className="points-table-head"><span>Identificação</span><span>Conexão física</span><span>Status</span><span>Ação</span></div>{rows.map(({ mesa, point, code }) => {
        const link = getLink(point);
        return <article className="points-table-row" key={`${mesa.id}-${point.id}`}><div><strong>{code}</strong><small>{mesa.andarNome || 'Sem andar'}</small></div><div>{link ? <><strong>{link.rack.nome}</strong><small>{link.panel.nome} · Porta {point.porta}</small></> : <span className="rack-muted">Sem vínculo</span>}</div><span className={`point-status${point.atencao ? ' attention' : link ? ' connected' : ''}`}>{point.atencao ? 'Atenção' : link ? 'Vinculado' : 'Livre'}</span><div>{!readOnly && <button className="point-link-button" onClick={() => openEditor(mesa, point)}>{link ? 'Editar vínculo' : 'Vincular'}</button>}</div></article>;
      })}{!rows.length && <div className="workspace-empty compact"><h2>Nenhum ponto encontrado</h2><p>Crie uma mesa e seus pontos para começar o cabeamento.</p></div>}</section>

      {editing && <div className="floor-plan-modal-overlay" onClick={() => setEditing(null)}><section className="point-link-modal" onClick={event => event.stopPropagation()}><header><div><span className="workspace-eyebrow">VINCULAR PONTO</span><h2>{pointCode(editing.mesa, editing.point)}</h2></div><button onClick={() => setEditing(null)} aria-label="Fechar">×</button></header><label>Rack<select value={selection.rackId} onChange={event => setSelection({ rackId: event.target.value, patchId: '', porta: '' })}><option value="">Escolher rack</option>{racks.map(rack => <option key={rack.id} value={rack.id}>{rack.nome}</option>)}</select></label><label>Patch panel<select disabled={!selectedRack} value={selection.patchId} onChange={event => setSelection(current => ({ ...current, patchId: event.target.value, porta: '' }))}><option value="">Escolher patch panel</option>{(selectedRack?.patchPanels || []).map(panel => <option key={panel.id} value={panel.id}>{panel.nome} · {panel.portas} portas</option>)}</select></label><label>Porta<select disabled={!selectedPanel} value={selection.porta} onChange={event => setSelection(current => ({ ...current, porta: event.target.value }))}><option value="">Escolher porta livre</option>{Array.from({ length: Number(selectedPanel?.portas || 0) }, (_, index) => index + 1).filter(port => !occupiedPorts.has(`${selection.rackId}:${selection.patchId}:${port}`) || (Number(editing.point.rackId) === Number(selection.rackId) && Number(editing.point.patchId) === Number(selection.patchId) && Number(editing.point.porta) === port)).map(port => <option key={port} value={port}>Porta {port}</option>)}</select></label><footer>{getLink(editing.point) && <button className="point-unlink-button" onClick={() => saveLink(true)} disabled={saving}>Remover vínculo</button>}<button className="rack-primary-action" onClick={() => saveLink(false)} disabled={saving || !selection.rackId || !selection.patchId || !selection.porta}>{saving ? 'Salvando…' : 'Salvar vínculo'}</button></footer></section></div>}
    </main>
  );
}
