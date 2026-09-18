import { auth } from './firebase';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5050';

// Envuelve fetch agregando el token de Firebase en el header Authorization.
export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API}${path}`, { ...options, headers });
}

export { API };
