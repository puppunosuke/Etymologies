// 語源ビューア: ダイヤルで番号入力 → english-battle.com の単語ページを iframe 表示
//
// v2 では FAB から全画面で呼び出されるサブ機能。
// initEtymology() で初期化する。複数回呼ばれても初期化は1度だけ。

import { loadEntries, getEntry } from "../data.js";
import { initDial } from "./dial.js";

const WORD_URL_BASE = "https://english-battle.com/word/";

let initialized = false;

function buildWordUrl(word) {
  // 単語は基本ASCIIだが念のためencode
  return WORD_URL_BASE + encodeURIComponent(word);
}

/**
 * 指定番号の単語を iframe に表示する。
 * ダイヤルからの選択でも、フラッシュカードの「語源を見る」ボタンからでも使う。
 * 呼び出し前に initEtymology()（= loadEntries 完了）が済んでいる必要がある。
 */
export function showWord(number) {
  const entry = getEntry(number);
  if (!entry) {
    console.warn(`番号 ${number} のエントリが見つからない`);
    return;
  }

  const url = buildWordUrl(entry.word);
  const frame = document.getElementById("wordFrame");
  const placeholder = document.getElementById("framePlaceholder");
  const fallback = document.getElementById("fallbackLink");

  // iframe に表示
  frame.src = url;
  frame.classList.remove("hidden");
  placeholder.classList.add("hidden");

  // 新規タブで開く用フォールバックリンクを常時表示
  // （frame-busting されてた場合のエスケープハッチ）
  fallback.classList.remove("hidden");
  fallback.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * 語源ビューアを初期化する。CSV をロードしてダイヤルを描画。
 * 2回目以降の呼び出しは何もしない。
 */
export async function initEtymology() {
  if (initialized) return;
  try {
    await loadEntries();
  } catch (err) {
    console.error(err);
    const placeholder = document.getElementById("framePlaceholder");
    if (placeholder) {
      placeholder.innerHTML = `<p style="color:#c33">データ読み込みに失敗しました: ${err.message}</p>`;
    }
    return;
  }

  const svg = document.getElementById("dial");
  initDial(svg, showWord);
  initialized = true;
}
