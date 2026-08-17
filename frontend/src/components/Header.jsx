import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Header({ onSwitchCompany, onVoltarAndares }) {
  const { empresaNome, andarNome, andarId } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const voltarAndares = () => {
    setMenuOpen(false);
    onVoltarAndares();
  };

  const trocarEmpresa = () => {
    setMenuOpen(false);
    onSwitchCompany();
  };

  return (
    <header>
      <div className="headerLeft">
        {andarId && (
          <span className="andar-badge">{andarNome || 'Sem andar'}</span>
        )}
        {empresaNome && (
          <span className="empresa-badge">{empresaNome}</span>
        )}
      </div>
      <img src="/img/microgate2.png" alt="Logo" className="headerLogo" />
      <div className="headerRight">
        <div className="desktop-nav">
          {andarId && (
            <button className="btnNav" onClick={onVoltarAndares}>
              ← Andares
            </button>
          )}
          <button className="btnNav" onClick={onSwitchCompany}>
            ← Empresa
          </button>
        </div>
        <div className="mobile-menu">
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            ☰
          </button>
          {menuOpen && (
            <div className="mobile-menu-panel">
              {andarId && (
                <button className="btnNav" onClick={voltarAndares}>
                  ← Andares
                </button>
              )}
              <button className="btnNav" onClick={trocarEmpresa}>
                ← Empresa
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
