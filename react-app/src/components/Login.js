import React, { useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const traducirError = (code) => {
  const map = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Ese correo ya está registrado.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  };
  return map[code] || 'Ocurrió un error al iniciar sesión.';
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const withGoogle = async () => {
    setError(''); setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(traducirError(e.code));
    }
    setLoading(false);
  };

  const withEmail = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(traducirError(err.code));
    }
    setLoading(false);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Beach Accounting</h1>
        <p style={styles.subtitle}>Contabilidad del departamento de playa</p>

        <button style={styles.googleBtn} onClick={withGoogle} disabled={loading}>
          Iniciar sesión con Google
        </button>

        <div style={styles.divider}><span style={styles.dividerText}>o con tu correo</span></div>

        <form onSubmit={withEmail}>
          <input
            style={styles.input}
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button style={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? 'Cargando…' : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.toggle}>
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button style={styles.link} onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: 16 },
  card: { background: '#fff', borderRadius: 16, padding: '36px 28px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.25)' },
  title: { margin: 0, color: '#5b21b6', fontSize: 28, textAlign: 'center' },
  subtitle: { marginTop: 6, marginBottom: 24, color: '#6b7280', textAlign: 'center', fontSize: 14 },
  googleBtn: { width: '100%', padding: '12px', borderRadius: 10, border: '2px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 15 },
  divider: { textAlign: 'center', margin: '18px 0', borderTop: '1px solid #eee', position: 'relative' },
  dividerText: { position: 'relative', top: -11, background: '#fff', padding: '0 10px', color: '#9ca3af', fontSize: 13 },
  input: { width: '100%', padding: '12px', marginBottom: 12, borderRadius: 10, border: '2px solid #e5e7eb', fontSize: 15, boxSizing: 'border-box' },
  primaryBtn: { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#667eea,#764ba2)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15 },
  error: { color: '#dc2626', textAlign: 'center', marginTop: 14, fontSize: 14 },
  toggle: { textAlign: 'center', marginTop: 18, color: '#6b7280', fontSize: 14 },
  link: { border: 'none', background: 'none', color: '#5b21b6', fontWeight: 700, cursor: 'pointer', fontSize: 14 },
};
