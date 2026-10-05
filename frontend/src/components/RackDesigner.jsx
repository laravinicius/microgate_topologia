import { useMemo, useState } from 'react';
import { api } from '../api';
import { useNotification } from './Notification';

const UNIT_HEIGHT = 28;

export default function RackDesigner({ racks = [], mesas = [], readOnly = false, onRefresh, onCreateRack, onCreatePatchPanel }) {
  const { success, error } = useNotification();
  const [activeRackId, setActiveRackId] = useState(racks[0]?.id ?? null);
  const [newItem, setNewItem] = useState({ nome: '', tipo: 'equipamento', posicaoU: '', alturaU: 1 });
  const [saving, setSaving] = useState(false);
  const activeRack = racks.find(rack => Number(rack.id) === Number(activeRackId)) || racks[0];

  const connections = useMemo(() => {
    const items = [];
    mesas.forEach(mesa => (mesa.pontos || []).forEach(point => {
      if (Number(point.rackId) !== Number(activeRack?.id) || !point.patchId || !point.porta) return;
      const patch = activeRack.patchPanels.find(item => Number(item.id) === Number(point.patchId));
      items.push({ mesa: mesa.nome, andar: mesa.andarNome || '', ponto: point.id, patch: patch?.nome || 'Patch panel', porta: point.porta, atencao: point.atencao });
    }));
    return items;
  }, [mesas, activeRack]);

  const occupiedUnits = useMemo(() => {
    const units = new Set();
    if (!activeRack) return units;
    [...(activeRack.patchPanels || []).filter(panel => panel.posicaoU), ...(activeRack.equipamentos || [])].forEach(item => {
      for (let unit = Number(item.posicaoU); unit < Number(item.posicaoU) + Number(item.alturaU || 1); unit += 1) units.add(unit);
    });
    return units;
  }, [activeRack]);

  const reload = async () => { if (onRefresh) await onRefresh(); };

  const placePatch = async (patch, posicaoU) => {
    if (!posicaoU) return;
    try {
      const result = await api.put(`/api/rack-patch-panels/${patch.id}/position`, { posicaoU: Number(posicaoU) });
      if (!result.success) throw new Error(result.message);
      success(`${patch.nome} posicionado em U${posicaoU}`);
      await reload();
    } catch (err) { error(err.message || 'Não foi possível posicionar o patch panel'); }
  };

  const changeRackHeight = async (event) => {
    const alturaU = Number(event.target.value);
    if (!Number.isInteger(alturaU) || alturaU < 1) return;
    try {
      const result = await api.put(`/api/racks/${activeRack.id}`, { alturaU });
      if (!result.success) throw new Error(result.message);
      await reload();
    } catch (err) { error(err.message || 'Não foi possível alterar a altura do rack'); }
  };

  const createEquipment = async (event) => {
    event.preventDefault();
    if (!newItem.nome.trim() || !newItem.posicaoU) return;
    setSaving(true);
    try {
      const result = await api.post(`/api/racks/${activeRack.id}/equipamentos`, { ...newItem, posicaoU: Number(newItem.posicaoU), alturaU: Number(newItem.alturaU) });
      if (!result.success) throw new Error(result.message);
      setNewItem({ nome: '', tipo: 'equipamento', posicaoU: '', alturaU: 1 });
      success('Equipamento adicionado ao rack');
      await reload();
    } catch (err) { error(err.message || 'Não foi possível adicionar o equipamento'); }
    finally { setSaving(false); }
  };

  const deleteEquipment = async (equipment) => {
    if (!window.confirm(`Remover ${equipment.nome} do rack?`)) return;
    try {
      const result = await api.del(`/api/rack-equipamentos/${equipment.id}`);
      if (!result.success) throw new Error(result.message);
      await reload();
    } catch (err) { error(err.message || 'Não foi possível remover o equipamento'); }
  };

  if (!activeRack) return <main className="rack-workspace"><div className="workspace-empty"><span className="workspace-eyebrow">RACKS</span><h2>Nenhum rack cadastrado</h2><p>Crie um rack na área de administração para começar a identificar as portas.</p></div></main>;

  const alturaRack = Number(activeRack.alturaU) || 42;
  const placedPatches = activeRack.patchPanels.filter(panel => panel.posicaoU);
  const unplacedPatches = activeRack.patchPanels.filter(panel => !panel.posicaoU);

  return (
    <main className="rack-workspace">
      <aside className="rack-picker">
        <div><span className="workspace-eyebrow">INFRAESTRUTURA</span><h2>Racks</h2></div>
        {racks.map(rack => <button key={rack.id} className={`rack-picker-item${Number(rack.id) === Number(activeRack.id) ? ' active' : ''}`} onClick={() => setActiveRackId(rack.id)}><strong>{rack.nome}</strong><span>{rack.patchPanels?.length || 0} patch panels</span></button>)}
        {!readOnly && <button className="rack-picker-new" onClick={onCreateRack}>+ Novo rack</button>}
      </aside>

      <section className="rack-main">
        <div className="rack-heading"><div><span className="workspace-eyebrow">VISTA FRONTAL · 19 POLEGADAS</span><h1>{activeRack.nome}</h1><p>{connections.length} ponto(s) conectado(s) neste rack</p></div>{!readOnly && <label className="rack-height-control">Altura <input type="number" min="12" max="100" defaultValue={alturaRack} key={`${activeRack.id}-${alturaRack}`} onBlur={changeRackHeight} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} /> U</label>}</div>

        <div className="rack-layout-grid">
          <div className="rack-frame" style={{ height: alturaRack * UNIT_HEIGHT }} aria-label={`${activeRack.nome}, rack com ${alturaRack} unidades`}>
            {Array.from({ length: alturaRack }, (_, index) => {
              const unit = alturaRack - index;
              return <div className={`rack-unit${occupiedUnits.has(unit) ? ' occupied' : ''}`} key={unit}><span>U{unit}</span></div>;
            })}
            {[...placedPatches, ...(activeRack.equipamentos || [])].map(item => (
              <article key={`${item.id}-${item.tipo || 'patch'}`} className={`rack-mounted-item ${item.tipo ? `kind-${item.tipo}` : 'kind-patch'}`} style={{ top: (alturaRack - Number(item.posicaoU) - Number(item.alturaU || 1) + 1) * UNIT_HEIGHT, height: Number(item.alturaU || 1) * UNIT_HEIGHT }}>
                <strong>{item.nome}</strong><span>{item.tipo ? item.tipo : `${item.portas} portas · U${item.posicaoU}`}</span>
                {item.tipo && !readOnly && <button aria-label={`Remover ${item.nome}`} onClick={() => deleteEquipment(item)}>×</button>}
              </article>
            ))}
          </div>

          <aside className="rack-inspector">
            <section className="rack-panel-card"><div className="rack-panel-card-heading"><h3>Patch panels</h3><span>{activeRack.patchPanels.length}</span></div>
              {activeRack.patchPanels.length === 0 && <p className="rack-muted">Nenhum patch panel cadastrado.</p>}
              {activeRack.patchPanels.map(panel => <div className="rack-patch-row" key={panel.id}><div><strong>{panel.nome}</strong><span>{panel.portas} portas {panel.posicaoU ? `· U${panel.posicaoU}` : '· sem posição'}</span></div>{!readOnly && !panel.posicaoU && <select aria-label={`Posicionar ${panel.nome}`} defaultValue="" onChange={event => placePatch(panel, event.target.value)}><option value="">Posição U</option>{Array.from({ length: alturaRack }, (_, i) => i + 1).filter(unit => !occupiedUnits.has(unit)).map(unit => <option key={unit} value={unit}>U{unit}</option>)}</select>}</div>)}
              {!readOnly && <button className="rack-add-inline" onClick={() => onCreatePatchPanel?.(activeRack.id)}>+ Adicionar patch panel</button>}
            </section>

            {!readOnly && <form className="rack-panel-card rack-add-form" onSubmit={createEquipment}><div className="rack-panel-card-heading"><h3>Adicionar equipamento</h3></div><label>Identificação<input required maxLength="120" value={newItem.nome} onChange={event => setNewItem(current => ({ ...current, nome: event.target.value }))} placeholder="Ex.: Switch 24 portas" /></label><div className="rack-form-row"><label>Tipo<select value={newItem.tipo} onChange={event => setNewItem(current => ({ ...current, tipo: event.target.value }))}><option value="switch">Switch</option><option value="roteador">Roteador</option><option value="nobreak">Nobreak</option><option value="servidor">Servidor</option><option value="equipamento">Outro</option></select></label><label>Altura U<input type="number" min="1" max={alturaRack} value={newItem.alturaU} onChange={event => setNewItem(current => ({ ...current, alturaU: event.target.value }))} /></label></div><label>Unidade inicial<select required value={newItem.posicaoU} onChange={event => setNewItem(current => ({ ...current, posicaoU: event.target.value }))}><option value="">Selecionar U</option>{Array.from({ length: alturaRack }, (_, i) => i + 1).filter(unit => Array.from({ length: Number(newItem.alturaU) || 1 }, (_, offset) => unit + offset).every(slot => slot <= alturaRack && !occupiedUnits.has(slot))).map(unit => <option key={unit} value={unit}>U{unit}</option>)}</select></label><button className="rack-primary-action" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar ao rack'}</button></form>}
          </aside>
        </div>

        <section className="rack-connections-card"><div className="rack-panel-card-heading"><div><span className="workspace-eyebrow">CABEAMENTO</span><h3>Pontos conectados</h3></div><span>{connections.length}</span></div>{connections.length ? <div className="rack-connection-list">{connections.map((item, index) => <div key={`${item.andar}-${item.mesa}-${item.ponto}-${index}`}><strong>{item.andar ? `${item.andar} / ` : ''}{item.mesa} · P{item.ponto}</strong><span>{item.patch} · porta {item.porta}</span><i className={item.atencao ? 'attention' : ''}>{item.atencao ? 'Atenção' : 'Conectado'}</i></div>)}</div> : <p className="rack-muted">Os pontos vinculados aos patch panels deste rack aparecerão aqui.</p>}</section>
      </section>
    </main>
  );
}
