// Firebase 初期化。Auth と Firestore のインスタンスをここから export する。
//
// CDN から ESM 形式で読み込んでいる（ビルドツール不要）。
// バージョンは固定（latest エイリアスは提供されていない）。
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRMF96Bkj785HAq0Oki_rbXqlPtMc1ci8",
  authDomain: "punoji-etymologies.firebaseapp.com",
  projectId: "punoji-etymologies",
  storageBucket: "punoji-etymologies.firebasestorage.app",
  messagingSenderId: "298395705512",
  appId: "1:298395705512:web:04dec81cc6aab2329b629d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
