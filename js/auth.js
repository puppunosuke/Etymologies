// 認証: Googleログイン／ログアウト／ログイン状態監視を提供する
//
// signInWithPopup は別ウィンドウを開いてGoogleアカウント選択 → 戻ってくる流れ。
// onAuthStateChanged は購読型。ログイン状態が変わるたびに callback が呼ばれる。
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { auth } from "./firebase-init.js";

const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  return signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
