/**
 * 定時抓取各國際災害來源，產生 data.json 快照。
 * 於 GitHub Actions 伺服器端執行 —— 無瀏覽器 CORS 限制，可直接連線各來源。
 *
 * 需求：Node 18+（使用內建的全域 fetch）。無任何 npm 相依套件。
 *
 * 產出格式：
 * {
 *   "fetchedAt": "2026-08-14T06:00:00.000Z",
 *   "sources": {
 *     "gdacs7d":   { "ok": true,  "body": "<xml...>" },
 *     "ercc":      { "ok": false, "error": "..." },
 *     ...
 *   }
 * }
 * body 為各來源的「原始文字」(XML / JSON)，交由前端既有的 parser 解析，
 * 因此伺服器端無需重寫任何解析邏輯。
 */

import { writeFile } from "node:fs/promises";

// 與 app.js 的 CONFIG.feeds 保持一致
const FEEDS = {
  gdacs7d: "https://www.gdacs.org/xml/rss_7d.xml",
  gdacsEq3m: "https://www.gdacs.org/xml/rss_eq_3m.xml",
  gdacsTc3m: "https://www.gdacs.org/xml/rss_tc_3m.xml",
  gdacsFl3m: "https://www.gdacs.org/xml/rss_fl_3m.xml",
  ercc: "https://erccportal.jrc.ec.europa.eu/API/ERCC/Maps/GetLatestDailyMapRss",
  usgs: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.atom",
  reliefweb: "https://api.reliefweb.int/v1/reports?limit=150&preset=latest"
};

const USER_AGENT = "DisasterWeeklyDutyBot/1.0 (+https://github.com; GitHub Actions snapshot)";
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/xml, text/xml, application/json, */*"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(key, url) {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body = await fetchOnce(url);
      console.log(`[OK]   ${key} (${body.length} bytes, 第 ${attempt} 次嘗試)`);
      return { ok: true, body };
    } catch (err) {
      lastErr = err;
      console.warn(`[WARN] ${key} 第 ${attempt} 次失敗：${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2000 * attempt)); // 指數退避
      }
    }
  }
  console.error(`[FAIL] ${key}：${lastErr ? lastErr.message : "unknown"}`);
  return { ok: false, error: lastErr ? lastErr.message : "unknown" };
}

async function main() {
  const entries = Object.entries(FEEDS);
  const results = await Promise.all(
    entries.map(async ([key, url]) => [key, await fetchWithRetry(key, url)])
  );

  const sources = {};
  let okCount = 0;
  for (const [key, result] of results) {
    sources[key] = result;
    if (result.ok) okCount++;
  }

  // 全部來源皆失敗：不要覆寫掉先前的良好快照，直接以非零狀態結束。
  if (okCount === 0) {
    console.error("所有來源皆抓取失敗，保留既有 data.json，不進行覆寫。");
    process.exit(1);
  }

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    okCount,
    total: entries.length,
    sources
  };

  await writeFile("data.json", JSON.stringify(snapshot), "utf8");
  console.log(`已寫入 data.json：${okCount}/${entries.length} 個來源成功。`);
}

main().catch((err) => {
  console.error("fetch-feeds 執行發生未預期錯誤：", err);
  process.exit(1);
});
