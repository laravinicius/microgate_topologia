import { useEffect, useState } from 'react';

export default function AuthenticatedShell({
  children,
  title = 'InfraMap',
  context,
  items = [],
  accountItems = [],
  className = ''
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const renderItems = (entries) => entries.map((item) => (
    <button
      key={item.label}
      type="button"
      className={`app-sidebar-item${item.active ? ' active' : ''}${item.danger ? ' danger' : ''}`}
      onClick={() => {
        setMobileOpen(false);
        item.onClick?.();
      }}
      aria-current={item.active ? 'page' : undefined}
    >
      {item.label}
    </button>
  ));

  return (
    <div className={`authenticated-shell ${className}`.trim()}>
      <aside
        id="authenticated-sidebar"
        className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Navegação do InfraMap"
      >
        <div className="app-sidebar-brand">
          <img src="/img/logo_horizontal_white.webp" alt="Microgate IT Solutions" className="app-sidebar-logo" />
          <div className="app-sidebar-brand-copy">
            <strong>InfraMap</strong>
            {context && <span className="app-sidebar-context">{context}</span>}
          </div>
        </div>

        <nav className="app-sidebar-nav" aria-label="Navegação principal">
          <span className="app-sidebar-section-label">Navegação</span>
          {renderItems(items)}
        </nav>

        {accountItems.length > 0 && (
          <div className="app-sidebar-account" aria-label="Conta">
            <span className="app-sidebar-section-label">Conta</span>
            {renderItems(accountItems)}
          </div>
        )}
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="app-sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-shell-main">
        <div className="app-mobile-bar">
          <button
            type="button"
            className="app-mobile-toggle"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
            aria-controls="authenticated-sidebar"
            onClick={() => setMobileOpen(open => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {mobileOpen
                ? <path d="m6 6 12 12M18 6 6 18" />
                : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <strong>{title}</strong>
        </div>
        <main className="app-shell-content">{children}</main>
      </div>
    </div>
  );
}
