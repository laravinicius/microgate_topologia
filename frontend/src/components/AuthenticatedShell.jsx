import { useEffect, useRef, useState } from 'react';

export default function AuthenticatedShell({
  children,
  title = 'InfraMap',
  context,
  items = [],
  accountItems = [],
  className = '',
  busy = false
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    sidebarRef.current?.querySelector('button:not(:disabled)')?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const renderItems = (entries) => entries.map((item) => (
    <div key={item.id || item.label} className="app-sidebar-entry">
      <div className="app-sidebar-entry-row">
        <button
          type="button"
          className={`app-sidebar-item${item.active ? ' active' : ''}${item.danger ? ' danger' : ''}`}
          disabled={busy || item.disabled}
          title={item.description}
          onClick={async () => {
            const navigated = await item.onClick?.();
            if (navigated !== false) setMobileOpen(false);
          }}
          aria-current={item.active ? 'page' : undefined}
        >
          {item.label}
          {item.description && <small className="app-sidebar-item-description">{item.description}</small>}
        </button>
        {item.children?.length > 0 && (
          <button type="button" className="app-sidebar-expand" disabled={busy || item.disabled}
            aria-label={item.expanded ? 'Recolher andares' : 'Expandir andares'}
            aria-expanded={Boolean(item.expanded)} aria-controls={`sidebar-${item.id}-children`}
            onClick={item.onToggle}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className={item.expanded ? 'expanded' : ''}>
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
      {item.children?.length > 0 && (
        <div id={`sidebar-${item.id}-children`} className="app-sidebar-submenu" hidden={!item.expanded}>
          {renderItems(item.children)}
        </div>
      )}
    </div>
  ));

  return (
    <div className={`authenticated-shell ${className}`.trim()}>
      <aside
        ref={sidebarRef}
        id="authenticated-sidebar"
        className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="Navegação do InfraMap"
        inert={isMobile && !mobileOpen ? '' : undefined}
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
            ref={toggleRef}
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
        <main className="app-shell-content" aria-busy={busy} inert={busy || (isMobile && mobileOpen) ? '' : undefined}>{children}</main>
      </div>
    </div>
  );
}
