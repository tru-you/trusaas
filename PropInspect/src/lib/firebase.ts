import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBPNvNFJjX57vIIMb3pCVw3i-jvAa2bye8",
  authDomain: "tru-homes.co.za",
  projectId: "gen-lang-client-0151924955",
  storageBucket: "gen-lang-client-0151924955.firebasestorage.app",
  messagingSenderId: "174120974302",
  appId: "1:174120974302:web:ea1ef8cd775cf93a2c0f4f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);
