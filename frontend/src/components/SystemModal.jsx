import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const modalStack = [];
const backgroundState = new Map();
let originalOverflow = '';
function updateBackground() {
  const top = modalStack.at(-1);
  for (const el of document.body.children) {
    if (top) el.inert = el !== top;
    else if (backgroundState.has(el)) el.inert = backgroundState.get(el);
  }
  if (!top) {
    document.body.style.overflow = originalOverflow;
    backgroundState.clear();
  }
}
export const hasOpenModal = () => modalStack.length > 0;
const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

export default function SystemModal({ children, title, onClose, busy = false, dismissOnBackdrop = false, overlayClass = '', panelClass = '', initialFocus = 'first', print = false }) {
  const id = useId();
  const panel = useRef(null);
  const host = useRef(null);
  const current = useRef({ onClose, busy });
  current.current = { onClose, busy };
  if (!host.current) {
    host.current = document.createElement('div');
    host.current.dataset.systemModal = '';
  }
  host.current.className = print ? 'system-modal-host system-modal-print' : 'system-modal-host';
  useEffect(() => {
    const container = host.current;
    const origin = document.activeElement;
    if (!modalStack.length) originalOverflow = document.body.style.overflow;
    for (const el of document.body.children) {
      if (!el.hasAttribute('data-system-modal') && !backgroundState.has(el)) backgroundState.set(el, el.inert);
    }
    document.body.appendChild(container);
    document.body.style.overflow = 'hidden';
    modalStack.push(container);
    updateBackground();
    const controls = () => [...panel.current.querySelectorAll(focusable)].filter(el => el.getClientRects().length);
    const first = initialFocus === 'cancel' ? panel.current.querySelector('[data-modal-cancel]') : panel.current.querySelector('[data-modal-autofocus]');
    (first || controls()[0] || panel.current).focus();
    const handleKey = e => {
      if (modalStack.at(-1) !== container) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!current.current.busy) current.current.onClose?.();
      } else if (e.key === 'Tab') {
        const items = controls();
        const index = items.indexOf(document.activeElement);
        if (!items.length || (e.shiftKey ? index <= 0 : index === items.length - 1 || index < 0)) {
          e.preventDefault();
          ((e.shiftKey ? items.at(-1) : items[0]) || panel.current).focus();
        }
      }
    };
    const handleFocus = e => {
      if (modalStack.at(-1) === container && !container.contains(e.target)) (controls()[0] || panel.current).focus();
    };
    document.addEventListener('keydown', handleKey, true);
    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      document.removeEventListener('focusin', handleFocus);
      modalStack.splice(modalStack.indexOf(container), 1);
      container.remove();
      updateBackground();
      if (origin?.isConnected && !origin.closest('[inert]')) origin.focus();
    };
  }, []);
  return createPortal(
    <div className={`system-modal-overlay ${overlayClass}`} onClick={e => {
      if (e.target === e.currentTarget && dismissOnBackdrop && !busy) onClose?.();
    }}>
      <div ref={panel} className={`system-modal-panel ${panelClass}`} role="dialog" aria-modal="true" aria-labelledby={id} aria-busy={busy} tabIndex={-1}>
        <span id={id} className="sr-only">{title}</span>
        {children}
      </div>
    </div>, host.current
  );
}
