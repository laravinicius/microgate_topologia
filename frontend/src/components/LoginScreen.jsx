import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginScreen">
      <div className="loginBox">
        <img src="/img/microgate2.png" alt="Logo" className="loginLogo" />
        <h2>InfraMap</h2>
        <p>Digite seu usuário e senha para acessar</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Usuário"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="loginError">{error}</p>
      </div>
    </div>
  );
}
