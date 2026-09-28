# 坡洪組國際災情值週用全球災害資訊整合平台

[開啟網站](https://mahagala.github.io/disasterWeeklyDuty/)

供國際災情值週彙整使用，整合 GDACS、ERCC、USGS，以及設定完成後的 ReliefWeb。支援過去 7 / 14 / 30 天、自訂日期、災害類別、警報與關鍵字篩選，並提供地圖、CSV、PNG 圖卡與 PPTX 週報。

## 資料如何更新

GitHub Actions 每小時第 17 分鐘（UTC；台灣時間同樣為每小時第 17 分鐘）排程下載官方資料，驗證成功後存放在 `data/`，再發布到 GitHub Pages。排程可能延遲，請以網頁顯示的時間為準。

瀏覽器只讀取本站資料檔，不再透過公共 CORS 代理下載災情。**「重新載入資料」只讀取最近一次排程結果，不會觸發官方來源下載。** 本機電腦無須保持開機。

- 綠燈：各訂閱資料下載正常，且成功下載時間在 3 小時內。
- 橙燈：部分訂閱失敗或資料超過 3 小時，使用可取得的真實資料。
- 紅燈：資料不可用，且本頁沒有可保留的先前資料。
- 灰燈：來源尚未設定，例如 ReliefWeb 尚未取得核准的 appname。

展開「資料更新狀態」查看各來源成功下載時間與失敗原因。這是**下載時間**，不是災害發生時間或官方發布時間。

每個來源獨立處理；GDACS 四個訂閱也分別保留快照。每次請求最多等待 25 秒，暫時性連線或伺服器錯誤最多嘗試 3 次。空資料、HTML 防護頁、格式錯誤及缺少必要欄位均不覆蓋上次成功的資料。`manifest.json` 記錄結果與 SHA-256；網頁讀取逾時為 20 秒，遇到更新途中不一致的檔案會顯示錯誤，保留本頁先前資料。

## 管理者操作

### 手動更新

1. 打開 GitHub 專案的 **Actions**。
2. 選擇 **Update disaster data and publish**。
3. 點選 **Run workflow**，分支選 `main`。
4. 完成後回網頁按「重新載入資料」。

工作流程會先執行測試、下載資料、將資料快照提交回 `main`，最後以 Pages artifact 發布網站。單一來源失敗時仍先發布其他可用資料，再將工作流程標示失敗，管理者可在摘要查看原因。未設定 ReliefWeb 不算下載失敗。

GitHub Pages 的 **Settings → Pages → Build and deployment → Source** 使用 **GitHub Actions**。工作流程只在 `main` 執行，需允許該工作流程寫入 repository contents，以及 Pages deployment / OIDC 權限。若分支保護阻止機器人提交，需調整相應的資料儲存方式，不能直接略過資料保留步驟。

GitHub 公開 repository 長期無活動時可能停用排程；若更新時間持續過舊，請檢查 Actions 是否啟用、是否執行失敗或等待排程。

### ReliefWeb 申請與啟用

目前使用 API **v2**，需官方核准的 **appname**。

- [官方申請說明](https://apidoc.reliefweb.int/parameters#appname)
- [申請表](https://docs.google.com/forms/d/e/1FAIpQLScR5EE_SBhweLLg_2xMCnXNbT6md4zxqIB00OL0yZWyrqX_Nw/viewform)

表單需要姓名、機構全名與網站、公務信箱、用途及偏好的 appname。官方目前只受理機構提供的信箱，不受理 Gmail、Yahoo、Hotmail 等私人信箱；表單表示將於兩個工作天內回覆，實際以官方審核為準。

用途參考：

> Collect public disaster reports for a weekly global disaster dashboard and duty briefing. Data will be fetched hourly, cached, and displayed with links to the original ReliefWeb reports. Website: https://mahagala.github.io/disasterWeeklyDuty/

appname 以「機構或個人識別 + 用途 + 隨機字元」組合，例如 `mahagala-weekly-disasters-k7m4`。這只是申請建議值，必須使用官方最終核准的值。

收到核准後：

1. 前往 **Settings → Secrets and variables → Actions → New repository secret**。
2. Name 填 `RELIEFWEB_APPNAME`，Secret 填官方核准值。
3. 手動執行上述更新工作流程。
4. 確認 ReliefWeb 成功下載並顯示綠燈。若網站防護或 API 拒絕請求，查看工作流程摘要，聯繫官方確認核准值與使用方式。

目前抓最新 150 篇報告，不保證覆蓋完整 7 天或 30 天；其他 RSS 同樣受官方提供的歷史範圍限制。日期篩選只作用於已取得資料。

## 本機開發

需 Python 3.9+；網頁本身不需要 npm 安裝或建置。

```sh
python3 scripts/update_feeds.py
python3 -m http.server 8765 --bind 127.0.0.1
```

開啟 `http://127.0.0.1:8765/`。**不要直接雙擊 HTML**，瀏覽器會限制 `file://` 讀取資料檔。

測試需 Node.js 22+ 與 Python：

```sh
node --check app.js
node --test tests/loader.test.cjs
python3 -m unittest discover -s tests -v
```

## 其他外部服務

地圖、國旗、字型及前端函式庫仍需網路。OSM Nominatim 逆向地理編碼可在設定關閉，查詢結果儲存於本機瀏覽器。Gemini API Key 為選填，儲存在瀏覽器 LocalStorage，啟用摘要時會傳送給 Google Gemini API；請勿提交到公開程式碼。

災情中文摘要含規則式轉換，地理資訊也可能有缺漏，值週簡報請核對各來源原文。

## 檔案

- `index.html` / `styles.css`：介面與樣式。
- `app.js`：本站資料載入、來源解析、篩選、地圖、中文摘要與匯出。
- `scripts/update_feeds.py`：資料下載、驗證、重試及快照保留。
- `.github/workflows/update-data.yml`：每小時更新、測試與 GitHub Pages 發布。
- `data/`：官方資料快照及來源狀態。
- `tests/`：下載失敗、舊資料保留、格式驗證、網頁載入與狀態檢查。
