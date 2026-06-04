# 坡洪組國際災情值週用全球災害資訊整合平台

本專案是一個基於 **SPA (單頁應用程式)** 架構的全球即時災害資訊整合平台。專為「國家災害防救科技中心 (NCDR) 坡洪組」值週工作設計，能自動抓取、解析、翻譯並展示國際各大組織的最新災害警報資訊。

> [!NOTE]
> 作者對網頁內容不負任何責任。

---

## 📌 核心功能
1. **多來源災害整合**：同步抓取 GDACS（全球災害預警）、ERCC（歐盟每日災情圖）、USGS（全球強震監測）以及 ReliefWeb（聯合國最新報告）。
2. **依坡洪優先順序排序**：系統自動依 **風災 (TC) > 洪災 (FL) > 地震 (EQ) > 火山 (VO) > 野火 (WF) > 乾旱 (DR) > 其它** 的優先順序排序，同類災害以最新日期排序，便於值週人員第一時間聚焦重大水體/坡地災害事件。
3. **無須後端、純瀏覽器執行**：本專案為純前端 HTML/CSS/JS 架構，無須安裝 Node.js，亦無須配置資料庫伺服器，可在本機雙擊開啟或透過網頁伺服器直接瀏覽。

---

## ⚠️ 重要注意事項（同事協作與維護必看）

### 1. 跨域限制與 CORS 代理 (CORS Proxies)
* **原理**：瀏覽器出於安全性限制，預設會攔截直接向外域 RSS 進行的請求（CORS 政策）。
* **機制**：本平台在 `app.js` 中配置了**多重 CORS 代理自動 Fallback 機制**（例如 `api.allorigins.win`、`corsproxy.io` 等）。
* **注意事項**：公共代理伺服器偶爾會有不穩定或速度較慢的情形。如果所有公共代理皆失效，系統會自動切換為**離線展示模式**（載入 `mockData.js` 的備用快取數據），保證網頁不會空白。使用者亦可點選網頁右上角「設定 (⚙️)」手動更換或新增 CORS 代理伺服器。

### 2. OSM Nominatim 逆向地理編碼限制 (Rate Limit)
* **原理**：為將災害座標轉換為詳細的中文行政區地名（如「日本沖繩縣」、「美國密西西比州」），系統串接了免費的 **OpenStreetMap Nominatim API**。
* **注意事項**：根據 OSM 官方使用政策，Nominatim API **限制每秒至多發送 1 次請求**。
* **平台應對**：
  * 系統已在 `app.js` 中實作了**間隔 1 秒的背景依序查詢**機制，避免發送過頻遭 API 封鎖。
  * 系統會將查詢成功的结果存在瀏覽器的 `localStorage` 中。第二次載入同一地點時會直接讀取快取，不會重複消耗頻寬。

### 3. Windows 平台國旗顯示限制與 Flagcdn 圖片方案
* **原理**：Windows 系統內建的字型（Segoe UI Emoji）**不支援顯示國家國旗 Emoji**，預設會呈現英文縮寫外框（如 `AU`、`TW`）。
* **平台應對**：本平台改採用 **Flagpedia (Flagcdn)** 的靜態國旗圖片進行渲染，格式為 `[國旗圖標] 洲 國名`。
* **注意事項**：同事在使用時，**電腦必須連上網路**才能載入國旗圖片與 Leaflet 地圖瓦片。若處於完全斷網的環境下，地圖與國旗圖片將無法顯示（此時會顯示文字地名）。

### 4. Google Gemini API 金鑰安全性
* **原理**：本平台支援透過 AI 進行災情深度中文摘要。
* **安全性設計**：Gemini API Key **完全由使用者個人保管，並儲存在自己瀏覽器的 LocalStorage 中**。
* **注意事項**：
  * **絕對不要**將 API Key 硬編碼（Hardcode）寫死在 `app.js` 程式碼中。
  * 程式碼上傳至 GitHub 時不含任何 API Key，因此**專案在 GitHub 上公開也是 100% 安全的**。
  * 同事開啟您部署好的網頁時，如果需要啟用 AI 翻譯功能，必須各自在右上角「設定 (⚙️)」中填入自己的 API Key。如果不填入，系統會自動使用內建的「中文規則模版引擎」進行在地化翻譯，一樣能正常運作。

### 5. GitHub Pages 部署後的 GDACS 連線障礙排除 (重要)
* **現象**：網頁在本地端雙擊開啟 (`file:///`) 時讀取 GDACS 正常，但部署在 GitHub Pages (`https://`) 上後，GDACS 連線常顯示紅色錯誤（無法下載）。
* **原因**：當網頁在 GitHub Pages 上運行時，瀏覽器會帶上 `Origin` 標頭。GDACS 伺服器的 Cloudflare 安全防護偵測到來自 GitHub 的跨域訪問時，會阻擋這些公共 CORS 代理的連線。
* **排查與解決方法**：
  * **方法 A（推薦同仁快速使用，最簡單）**：安裝瀏覽器擴充功能。
    * 請同仁在瀏覽器中安裝 **[Allow CORS: Access-Control-Allow-Origin](https://chromewebstore.google.com/detail/allow-cors-access-control/lhobafahddgcelffbjicikbagmonpehd)** 外掛。
    * 開啟 GitHub 網頁時，點選外掛圖示將其切換為 **ON**（顯示為綠色）。這樣瀏覽器將繞過跨域限制，直接存取 GDACS 伺服器，100% 避開代理阻擋，速度最快且最穩定。
  * **方法 B（建置專屬 Cloudflare Worker 代理，一勞永逸）**：
    1. 註冊免費的 [Cloudflare](https://dash.cloudflare.com/) 帳號。
    2. 建立一個 Workers 服務，並貼上以下代碼進行部署：
       ```javascript
       addEventListener('fetch', event => {
         event.respondWith(handleRequest(event.request))
       })
       async function handleRequest(request) {
         const url = new URL(request.url).searchParams.get('url')
         if (!url) return new Response('Please provide URL parameter', { status: 400 })
         let response = await fetch(url)
         let newResponse = new Response(response.body, response)
         newResponse.headers.set('Access-Control-Allow-Origin', '*')
         return newResponse
       }
       ```
    3. 部署成功後會獲得一個專屬的 Worker 網址（例如 `https://my-proxy.xxxx.workers.dev/?url=`）。
    4. 在網頁右上角「設定 (⚙️)」中，將此網址複製貼上到 **CORS 跨域代理設定** 的第一行，儲存後即永久解決 Cloudflare 封鎖問題。

---

## 🚀 執行與使用指南
本專案為純 HTML/JS 網頁，除了直接從部署好的網頁瀏覽外，亦支援下載至本地執行：
1. 下載本專案所有檔案至本機電腦中。
2. 雙擊 `index.html`，即可直接在瀏覽器中運行。
   * *註：推薦使用 **Firefox** 開啟本地 HTML 檔以獲得最佳相容性；若使用 Chrome/Edge，亦能正常發送 API 請求。*

---

## 📂 檔案結構說明
* `index.html`：系統介面結構與外觀框架（使用 CartoDB 暗黑風格地圖與 Glassmorphism 毛玻璃特效）。
* `styles.css`：整合式 CSS 樣式，包含響應式版面佈局、表格微動畫與警報呼吸燈。
* `app.js`：核心邏輯，包含資料擷取、XML/JSON 解析、OSM 逆地理編碼、中文翻譯引擎。
* `mockData.js`：離線快取/備用展示數據。
* `ncdr_logo.png`：NCDR 標誌圖檔。
