import { useAuth } from '../context/AuthContext';

export default function Header({ onSync, syncing, onSwitchCompany, onVoltarAndares }) {
  const { empresaNome, andarNome, andarId } = useAuth();

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
        <button
          id="syncBtn"
          onClick={onSync}
          disabled={syncing}
          title="Sincronizar"
        >
          {syncing ? '⟳ Sincronizando...' : '⟳ Sincronizar'}
        </button>
        {andarId && (
          <button className="btnNav" onClick={onVoltarAndares}>
            ← Andares
          </button>
        )}
        <button className="btnNav" onClick={onSwitchCompany}>
          ← Empresa
        </button>
      </div>
    </header>
  );
}
