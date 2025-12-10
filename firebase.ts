// @ts-ignore
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBc4jLjtbRdfmTbFQEtZsyRbfXt2VwFT14",
    authDomain: "neon-plinko.firebaseapp.com",
    projectId: "neon-plinko",
    storageBucket: "neon-plinko.firebasestorage.app",
    messagingSenderId: "873177412568",
    appId: "1:873177412568:web:e8a2c4a083fcc597edf8ad",
    measurementId: "G-Q5JK2VYZBV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Analytics conditionally
let analytics;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Firebase Analytics failed to initialize:", e);
}

export { db, analytics, auth };