import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, getToken, clearToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState(null);
  const [empresaNome, setEmpresaNome] = useState(null);
  const [andarId, setAndarId] = useState(null);
  const [andarNome, setAndarNome] = useState(null);

  const fetchSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get('/api/auth/me');
      if (me.authenticated) {
        setUser(me.username);
        const showSelection = sessionStorage.getItem('showCompanySelection') === 'true';
        const empresa = showSelection ? null : (me.empresaId || null);
        setEmpresaId(empresa);
        if (empresa) {
          const info = await api.get('/api/auth/session-info');
          setEmpresaNome(info.empresaNome || null);
          setAndarId(info.andarId || null);
          setAndarNome(info.andarNome || null);
        }
      } else {
        clearToken();
      }
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = async (username, password) => {
    const data = await api.post('/api/auth/login', { username, password });
    if (!data.success) throw new Error(data.message || 'Falha no login');
    setToken(data.token);
    setUser(data.username);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
    }
    sessionStorage.removeItem('showCompanySelection');
    clearToken();
    setUser(null);
    setEmpresaId(null);
    setEmpresaNome(null);
    setAndarId(null);
    setAndarNome(null);
  };

  const selectCompany = async (id) => {
    const data = await api.post('/api/auth/select-company', { empresaId: id });
    if (data.success) {
      sessionStorage.removeItem('showCompanySelection');
      if (data.token) setToken(data.token);
      setEmpresaId(data.empresaId);
      setEmpresaNome(data.empresaNome || null);
      setAndarId(null);
      setAndarNome(null);
    }
    return data;
  };

  const selectAndar = async (id) => {
    const data = await api.post('/api/auth/select-andar', { andarId: id });
    if (data.success) {
      if (data.token) setToken(data.token);
      setAndarId(data.andarId);
      setAndarNome(data.andarNome || null);
    }
    return data;
  };

  const clearAndar = () => {
    setAndarId(null);
    setAndarNome(null);
  };

  const clearEmpresa = () => {
    setEmpresaId(null);
    setEmpresaNome(null);
    setAndarId(null);
    setAndarNome(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, empresaId, empresaNome, andarId, andarNome,
      login, logout, selectCompany, selectAndar, clearAndar, clearEmpresa,
      setEmpresaNome, setEmpresaId
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
