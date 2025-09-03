// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth";
import {getFirestore} from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyAn2vBZpmDcZlssIyOr5ApWgy2uK344nmw',
  authDomain: 'dct-supportlink.firebaseapp.com',
  projectId: 'dct-supportlink',
  storageBucket: 'dct-supportlink.firebasestorage.app',
  messagingSenderId: '517961716843',
  appId: '1:517961716843:web:70835e80b97d1bea5ccd2e',
  measurementId: 'G-YHPXBPHZ2V'
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = getFirestore(app);
