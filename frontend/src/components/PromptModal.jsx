import { useState, useCallback, useRef, useEffect, useId, createContext, useContext } from 'react';
import SystemModal from './SystemModal';
import { requireSuccess } from '../api';

const PromptContext = createContext(null);

export function PromptProvider({ children }) {
  const [prompt, setPrompt] = useState(null);
  const queue = useRef([]);
  const active = useRef(null);
  const sequence = useRef(0);
  const next = useCallback(() => {
    active.current = queue.current.shift() || null;
    setPrompt(active.current);
  }, []);
  const createPrompt = useCallback(config => new Promise(resolve => {
    queue.current.push({ ...config, resolve, id: ++sequence.current });
    if (!active.current) next();
  }), [next]);
  const close = useCallback(value => {
    active.current?.resolve(value);
    next();
  }, [next]);
  useEffect(() => () => {
    [active.current, ...queue.current].filter(Boolean).forEach(item => item.resolve(item.type === 'confirm' ? false : null));
  }, []);
  const text = useCallback((title, message = '', initialValue = '', options = {}) =>
    createPrompt({ ...options, type: 'text', title, message, initialValue }), [createPrompt]);
  const alert = useCallback((title, message = '') => createPrompt({ type: 'alert', title, message }), [createPrompt]);
  const confirm = useCallback((title, message = '', options = {}) => createPrompt({ ...options, type: 'confirm', title, message }), [createPrompt]);
  const options = useCallback((title, message, opts) => createPrompt({ type: 'options', title, message, options: opts }), [createPrompt]);
  const form = useCallback((title, message, fields, options = {}) => createPrompt({ ...options, type: 'form', title, message, fields }), [createPrompt]);
  return <PromptContext.Provider value={{ text, alert, confirm, options, form, close }}>
    {children}
    {prompt && <PromptDialog key={prompt.id} prompt={prompt} onClose={close} />}
  </PromptContext.Provider>;
}

export const usePrompt = () => useContext(PromptContext);

