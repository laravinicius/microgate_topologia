import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const PromptContext = createContext(null);

export function PromptProvider({ children }) {
  const [prompt, setPrompt] = useState(null);

  const createPrompt = useCallback((config) => {
    return new Promise((resolve) => {
      setPrompt({ ...config, resolve });
    });
  }, []);

  const close = useCallback((value) => {
    setPrompt((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  const text = useCallback((title, message = '', initialValue = '') =>
    createPrompt({ type: 'text', title, message, initialValue }), [createPrompt]);

  const alert = useCallback((title, message = '') =>
    createPrompt({ type: 'alert', title, message }), [createPrompt]);

  const confirm = useCallback((title, message = '') =>
    createPrompt({ type: 'confirm', title, message }), [createPrompt]);

  const options = useCallback((title, message, opts) =>
    createPrompt({ type: 'options', title, message, options: opts }), [createPrompt]);

  return (
    <PromptContext.Provider value={{ text, alert, confirm, options, close }}>
      {children}
      {prompt && <PromptDialog prompt={prompt} onClose={close} />}
    </PromptContext.Provider>
  );
}

export const usePrompt = () => useContext(PromptContext);

function PromptDialog({ prompt, onClose }) {
  const [inputValue, setInputValue] = useState(prompt.initialValue || '');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (prompt.type === 'alert') onClose(true);
        else if (prompt.type === 'confirm') onClose(false);
        else if (prompt.type === 'options') onClose(null);
        else onClose(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [prompt, onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (prompt.type === 'alert') onClose(true);
      else if (prompt.type === 'confirm') onClose(false);
      else if (prompt.type === 'options') onClose(null);
      else onClose(null);
    }
  };

  if (prompt.type === 'text') {
    return (
      <div className="promptSistemaOverlay" onClick={handleOverlayClick}>
        <div className="promptSistema" role="dialog" aria-modal="true">
          <form onSubmit={(e) => { e.preventDefault(); onClose(inputValue.trim() || null); }}>
            <h3>{prompt.title}</h3>
            {prompt.message && <p>{prompt.message}</p>}
            <input
              type="text" autoComplete="off"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              autoFocus
            />
            <div className="promptSistemaAcoes">
              <button type="button" className="promptCancelar" onClick={() => onClose(null)}>Cancelar</button>
              <button type="submit" className="promptConfirmar">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (prompt.type === 'alert') {
    return (
      <div className="promptSistemaOverlay" onClick={handleOverlayClick}>
        <div className="promptSistema" role="dialog" aria-modal="true">
          <form onSubmit={(e) => { e.preventDefault(); onClose(true); }}>
            <h3>{prompt.title}</h3>
            {prompt.message && <p>{prompt.message}</p>}
            <div className="promptSistemaAcoes">
              <button type="submit" className="promptConfirmar">Ok</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (prompt.type === 'confirm') {
    return (
      <div className="promptSistemaOverlay" onClick={handleOverlayClick}>
        <div className="promptSistema" role="dialog" aria-modal="true">
          <form onSubmit={(e) => { e.preventDefault(); onClose(true); }}>
            <h3>{prompt.title}</h3>
            {prompt.message && <p>{prompt.message}</p>}
            <div className="promptSistemaAcoes">
              <button type="button" className="promptCancelar" onClick={() => onClose(false)}>Cancelar</button>
              <button type="submit" className="promptConfirmar promptPerigo">Apagar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (prompt.type === 'options') {
    return (
      <div className="promptSistemaOverlay" onClick={handleOverlayClick}>
        <div className="promptSistema" role="dialog" aria-modal="true">
          <form onSubmit={(e) => { e.preventDefault(); onClose(null); }}>
            <h3>{prompt.title}</h3>
            {prompt.message && <p>{prompt.message}</p>}
            <div className="promptSistemaOpcoes">
              {prompt.options.map((opt, i) => (
                <button key={i} type="button" className="promptOpcao" onClick={() => onClose(opt.valor)}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="promptSistemaAcoes">
              <button type="button" className="promptCancelar" onClick={() => onClose(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
