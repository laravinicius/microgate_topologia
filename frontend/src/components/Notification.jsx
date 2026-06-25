import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const NotificationContext = createContext(null);

let notificationId = 0;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((message, options = {}) => {
    const id = ++notificationId;
    const { title, type = 'info', duration = 3000 } = options;
    setNotifications(prev => [...prev, { id, message, title, type, duration }]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, exiting: true } : n)
    );
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 250);
  }, []);

  const success = useCallback((message, options) =>
    notify(message, { ...options, type: 'success' }), [notify]);

  const error = useCallback((message, options) =>
    notify(message, { ...options, type: 'error' }), [notify]);

  const warning = useCallback((message, options) =>
    notify(message, { ...options, type: 'warning' }), [notify]);

  const info = useCallback((message, options) =>
    notify(message, { ...options, type: 'info' }), [notify]);

  return (
    <NotificationContext.Provider value={{ notify, success, error, warning, info, dismiss }}>
      {children}
      <div className="notification-container">
        {notifications.map(n => (
          <NotificationItem key={n.id} notification={n} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);

function NotificationItem({ notification, onDismiss }) {
  const { id, message, title, type, duration, exiting } = notification;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`notification notification--${type}${exiting ? ' notification--exiting' : ''}`}>
      <span className="notifIcon">{icons[type] || icons.info}</span>
      <div className="notifBody">
        {title && <div className="notifTitle">{title}</div>}
        <div className="notifMessage">{message}</div>
      </div>
      <button className="notifClose" onClick={() => onDismiss(id)}>×</button>
      <div className="notifProgress" />
    </div>
  );
}
