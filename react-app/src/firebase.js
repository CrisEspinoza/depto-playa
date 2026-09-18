// Configuración pública de Firebase (segura para el frontend).
// La seguridad real la dan las reglas de Firestore + la autorización del backend.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAXly2-JQplGPKKEJI5STqEmL8INK6p-7E',
  authDomain: 'depto-playa.firebaseapp.com',
  projectId: 'depto-playa',
  storageBucket: 'depto-playa.firebasestorage.app',
  messagingSenderId: '944105163887',
  appId: '1:944105163887:web:2eab9bf0dab1ab1d91919a',
  measurementId: 'G-3GXLKFF0WT',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
