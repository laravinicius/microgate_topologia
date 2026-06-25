const TOKEN_KEY = 'inframap-auth-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Não autenticado');
  }

  return res.json();
}

export const api = {
  get: (url) => request(url),
  post: (url, body) =>
    request(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),
  put: (url, body) =>
    request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  del: (url) =>
    request(url, {
      method: 'DELETE'
    })
};