function PromptDialog({ prompt, onClose }) {
  const id = useId();
  const fields = prompt.type === 'text' ? [{ key: 'text', label: prompt.message || 'Nome', required: true, initialValue: prompt.initialValue }] : prompt.fields || [];
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, f.initialValue ?? (f.type === 'checkbox' ? false : f.type === 'checkbox-group' ? [] : '')])));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const visibleFields = fields.filter(f => !f.visibleWhen || f.visibleWhen(values));
  const cancel = () => { if (!sending.current) onClose(prompt.type === 'confirm' ? false : prompt.type === 'alert' ? true : null); };
  const submit = async value => {
    if (sending.current) return;
    const validation = {};
    const normalized = { ...values };
    for (const f of visibleFields) {
      const v = values[f.key];
      if ((!f.type || f.type === 'text') && typeof v === 'string') normalized[f.key] = v.trim();
      if (f.required && (v === '' || (typeof v === 'string' && !v.trim()))) validation[f.key] = 'Preencha este campo.';
      if (f.type === 'number' && (v === '' || !Number.isFinite(Number(v)) || (f.integer && !Number.isInteger(Number(v))) || (f.min !== undefined && Number(v) < f.min) || (f.max !== undefined && Number(v) > f.max))) validation[f.key] = `Informe um número${f.integer ? ' inteiro' : ''}${f.min !== undefined ? ` a partir de ${f.min}` : ''}${f.max !== undefined ? ` até ${f.max}` : ''}.`;
      if (f.type === 'color' && !/^#[\da-f]{6}$/i.test(v)) validation[f.key] = 'Informe uma cor hexadecimal, como #2563eb.';
    }
    const result = prompt.type === 'text' ? normalized.text : prompt.type === 'form' ? normalized : value;
    try {
      Object.assign(validation, prompt.validate?.(result) || {});
    } catch (err) {
      setError(err.message || 'Não foi possível validar os campos.');
      return;
    }
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      document.getElementById(`${id}-${Object.keys(validation)[0]}`)?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const response = await (prompt.onSubmit || prompt.onConfirm)?.(result);
      if (response?.success === false) requireSuccess(response);
      onClose(result);
    } catch (err) {
      setError(err.message || 'Não foi possível concluir. Tente novamente.');
      sending.current = false;
      setBusy(false);
    }
  };
  return <SystemModal title={prompt.title} onClose={cancel} busy={busy} dismissOnBackdrop={prompt.type === 'alert' || prompt.type === 'options'} initialFocus={prompt.type === 'confirm' ? 'cancel' : 'first'} overlayClass="promptSistemaOverlay" panelClass={`promptSistema${prompt.wide ? ' promptSistemaWide' : ''}`}>
    <form noValidate onSubmit={e => { e.preventDefault(); if (prompt.type !== 'options') submit(true); }}>
      <div className="system-modal-heading"><h3>{prompt.title}</h3><button type="button" className="system-modal-close" aria-label="Fechar popup" onClick={cancel} disabled={busy}>×</button></div>
      {prompt.message && prompt.type !== 'text' && <p>{prompt.message}</p>}
      <fieldset disabled={busy} className="system-modal-fields">
        {visibleFields.map((f, index) => {
          const fieldId = `${id}-${f.key}`;
          const props = { id: fieldId, 'aria-required': f.required || undefined, 'aria-invalid': !!errors[f.key], 'aria-describedby': errors[f.key] ? `${fieldId}-error` : undefined, 'data-modal-autofocus': index === 0 ? '' : undefined };
          const change = value => {
            setValues(prev => ({ ...prev, [f.key]: value }));
            setErrors(prev => ({ ...prev, [f.key]: undefined }));
            setError('');
          };
          return <div className="promptCampo" key={f.key}>
            <label htmlFor={fieldId}>{f.label}</label>
            {f.type === 'select' ? <select {...props} value={values[f.key]} onChange={e => change(e.target.value)}>{f.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
              : f.type === 'checkbox' ? <input {...props} type="checkbox" checked={!!values[f.key]} onChange={e => change(e.target.checked)} />
              : f.type === 'checkbox-group' ? <div id={fieldId} role="group" aria-label={f.label}>{f.options.length ? f.options.map(opt => <label className="system-modal-checkbox" key={opt.value}><input type="checkbox" checked={values[f.key].includes(opt.value)} onChange={e => change(e.target.checked ? [...values[f.key], opt.value] : values[f.key].filter(v => v !== opt.value))} />{opt.label}</label>) : <p>Nenhuma empresa cadastrada.</p>}</div>
              : <input {...props} type={f.type === 'color' ? 'text' : f.type || 'text'} value={values[f.key]} autoComplete={f.type === 'password' ? 'new-password' : 'off'} min={f.min} max={f.max} step={f.step} onChange={e => change(e.target.value)} />}
            {f.type === 'color' && <div className="system-modal-palette">{['#3f3f3f', '#2563eb', '#374151', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#ffffff'].map(color => <button key={color} type="button" aria-label={`Cor ${color}`} aria-pressed={values[f.key] === color} style={{ background: color }} onClick={() => change(color)} />)}</div>}
            {errors[f.key] && <span id={`${fieldId}-error`} className="system-modal-error">{errors[f.key]}</span>}
          </div>;
        })}
        {prompt.type === 'options' && <div className="promptSistemaOpcoes">{prompt.options.map((opt, i) => <button key={i} type="button" className="promptOpcao" onClick={() => submit(opt.valor)}>{opt.label}</button>)}</div>}
      </fieldset>
      {error && <p className="system-modal-error" role="alert">{error}</p>}
      <div className="promptSistemaAcoes">
        {prompt.type !== 'alert' && <button type="button" data-modal-cancel className="promptCancelar" onClick={cancel} disabled={busy}>Cancelar</button>}
        {prompt.type !== 'options' && <button type="submit" className={`promptConfirmar ${prompt.type === 'confirm' && prompt.danger !== false ? 'promptPerigo' : ''}`} disabled={busy}>{busy ? 'Aguarde…' : prompt.submitLabel || (prompt.type === 'confirm' ? 'Excluir' : prompt.type === 'alert' ? 'OK' : 'Salvar')}</button>}
      </div>
    </form>
  </SystemModal>;
}
