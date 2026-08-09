import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDlewqM3W3be3hAxbEbm4Vvtqqltf9Cgq0",
  authDomain: "truproperty-5988a.firebaseapp.com",
  projectId: "truproperty-5988a",
  storageBucket: "truproperty-5988a.firebasestorage.app",
  messagingSenderId: "547828831710",
  appId: "1:547828831710:web:5c4fa5099696c67e0af94f",
  measurementId: "G-2TQQL1EJYD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
