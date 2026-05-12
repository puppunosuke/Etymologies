// エントリポイント: ダイヤルとデータ層を接続して、Decide → iframe更新 を担う

import { loadEntries, getEntry } from "./data.js";
import { initDial } from "./dial.js";

const WORD_URL_BASE = "https://english-battle.com/word/";

function buildWordUrl(word) {
  // 単語は基本ASCIIだが念のためencode
  return WORD_URL_BASE + encodeURIComponent(word);
}

function showWord(number) {
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

  // タイトルに反映
  document.title = `${number}. ${entry.word} — Etymologies`;
}

async function main() {
  try {
    await loadEntries();
  } catch (err) {
    console.error(err);
    const placeholder = document.getElementById("framePlaceholder");
    placeholder.innerHTML = `<p style="color:#c33">データ読み込みに失敗しました: ${err.message}</p>`;
    return;
  }

  const svg = document.getElementById("dial");
  initDial(svg, showWord);
}

main();
