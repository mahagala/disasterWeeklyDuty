/**
 * 坡洪組國際災情值週用全球災害資訊整合平台 - Core Application Logic
 */

// --- 系統配置 ---
const CONFIG = {
  // CORS 代理列表 (會依序嘗試，直到成功為止)
  corsProxies: [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://thingproxy.freeboard.io/fetch/"
  ],
  // 災害資料來源 feeds
  feeds: {
    gdacs7d: "https://www.gdacs.org/xml/rss_7d.xml",
    gdacsEq3m: "https://www.gdacs.org/xml/rss_eq_3m.xml",
    gdacsTc3m: "https://www.gdacs.org/xml/rss_tc_3m.xml",
    gdacsFl3m: "https://www.gdacs.org/xml/rss_fl_3m.xml",
    ercc: "https://erccportal.jrc.ec.europa.eu/API/ERCC/Maps/GetLatestDailyMapRss",
    usgs: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.atom", // 擴展至過去 30 天
    reliefweb: "https://api.reliefweb.int/v1/reports?limit=150&preset=latest" // 擴展至 150 篇以覆蓋更久歷史
  },
  // 逆向地理編碼 OSM Nominatim 啟用狀態
  enableNominatim: true
};

// --- 全域變數 ---
let allDisasters = [];      // 儲存所有標準化後的災害物件
let map = null;             // Leaflet 地圖實例
let markersGroup = null;    // Leaflet 標記群組
let geocodeCache = {};      // 經緯度地理編碼快取 (減少 API 請求)
let currentFilteredDisasters = []; // 儲存目前過濾後的災害物件 (用於地理編碼增強時的表格獨立更新)
let showOriginalEnglish = false; // 是否顯示英文原文

// --- 國家代碼與名稱中英對照表 (ISO3 / 常見英文名稱) ---
const COUNTRY_MAP = {
  // ISO-3 Codes
  "TWN": "臺灣", "台灣": "臺灣", "臺灣": "臺灣", "CHN": "中國", "JPN": "日本", "KOR": "韓國", "USA": "美國",
  "PHL": "菲律賓", "VNM": "越南", "THA": "泰國", "IDN": "印尼", "MYS": "馬來西亞",
  "IND": "印度", "TUR": "土耳其", "ITA": "義大利", "TON": "東加", "RUS": "俄羅斯",
  "PER": "秘魯", "AGO": "安哥拉", "AUS": "澳洲", "NZL": "紐西蘭", "CAN": "加拿大",
  "MEX": "墨西哥", "BRA": "巴西", "CHL": "智利", "GBR": "英國", "FRA": "法國",
  "DEU": "德國", "ESP": "西班牙", "GRC": "希臘", "CYP": "塞浦路斯", "ZAF": "南非",
  "UGA": "烏干達", "COD": "剛果民主共和國", "COG": "剛果共和國", "GAB": "加彭",
  "BGD": "孟加拉", "BTN": "不丹", "MMR": "緬甸", "NPL": "尼泊爾", "PAK": "巴基斯坦",
  "ISL": "冰島", "ECU": "厄瓜多", "COL": "哥倫比亞", "PNG": "巴布亞紐幾內亞",
  "SLB": "索羅門群島", "VUT": "萬那杜", "FJI": "斐濟", "MAR": "摩洛哥",
  "UKR": "烏克蘭", "AFG": "阿富汗", "NGA": "奈及利亞", "KEN": "肯亞", 
  "SOM": "索馬利亞", "SDN": "蘇丹",
  
  // English Names (Uppercase)
  "TAIWAN": "台灣",
  "CHINA": "中國",
  "JAPAN": "日本",
  "KOREA": "韓國",
  "SOUTH KOREA": "韓國",
  "UNITED STATES": "美國",
  "PHILIPPINES": "菲律賓",
  "VIETNAM": "越南",
  "THAILAND": "泰國",
  "INDONESIA": "印尼",
  "MALAYSIA": "馬來西亞",
  "INDIA": "印度",
  "TURKEY": "土耳其",
  "TÜRKIYE": "土耳其",
  "ITALY": "義大利",
  "TONGA": "東加",
  "RUSSIA": "俄羅斯",
  "PERU": "秘魯",
  "ANGOLA": "安哥拉",
  "AUSTRALIA": "澳洲",
  "NEW ZEALAND": "紐西蘭",
  "CANADA": "加拿大",
  "MEXICO": "墨西哥",
  "BRAZIL": "巴西",
  "CHILE": "智利",
  "UNITED KINGDOM": "英國",
  "FRANCE": "法國",
  "GERMANY": "德國",
  "SPAIN": "西班牙",
  "GREECE": "希臘",
  "CYPRUS": "塞浦路斯",
  "SOUTH AFRICA": "南非",
  "UGANDA": "烏干達",
  "CONGO": "剛果共和國",
  "DR CONGO": "剛果民主共和國",
  "DEMOCRATIC REPUBLIC OF THE CONGO": "剛果民主共和國",
  "GABON": "加彭",
  "BANGLADESH": "孟加拉",
  "BHUTAN": "不丹",
  "MYANMAR": "緬甸",
  "NEPAL": "尼泊爾",
  "PAKISTAN": "巴基斯坦",
  "ICELAND": "冰島",
  "ECUADOR": "厄瓜多",
  "COLOMBIA": "哥倫比亞",
  "PAPUA NEW GUINEA": "巴布亞紐幾內亞",
  "SOLOMON ISLANDS": "索羅門群島",
  "VANUATU": "萬那杜",
  "FIJI": "斐濟",
  "MOROCCO": "摩洛哥",
  "UKRAINE": "烏克蘭",
  "AFGHANISTAN": "阿富汗",
  "NIGERIA": "奈及利亞",
  "KENYA": "肯亞",
  "SOMALIA": "索馬利亞",
  "SUDAN": "蘇丹",
  
  // Regions
  "EAST PACIFIC": "東太平洋", "WEST PACIFIC": "西太平洋", "SOUTH ASIA": "南亞",
  "EUROPE": "歐洲", "WORLD": "全球", "GLOBAL": "全球"
};

// --- 災害類別對照表 ---
const CATEGORY_MAP = {
  "EQ": { name: "地震", cssClass: "cat-earthquake" },
  "FL": { name: "淹水", cssClass: "cat-flood" },
  "TC": { name: "熱帶氣旋", cssClass: "cat-storm" },
  "DR": { name: "乾旱", cssClass: "cat-wildfire" },
  "VO": { name: "火山", cssClass: "cat-volcano" },
  "WF": { name: "野火", cssClass: "cat-wildfire" },
  "Wild fire": { name: "野火", cssClass: "cat-wildfire" },
  "Heat Wave": { name: "熱浪", cssClass: "cat-heat" },
  "Epidemic": { name: "傳染病", cssClass: "cat-epidemic" },
  "Severe Weather": { name: "強烈天氣", cssClass: "cat-storm" },
  "Tropical Cyclone": { name: "熱帶氣旋", cssClass: "cat-storm" },
  "Flood": { name: "淹水", cssClass: "cat-flood" },
  "Earthquake": { name: "地震", cssClass: "cat-earthquake" },
  "Volcano": { name: "火山", cssClass: "cat-volcano" },
  "UCPM": { name: "民防應變", cssClass: "cat-general" },
  "Resources": { name: "資源分配", cssClass: "cat-general" },
  "Drought": { name: "乾旱", cssClass: "cat-wildfire" }
};

// --- 災害排序優先級對照表 (照使用者要求優先級排列) ---
const CATEGORY_PRIORITY = {
  "TC": 1,
  "Tropical Cyclone": 1,
  "Severe Weather": 1,
  "FL": 2,
  "Flood": 2,
  "EQ": 3,
  "Earthquake": 3,
  "VO": 4,
  "Volcano": 4,
  "WF": 5,
  "Wild fire": 5,
  "Wildfire": 5,
  "DR": 6,
  "Drought": 6,
  "Heat Wave": 7,
  "Epidemic": 8,
  "UCPM": 9,
  "Resources": 10,
  "General": 11
};

// 輔助函數：以命名空間無關方式讀取 XML 節點內容，相容於不同瀏覽器的 DOMParser 解析結果
function xmlGetVal(el, localName) {
  if (!el) return null;
  // 優先嘗試使用命名空間無關的 getElementsByTagNameNS
  let nodes = el.getElementsByTagNameNS("*", localName);
  if (nodes && nodes.length > 0) return nodes[0].textContent.trim();
  
  // 嘗試直接透過 getElementsByTagName 查找
  nodes = el.getElementsByTagName(localName);
  if (nodes && nodes.length > 0) return nodes[0].textContent.trim();

  // 嘗試首字母大寫的 tag (例如 Point vs point)
  const capitalized = localName.charAt(0).toUpperCase() + localName.slice(1);
  nodes = el.getElementsByTagNameNS("*", capitalized);
  if (nodes && nodes.length > 0) return nodes[0].textContent.trim();
  
  // 嘗試使用帶有常見命名空間的 getElementsByTagName
  const nsPrefixes = ["gdacs", "geo", "georss", "ercc"];
  for (let prefix of nsPrefixes) {
    nodes = el.getElementsByTagName(`${prefix}:${localName}`);
    if (nodes && nodes.length > 0) return nodes[0].textContent.trim();
  }
  
  return null;
}

// 輔助函數：清理 ID，確保只包含英數字與底線，避開 HTML id 中特殊字元（如冒號、斜線等）引起的瀏覽器解析或錨點定位問題
function cleanId(id) {
  if (!id) return "";
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

// 輔助函數：將各來源的多樣化災害類型字串映射到標準化代碼 (EQ, FL, TC, VO, WF, DR, OTHER)
function getStandardCategoryGroup(type) {
  const info = getCategoryInfo(type);
  const name = info.name;
  if (name === "熱帶氣旋" || name === "強烈天氣") return "TC";
  if (name === "淹水") return "FL";
  if (name === "地震") return "EQ";
  if (name === "火山") return "VO";
  if (name === "野火") return "WF";
  if (name === "乾旱") return "DR";
  return "OTHER";
}

// --- 國旗對照表 ---
const FLAG_MAP = {
  "TWN": "🇹🇼", "台灣": "🇹🇼", "TAIWAN": "🇹🇼",
  "CHN": "🇨🇳", "中國": "🇨🇳", "CHINA": "🇨🇳",
  "JPN": "🇯🇵", "日本": "🇯🇵", "JAPAN": "🇯🇵",
  "KOR": "🇰🇷", "韓國": "🇰🇷", "KOREA": "🇰🇷",
  "USA": "🇺🇸", "美國": "🇺🇸", "UNITED STATES": "🇺🇸",
  "PHL": "🇵🇭", "菲律賓": "🇵🇭", "PHILIPPINES": "🇵🇭",
  "VNM": "🇻🇳", "越南": "🇻🇳", "VIETNAM": "🇻🇳",
  "THA": "🇹🇭", "泰國": "🇹🇭", "THAILAND": "🇹🇭",
  "IDN": "🇮🇩", "印尼": "🇮🇩", "INDONESIA": "🇮🇩",
  "MYS": "🇲🇾", "馬來西亞": "🇲🇾", "MALAYSIA": "🇲🇾",
  "IND": "🇮🇳", "印度": "🇮🇳", "INDIA": "🇮🇳",
  "TUR": "🇹🇷", "土耳其": "🇹🇷", "TURKEY": "🇹🇷", "TÜRKIYE": "🇹🇷",
  "ITA": "🇮🇹", "義大利": "🇮🇹", "ITALY": "🇮🇹",
  "TON": "🇹🇴", "東加": "🇹🇴", "TONGA": "🇹🇴",
  "RUS": "🇷🇺", "俄羅斯": "🇷🇺", "RUSSIA": "🇷🇺",
  "PER": "🇵🇪", "秘魯": "🇵🇪", "PERU": "🇵🇪",
  "AGO": "🇦🇴", "安哥拉": "🇦🇴", "ANGOLA": "🇦🇴",
  "AUS": "🇦🇺", "澳洲": "🇦🇺", "AUSTRALIA": "🇦🇺",
  "NZL": "🇳🇿", "紐西蘭": "🇳🇿", "NEW ZEALAND": "🇳🇿",
  "CAN": "🇨🇦", "加拿大": "🇨🇦", "CANADA": "🇨🇦",
  "MEX": "🇲🇽", "墨西哥": "🇲🇽", "MEXICO": "🇲🇽",
  "BRA": "🇧🇷", "巴西": "🇧🇷", "BRAZIL": "🇧🇷",
  "CHL": "🇨🇱", "智利": "🇨🇱", "CHILE": "🇨🇱",
  "GBR": "🇬🇧", "英國": "🇬🇧", "UNITED KINGDOM": "🇬🇧",
  "FRA": "🇫🇷", "法國": "🇫🇷", "FRANCE": "🇫🇷",
  "DEU": "🇩🇪", "德國": "🇩🇪", "GERMANY": "🇩🇪",
  "ESP": "🇪🇸", "西班牙": "🇪🇸", "SPAIN": "🇪🇸",
  "GRC": "🇬🇷", "希臘": "🇬🇷", "GREECE": "🇬🇷",
  "CYP": "🇨🇾", "塞浦路斯": "🇨🇾", "CYPRUS": "🇨🇾",
  "ZAF": "🇿🇦", "南非": "🇿🇦", "SOUTH AFRICA": "🇿🇦",
  "UGA": "🇺🇬", "烏干達": "🇺🇬", "UGANDA": "🇺🇬",
  "COD": "🇨🇩", "剛果民主共和國": "🇨🇩", "DR CONGO": "🇨🇩",
  "COG": "🇨🇬", "剛果共和國": "🇨🇬", "CONGO": "🇨🇬",
  "GAB": "🇬🇦", "加彭": "🇬🇦", "GABON": "🇬🇦",
  "BGD": "🇧🇩", "孟加拉": "🇧🇩", "BANGLADESH": "🇧🇩",
  "BTN": "🇧🇹", "不丹": "🇧🇹", "BHUTAN": "🇧🇹",
  "MMR": "🇲🇲", "緬甸": "🇲🇲", "MYANMAR": "🇲🇲",
  "NPL": "🇳🇵", "尼泊爾": "🇳🇵", "NEPAL": "🇳🇵",
  "PAK": "🇵🇰", "巴基斯坦": "🇵🇰", "PAKISTAN": "🇵🇰",
  "ISL": "🇮🇸", "冰島": "🇮🇸", "ICELAND": "🇮🇸",
  "ECU": "🇪🇨", "厄瓜多": "🇪🇨", "ECUADOR": "🇪🇨",
  "COL": "🇨🇴", "哥倫比亞": "🇨🇴", "COLOMBIA": "🇨🇴",
  "PNG": "🇵🇬", "巴布亞紐幾內亞": "🇵🇬", "PAPUA NEW GUINEA": "🇵🇬",
  "SLB": "🇸🇧", "索羅門群島": "🇸🇧", "SOLOMON ISLANDS": "🇸🇧",
  "VUT": "🇻🇺", "萬那杜": "🇻🇺", "VANUATU": "🇻🇺",
  "FJI": "🇫🇯", "斐濟": "🇫🇯", "FIJI": "🇫🇯",
  "MAR": "🇲🇦", "摩洛哥": "🇲🇦", "MOROCCO": "🇲🇦",
  "UKR": "🇺🇦", "烏克蘭": "🇺🇦", "UKRAINE": "🇺🇦",
  "AFG": "🇦🇫", "阿富汗": "🇦🇫", "AFGHANISTAN": "🇦🇫",
  "NGA": "🇳🇬", "奈及利亞": "🇳🇬", "NIGERIA": "🇳🇬",
  "KEN": "🇰🇪", "肯亞": "🇰🇪", "KENYA": "🇰🇪",
  "SOM": "🇸🇴", "索馬利亞": "🇸🇴", "SOMALIA": "🇸🇴",
  "SDN": "🇸🇩", "蘇丹": "🇸🇩", "SUDAN": "🇸🇩"
};

// --- 洲別對照表 ---
const CONTINENT_MAP = {
  // 亞洲 (Asia)
  "TWN": "亞洲", "台灣": "亞洲", "臺灣": "亞洲", "TAIWAN": "亞洲",
  "CHN": "亞洲", "中國": "亞洲", "CHINA": "亞洲",
  "JPN": "亞洲", "日本": "亞洲", "JAPAN": "亞洲",
  "KOR": "亞洲", "韓國": "亞洲", "KOREA": "亞洲",
  "PHL": "亞洲", "菲律賓": "亞洲", "PHILIPPINES": "亞洲",
  "VNM": "亞洲", "越南": "亞洲", "VIETNAM": "亞洲",
  "THA": "亞洲", "泰國": "亞洲", "THAILAND": "亞洲",
  "IDN": "亞洲", "印尼": "亞洲", "INDONESIA": "亞洲",
  "MYS": "亞洲", "馬來西亞": "亞洲", "MALAYSIA": "亞洲",
  "IND": "亞洲", "印度": "亞洲", "INDIA": "亞洲",
  "TUR": "亞洲", "土耳其": "亞洲", "TURKEY": "亞洲", "TÜRKIYE": "亞洲",
  "BGD": "亞洲", "孟加拉": "亞洲", "BANGLADESH": "亞洲",
  "BTN": "亞洲", "不丹": "亞洲", "BHUTAN": "亞洲",
  "MMR": "亞洲", "緬甸": "亞洲", "MYANMAR": "亞洲",
  "NPL": "亞洲", "尼泊爾": "亞洲", "NEPAL": "亞洲",
  "PAK": "亞洲", "巴基斯坦": "亞洲", "PAKISTAN": "亞洲",
  "AFG": "亞洲", "阿富汗": "亞洲", "AFGHANISTAN": "亞洲",

  // 歐洲 (Europe)
  "ITA": "歐洲", "義大利": "歐洲", "ITALY": "歐洲",
  "RUS": "歐洲", "俄羅斯": "歐洲", "RUSSIA": "歐洲",
  "GBR": "歐洲", "英國": "歐洲", "UNITED KINGDOM": "歐洲",
  "FRA": "歐洲", "法國": "歐洲", "FRANCE": "歐洲",
  "DEU": "歐洲", "德國": "歐洲", "GERMANY": "歐洲",
  "ESP": "歐洲", "西班牙": "歐洲", "SPAIN": "歐洲",
  "GRC": "歐洲", "希臘": "歐洲", "GREECE": "歐洲",
  "CYP": "歐洲", "塞浦路斯": "歐洲", "CYPRUS": "歐洲",
  "ISL": "歐洲", "冰島": "歐洲", "ICELAND": "歐洲",
  "UKR": "歐洲", "烏克蘭": "歐洲", "UKRAINE": "歐洲",

  // 北美洲 (North America)
  "USA": "北美洲", "美國": "北美洲", "UNITED STATES": "北美洲",
  "CAN": "北美洲", "加拿大": "北美洲", "CANADA": "北美洲",
  "MEX": "北美洲", "墨西哥": "北美洲", "MEXICO": "北美洲",

  // 南美洲 (South America)
  "PER": "南美洲", "秘魯": "南美洲", "PERU": "南美洲",
  "BRA": "南美洲", "巴西": "南美洲", "BRAZIL": "南美洲",
  "CHL": "南美洲", "智利": "南美洲", "CHILE": "南美洲",
  "ECU": "南美洲", "厄瓜多": "南美洲", "ECUADOR": "南美洲",
  "COL": "南美洲", "哥倫比亞": "南美洲", "COLOMBIA": "南美洲",

  // 非洲 (Africa)
  "AGO": "非洲", "安哥拉": "非洲", "ANGOLA": "非洲",
  "UGA": "非洲", "烏干達": "非洲", "UGANDA": "非洲",
  "COD": "非洲", "剛果民主共和國": "非洲", "DR CONGO": "非洲",
  "COG": "非洲", "剛果共和國": "非洲", "CONGO": "非洲",
  "GAB": "非洲", "加彭": "非洲", "GABON": "非洲",
  "ZAF": "非洲", "南非": "非洲", "SOUTH AFRICA": "非洲",
  "MAR": "非洲", "摩洛哥": "非洲", "MOROCCO": "非洲",
  "NGA": "非洲", "奈及利亞": "非洲", "NIGERIA": "非洲",
  "KEN": "非洲", "肯亞": "非洲", "KENYA": "非洲",
  "SOM": "非洲", "索馬利亞": "非洲", "SOMALIA": "非洲",
  "SDN": "非洲", "蘇丹": "非洲", "SUDAN": "非洲",

  // 大洋洲 (Oceania)
  "TON": "大洋洲", "東加": "大洋洲", "TONGA": "大洋洲",
  "AUS": "大洋洲", "澳洲": "大洋洲", "AUSTRALIA": "大洋洲",
  "NZL": "大洋洲", "紐西蘭": "大洋洲", "NEW ZEALAND": "大洋洲",
  "PNG": "大洋洲", "巴布亞紐幾內亞": "大洋洲", "PAPUA NEW GUINEA": "大洋洲",
  "SLB": "大洋洲", "索羅門群島": "大洋洲", "SOLOMON ISLANDS": "大洋洲",
  "VUT": "大洋洲", "萬那杜": "大洋洲", "VANUATU": "大洋洲",
  "FJI": "大洋洲", "斐濟": "大洋洲", "FIJI": "大洋洲"
};

// --- 台灣行政區偵測（解決 GDACS 誤將台灣事件標示為「中國」的問題）---
// 台灣所有縣市（繁體中文），用於比對 Nominatim 逆向地理編碼結果
const TAIWAN_CITY_NAMES = new Set([
  "臺北市", "台北市", "新北市", "桃園市", "台中市", "臺中市",
  "台南市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市",
  "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣",
  "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "臺東縣", "澎湖縣",
  "金門縣", "連江縣"
]);

/**
 * 判斷一筆 disaster 是否實際位於台灣（即使 GDACS 誤標為「中國」）
 * 依序檢查：① 中文地址 → ② 英文地址含「Taiwan」→ ③ 座標落在台灣範圍
 */
function isTaiwanLocation(d) {
  // ① 中文地址包含「臺灣」或台灣任一縣市名稱
  const zhLoc = d.chineseLocationDetail || "";
  if (zhLoc.includes("臺灣") || zhLoc.includes("台灣")) return true;
  for (const city of TAIWAN_CITY_NAMES) {
    if (zhLoc.includes(city)) return true;
  }
  // ② 英文地址包含 Taiwan
  const enLoc = (d.englishLocationDetail || "").toLowerCase();
  if (enLoc.includes("taiwan")) return true;
  // ③ 座標落在台灣地理邊界內（含離島）
  if (d.lat !== null && d.lng !== null &&
      d.lat >= 21.5 && d.lat <= 25.5 &&
      d.lng >= 119.3 && d.lng <= 122.1) return true;
  return false;
}

/**
 * 若 GDACS 將台灣事件誤標為「中國」，自動修正 d.country 為「臺灣」
 * 修改的是記憶體物件，不影響原始 RSS 資料
 */
function correctTaiwanCountry(d) {
  const raw = (d.country || "").toUpperCase();
  // 只有在標示為中國時才需要偵測
  if (raw !== "CHN" && raw !== "CHINA" && raw !== "中國") return;
  if (isTaiwanLocation(d)) {
    d.country = "臺灣";
  }
}

// --- 國家 2 位 ISO 代碼對照表 (用於 Flagcdn 載入國旗圖片) ---
const ISO2_MAP = {
  "TWN": "tw", "台灣": "tw", "臺灣": "tw", "TAIWAN": "tw",
  "CHN": "cn", "中國": "cn", "CHINA": "cn",
  "JPN": "jp", "日本": "jp", "JAPAN": "jp",
  "KOR": "kr", "韓國": "kr", "KOREA": "kr",
  "USA": "us", "美國": "us", "UNITED STATES": "us",
  "PHL": "ph", "菲律賓": "ph", "PHILIPPINES": "ph",
  "VNM": "vn", "越南": "vn", "VIETNAM": "vn",
  "THA": "th", "泰國": "th", "THAILAND": "th",
  "IDN": "id", "印尼": "id", "INDONESIA": "id",
  "MYS": "my", "馬來西亞": "my", "MALAYSIA": "my",
  "IND": "in", "印度": "in", "INDIA": "in",
  "TUR": "tr", "土耳其": "tr", "TURKEY": "tr", "TÜRKIYE": "tr",
  "ITA": "it", "義大利": "it", "ITALY": "it",
  "TON": "to", "東加": "to", "TONGA": "to",
  "RUS": "ru", "俄羅斯": "ru", "RUSSIA": "ru",
  "PER": "pe", "秘魯": "pe", "PERU": "pe",
  "AGO": "ao", "安哥拉": "ao", "ANGOLA": "ao",
  "AUS": "au", "澳洲": "au", "AUSTRALIA": "au",
  "NZL": "nz", "紐西蘭": "nz", "NEW ZEALAND": "nz",
  "CAN": "ca", "加拿大": "ca", "CANADA": "ca",
  "MEX": "mx", "墨西哥": "mx", "MEXICO": "mx",
  "BRA": "br", "巴西": "br", "BRAZIL": "br",
  "CHL": "cl", "智利": "cl", "CHILE": "cl",
  "GBR": "gb", "英國": "gb", "UNITED KINGDOM": "gb",
  "FRA": "fr", "法國": "fr", "FRANCE": "fr",
  "DEU": "de", "德國": "de", "GERMANY": "de",
  "ESP": "es", "西班牙": "es", "SPAIN": "es",
  "GRC": "gr", "希臘": "gr", "GREECE": "gr",
  "CYP": "cy", "塞浦路斯": "cy", "CYPRUS": "cy",
  "ZAF": "za", "南非": "za", "SOUTH AFRICA": "za",
  "UGA": "ug", "烏干達": "ug", "UGANDA": "ug",
  "COD": "cd", "剛果民主共和國": "cd", "DR CONGO": "cd",
  "COG": "cg", "剛果共和國": "cg", "CONGO": "cg",
  "GAB": "ga", "加彭": "ga", "GABON": "ga",
  "BGD": "bd", "孟加拉": "bd", "BANGLADESH": "bd",
  "BTN": "bt", "不丹": "bt", "BHUTAN": "bt",
  "MMR": "mm", "緬甸": "mm", "MYANMAR": "mm",
  "NPL": "np", "尼泊爾": "np", "NEPAL": "np",
  "PAK": "pk", "巴基斯坦": "pk", "PAKISTAN": "pk",
  "ISL": "is", "冰島": "is", "ICELAND": "is",
  "ECU": "ec", "厄瓜多": "ec", "ECUADOR": "ec",
  "COL": "co", "哥倫比亞": "co", "COLOMBIA": "co",
  "PNG": "pg", "巴布亞紐幾內亞": "pg", "PAPUA NEW GUINEA": "pg",
  "SLB": "sb", "索羅門群島": "sb", "SOLOMON ISLANDS": "sb",
  "VUT": "vu", "萬那杜": "vu", "VANUATU": "vu",
  "FJI": "fj", "斐濟": "fj", "FIJI": "fj",
  "MAR": "ma", "摩洛哥": "ma", "MOROCCO": "ma",
  "UKR": "ua", "烏克蘭": "ua", "UKRAINE": "ua",
  "AFG": "af", "阿富汗": "af", "AFGHANISTAN": "af",
  "NGA": "ng", "奈及利亞": "ng", "NIGERIA": "ng",
  "KEN": "ke", "肯亞": "ke", "KENYA": "ke",
  "SOM": "so", "索馬利亞": "so", "SOMALIA": "so",
  "SDN": "sd", "蘇丹": "sd", "SUDAN": "sd"
};

// 獲取 2 位國家代碼
function getCountryIso2(country) {
  if (!country) return null;
  const trimmed = country.trim().toUpperCase();
  
  if (ISO2_MAP[trimmed]) return ISO2_MAP[trimmed];
  
  const translated = translateCountry(country);
  if (ISO2_MAP[translated]) return ISO2_MAP[translated];
  
  for (let key in ISO2_MAP) {
    if (trimmed.includes(key.toUpperCase()) || translated.includes(key)) {
      return ISO2_MAP[key];
    }
  }
  
  return null;
}

// 獲取國旗圖片 HTML (解決 Windows 無法顯示國旗 emoji 的問題，支持多個國家)
function getCountryFlagImgHtml(country) {
  if (!country) return "";
  
  const separators = /[,、]|\band\b/i;
  const parts = country.split(separators).map(c => c.trim()).filter(c => c !== "");
  
  return parts.map(part => {
    const iso2 = getCountryIso2(part);
    if (iso2) {
      return `<img src="https://flagcdn.com/w20/${iso2}.png" alt="${part}" class="flag-icon" style="height: 12px; width: auto; vertical-align: middle; margin-right: 4px; border: 1px solid rgba(255,255,255,0.15); border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">`;
    }
    return "";
  }).join("");
}

// 獲取國旗 Emojis (支持多個國家)
function getCountryFlag(country) {
  if (!country) return "";
  
  const separators = /[,、]|\band\b/i;
  const parts = country.split(separators).map(c => c.trim()).filter(c => c !== "");
  
  return parts.map(part => {
    const trimmed = part.toUpperCase();
    if (FLAG_MAP[trimmed]) return FLAG_MAP[trimmed];
    
    const translated = translateCountry(part);
    if (FLAG_MAP[translated]) return FLAG_MAP[translated];
    
    for (let key in FLAG_MAP) {
      if (trimmed.includes(key.toUpperCase()) || translated.includes(key)) {
        return FLAG_MAP[key];
      }
    }
    return "";
  }).join("");
}

// 獲取國旗圖片 HTML (針對簡報圖卡優化，支援跨網域 CORS 讀取以防 Windows 系統無法顯示國旗 emoji 且能導出)
function getCountryFlagImgHtmlForSlide(country) {
  if (!country) return "";
  
  const separators = /[,、]|\band\b/i;
  const parts = country.split(separators).map(c => c.trim()).filter(c => c !== "");
  
  return parts.map(part => {
    const iso2 = getCountryIso2(part);
    if (iso2) {
      return `<img src="https://flagcdn.com/w40/${iso2}.png" alt="${part}" crossorigin="anonymous" style="height: 16px; width: auto; vertical-align: middle; border: 1px solid rgba(0,0,0,0.15); border-radius: 2px;">`;
    }
    return "";
  }).join("");
}

// 獲取國家所屬大洲
function getCountryContinent(country) {
  if (!country) return "其它地區";
  const trimmed = country.trim().toUpperCase();
  
  if (CONTINENT_MAP[trimmed]) return CONTINENT_MAP[trimmed];
  
  const translated = translateCountry(country);
  if (CONTINENT_MAP[translated]) return CONTINENT_MAP[translated];
  
  for (let key in CONTINENT_MAP) {
    if (trimmed.includes(key.toUpperCase()) || translated.includes(key)) {
      return CONTINENT_MAP[key];
    }
  }

  // 模糊關鍵字匹配
  if (trimmed.includes("EUROPE")) return "歐洲";
  if (trimmed.includes("ASIA")) return "亞洲";
  if (trimmed.includes("PACIFIC")) return "大洋洲";
  if (trimmed.includes("AFRICA")) return "非洲";
  if (trimmed.includes("AMERICA")) return "美洲";
  if (trimmed.includes("OCEAN")) return "大洋洲";
  
  return "其它地區";
}


// --- 初始化程序 ---
document.addEventListener("DOMContentLoaded", () => {
  initOpenCC();
  initClock();
  initSettings();
  initMap();
  setupEventListeners();
  loadData(); // 開始載入數據
});

// --- 即時時鐘 ---
function initClock() {
  const clockEl = document.getElementById("live-clock");
  const updateClock = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
    clockEl.textContent = `${year}-${month}-${date} ${timeStr}`;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// --- 地圖初始化 ---
function initMap() {
  // 建立地圖實例，預設中心點在蘇伊士運河附近 (全球視角)
  map = L.map('disaster-map', {
    zoomControl: true,
    minZoom: 1.5,
    maxZoom: 15,
    worldCopyJump: true
  }).setView([20, 0], 2);

  // 載入 CartoDB Dark Matter 暗色系地圖瓦片 (非常有科技感且能突出彩色標記)
  const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  });

  // 載入 Esri World Imagery 衛星影像瓦片
  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
  });

  // 預設添加衛星影像圖層
  esriSatellite.addTo(map);

  // 圖層選擇器
  const baseMaps = {
    "科技暗色 / Dark Map": darkMatter,
    "衛星影像 / Satellite": esriSatellite
  };
  
  L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);

  // 自訂「重設為全球視野」按鈕
  L.Control.ResetView = L.Control.extend({
    options: {
      position: 'topleft'
    },
    onAdd: function (mapInstance) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-reset-view');
      const button = L.DomUtil.create('a', 'leaflet-reset-view-btn', container);
      button.innerHTML = '🌐';
      button.href = '#';
      button.title = showOriginalEnglish ? 'Reset View to Global' : '重設為全球視野';
      
      L.DomEvent.on(button, 'click', function (e) {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        mapInstance.setView([20, 0], 2);
      });
      
      return container;
    }
  });
  
  new L.Control.ResetView().addTo(map);
}

// --- 設定管理 (API Key 與 CORS Proxy) ---
function initSettings() {
  const localKey = localStorage.getItem("gemini_api_key") || "";
  const localProxies = localStorage.getItem("custom_cors_proxies") || CONFIG.corsProxies.join("\n");
  const localNominatim = localStorage.getItem("enable_nominatim") !== "false";

  document.getElementById("gemini-key-input").value = localKey;
  document.getElementById("cors-proxies-input").value = localProxies;
  document.getElementById("nominatim-geocoding-chk").checked = localNominatim;

  // 更新配置記憶體
  if (localProxies) {
    CONFIG.corsProxies = localProxies.split("\n").map(p => p.trim()).filter(p => p !== "");
  }
  CONFIG.enableNominatim = localNominatim;

  // 從 LocalStorage 載入地理編碼快取
  try {
    const cachedGeocode = localStorage.getItem("geocode_cache");
    if (cachedGeocode) {
      geocodeCache = JSON.parse(cachedGeocode);
    }
  } catch (e) {
    console.error("無法加載地理編碼快取", e);
  }
}

function setupEventListeners() {
  // 開關自訂日期區間
  document.getElementById("time-range").addEventListener("change", (e) => {
    const customContainer = document.getElementById("custom-date-container");
    if (e.target.value === "custom") {
      customContainer.classList.remove("hidden");
      // 設定預設起訖日 (起: 6天前，迄: 今天，共7天包含今天)
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6);
      
      document.getElementById("start-date").value = sevenDaysAgo.toISOString().split('T')[0];
      document.getElementById("end-date").value = today.toISOString().split('T')[0];
    } else {
      customContainer.classList.add("hidden");
    }
    filterAndDisplayData();
  });

  // 篩選與更新按鈕
  document.getElementById("fetch-btn").addEventListener("click", () => {
    loadData(true); // 強制重載
  });

  // 資料來源點燈指示器點擊單獨更新
  ["gdacs", "ercc", "usgs", "reliefweb"].forEach(sourceId => {
    const el = document.getElementById(`status-${sourceId}`);
    if (el) {
      el.addEventListener("click", () => {
        reloadSingleSource(sourceId);
      });
    }
  });

  // 其他篩選器連動
  document.getElementById("alert-red-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("alert-orange-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("alert-green-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("alert-none-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-gdacs-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-ercc-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-usgs-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-reliefweb-chk").addEventListener("change", filterAndDisplayData);

  // 災害類別篩選連動
  document.getElementById("cat-tc-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("cat-fl-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("cat-eq-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("cat-vo-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("cat-wf-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("cat-dr-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("cat-other-chk").addEventListener("change", filterAndDisplayData);
  
  // 表格搜尋框
  document.getElementById("table-search").addEventListener("input", filterAndDisplayData);

  // 切換中英文原文按鈕 (同步表格上方按鈕與右下角懸浮按鈕)
  const toggleBtn = document.getElementById("toggle-translation-btn");
  const floatingToggleBtn = document.getElementById("floating-toggle-translation-btn");
  
  const handleToggleTranslation = () => {
    showOriginalEnglish = !showOriginalEnglish;
    const btnText = document.getElementById("toggle-translation-text");
    if (showOriginalEnglish) {
      if (btnText) btnText.textContent = "切換中文翻譯";
      if (toggleBtn) toggleBtn.classList.add("active");
      if (floatingToggleBtn) floatingToggleBtn.classList.add("active");
    } else {
      if (btnText) btnText.textContent = "切換英文原文";
      if (toggleBtn) toggleBtn.classList.remove("active");
      if (floatingToggleBtn) floatingToggleBtn.classList.remove("active");
    }
    renderTableOnly();
  };

  if (toggleBtn) {
    toggleBtn.addEventListener("click", handleToggleTranslation);
  }
  if (floatingToggleBtn) {
    floatingToggleBtn.addEventListener("click", handleToggleTranslation);
  }

  // 匯出 CSV 按鈕
  document.getElementById("export-csv-btn").addEventListener("click", exportToCSV);

  // 設定視窗開關
  const settingsModal = document.getElementById("settings-modal");
  document.getElementById("open-settings-btn").addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });
  document.getElementById("close-settings-btn").addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });
  document.getElementById("settings-modal").addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.add("hidden");
  });

  // 說明書視窗開關
  const helpModal = document.getElementById("help-modal");
  const openHelpBtn = document.getElementById("open-help-btn");
  if (openHelpBtn && helpModal) {
    openHelpBtn.addEventListener("click", () => {
      helpModal.classList.remove("hidden");
    });
    document.getElementById("close-help-btn").addEventListener("click", () => {
      helpModal.classList.add("hidden");
    });
    helpModal.addEventListener("click", (e) => {
      if (e.target === helpModal) helpModal.classList.add("hidden");
    });
  }

  // 詳情視窗關閉
  const detailModal = document.getElementById("detail-modal");
  document.getElementById("close-detail-btn").addEventListener("click", () => {
    detailModal.classList.add("hidden");
  });
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target === detailModal) detailModal.classList.add("hidden");
  });

  // 儲存設定
  document.getElementById("save-settings-btn").addEventListener("click", () => {
    const key = document.getElementById("gemini-key-input").value.trim();
    const proxies = document.getElementById("cors-proxies-input").value.trim();
    const nominatim = document.getElementById("nominatim-geocoding-chk").checked;

    localStorage.setItem("gemini_api_key", key);
    localStorage.setItem("custom_cors_proxies", proxies);
    localStorage.setItem("enable_nominatim", nominatim.toString());

    initSettings();
    settingsModal.classList.add("hidden");
    alert("設定已儲存！將重新整理資料顯示。");
    filterAndDisplayData();
  });

  // 重設設定
  document.getElementById("reset-settings-btn").addEventListener("click", () => {
    if (confirm("確定要恢復預設值嗎？")) {
      localStorage.removeItem("gemini_api_key");
      localStorage.removeItem("custom_cors_proxies");
      localStorage.setItem("enable_nominatim", "true");
      initSettings();
      settingsModal.classList.add("hidden");
      alert("設定已重設！");
      filterAndDisplayData();
    }
  });

  // 滾動導覽按鈕邏輯
  const scrollToTopBtn = document.getElementById("scroll-to-top-btn");
  const scrollToBottomBtn = document.getElementById("scroll-to-bottom-btn");
  
  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  }
  
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener("click", () => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
      });
    });
  }

  // 簡報圖卡生成器事件綁定
  const generateSlideBtn = document.getElementById("generate-slide-btn");
  if (generateSlideBtn) {
    generateSlideBtn.addEventListener("click", openSlideGenerator);
  }
  const closeSlideBtn = document.getElementById("close-slide-generator-btn");
  if (closeSlideBtn) {
    closeSlideBtn.addEventListener("click", () => {
      document.getElementById("slide-generator-modal").classList.add("hidden");
      window.removeEventListener("resize", resizeSlideCanvas);
    });
  }
  const downloadSlideBtn = document.getElementById("download-slide-btn");
  if (downloadSlideBtn) {
    downloadSlideBtn.addEventListener("click", downloadSlidePNG);
  }
  const copySummaryTextBtn = document.getElementById("copy-summary-text-btn");
  if (copySummaryTextBtn) {
    copySummaryTextBtn.addEventListener("click", copySummaryTextToClipboard);
  }
}

// --- 多重 CORS 代理網路抓取工具 ---
async function fetchWithProxy(url) {
  let lastError = null;
  
  // 遍歷所有 CORS 代理進行嘗試
  for (let proxy of CONFIG.corsProxies) {
    try {
      const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
      console.log(`正在透過代理抓取數據: ${proxyUrl}`);
      
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
      
      const data = await response.text();
      return data; // 成功回傳 XML/JSON 字串
    } catch (err) {
      console.warn(`代理 ${proxy} 失敗，嘗試下一個。錯誤: ${err.message}`);
      lastError = err;
    }
  }
  
  // 嘗試直接抓取 (如果本地或代理皆失效)
  try {
    console.log(`嘗試直接抓取 URL (無代理): ${url}`);
    const response = await fetch(url);
    if (response.ok) return await response.text();
  } catch (err) {
    console.error("直接抓取也失敗。");
  }

  throw lastError || new Error("無法連接至該 RSS 來源，所有 CORS 代理皆失敗。");
}

// --- 數據載入主控 ---
async function loadData(forceReload = false) {
  const fetchLoader = document.getElementById("fetch-loader");
  const fetchBtnSpan = document.querySelector("#fetch-btn span");
  const offlineBadge = document.getElementById("offline-badge");
  const syncGlobe = document.getElementById("sync-globe");

  // 顯示 Loading 動態
  fetchLoader.style.display = "inline-block";
  fetchBtnSpan.textContent = "資料同步中...";
  if (syncGlobe) {
    syncGlobe.classList.remove("hidden");
  }
  document.getElementById("disaster-table-body").innerHTML = `
    <tr>
      <td colspan="5" class="table-loading">
        <div class="spinner"></div>
        <p>正從各國際組織下載最新 RSS 資料...</p>
      </td>
    </tr>
  `;

  // 重置各組織狀態點燈
  updateSourceStatus("gdacs", "loading");
  updateSourceStatus("ercc", "loading");
  updateSourceStatus("usgs", "loading");
  updateSourceStatus("reliefweb", "loading");

  allDisasters = [];
  let successSources = 0;

  // 1. 下載 GDACS (並行下載 7天總覽, 3個月地震, 3個月熱帶氣旋, 3個月淹水)
  try {
    const gdacsFeeds = [
      CONFIG.feeds.gdacs7d,
      CONFIG.feeds.gdacsEq3m,
      CONFIG.feeds.gdacsTc3m,
      CONFIG.feeds.gdacsFl3m
    ];
    
    // 使用 Promise.allSettled 並行抓取所有 GDACS 訂閱源
    const promises = gdacsFeeds.map(url => fetchWithProxy(url).then(xml => parseGdacsRSS(xml)));
    const results = await Promise.allSettled(promises);
    
    let gdacsSuccessCount = 0;
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        allDisasters.push(...result.value);
        gdacsSuccessCount++;
      } else {
        console.warn(`GDACS 訂閱源 ${gdacsFeeds[idx]} 載入失敗:`, result.reason);
      }
    });

    if (gdacsSuccessCount > 0) {
      updateSourceStatus("gdacs", "active");
      successSources++;
    } else {
      updateSourceStatus("gdacs", "error");
    }
  } catch (err) {
    console.error("GDACS 處理發生錯誤:", err);
    updateSourceStatus("gdacs", "error");
  }

  // 2. 下載 ERCC
  try {
    const erccXml = await fetchWithProxy(CONFIG.feeds.ercc);
    const parsedErcc = parseErccRSS(erccXml);
    allDisasters.push(...parsedErcc);
    updateSourceStatus("ercc", "active");
    successSources++;
  } catch (err) {
    console.error("ERCC 載入失敗:", err);
    updateSourceStatus("ercc", "error");
  }

  // 3. 下載 USGS 地震
  try {
    const usgsAtom = await fetchWithProxy(CONFIG.feeds.usgs);
    const parsedUsgs = parseUsgsAtom(usgsAtom);
    allDisasters.push(...parsedUsgs);
    updateSourceStatus("usgs", "active");
    successSources++;
  } catch (err) {
    console.error("USGS 載入失敗:", err);
    updateSourceStatus("usgs", "error");
  }

  // 4. 下載 ReliefWeb
  try {
    const rwJsonString = await fetchWithProxy(CONFIG.feeds.reliefweb);
    const parsedRw = parseReliefWebAPI(rwJsonString);
    allDisasters.push(...parsedRw);
    updateSourceStatus("reliefweb", "active");
    successSources++;
  } catch (err) {
    console.error("ReliefWeb 載入失敗:", err);
    updateSourceStatus("reliefweb", "error");
  }

  // 對 allDisasters 進行去重 (根據 id 屬性)，防止多個訂閱源中包含重複的事件
  if (allDisasters.length > 0) {
    const uniqueMap = new Map();
    allDisasters.forEach(d => {
      if (!uniqueMap.has(d.id)) {
        uniqueMap.set(d.id, d);
      }
    });
    allDisasters = Array.from(uniqueMap.values());
  }

  // 根據座標範圍，立即修正誤標為「中國」但實際在台灣的事件（無需等待地理逆向編碼）
  allDisasters.forEach(correctTaiwanCountry);

  // 隱藏 Loading 動態
  fetchLoader.style.display = "none";
  fetchBtnSpan.textContent = "立即同步與更新";
  if (syncGlobe) {
    syncGlobe.classList.add("hidden");
  }

  // 若完全失敗，則載入本地模擬的 mockData.js 以防使用者看到空白畫面
  if (successSources === 0 && typeof mockDisasters !== "undefined") {
    console.warn("所有網路來源皆失敗，載入離線 Mock 數據。");
    allDisasters = [...mockDisasters];
    offlineBadge.classList.remove("hidden");
    
    updateSourceStatus("gdacs", "error");
    updateSourceStatus("ercc", "error");
    updateSourceStatus("usgs", "error");
    updateSourceStatus("reliefweb", "error");
  } else {
    offlineBadge.classList.add("hidden");
  }

  // 排序並過濾顯示資料
  filterAndDisplayData();
  
  // 異步啟動 OSM 逆向地理編碼以補足中文地名
  if (CONFIG.enableNominatim) {
    enrichLocationsWithGeocoding();
  }
}

// --- 點燈指示器更新 ---
function updateSourceStatus(sourceId, status) {
  const el = document.getElementById(`status-${sourceId}`);
  if (!el) return;
  el.classList.remove("active", "error");
  if (status === "active") {
    el.classList.add("active");
  } else if (status === "error") {
    el.classList.add("error");
  }
}

// 單獨重新下載某個資料來源
async function reloadSingleSource(sourceId) {
  const sourceNameMap = {
    gdacs: "GDACS",
    ercc: "ERCC",
    usgs: "USGS",
    reliefweb: "ReliefWeb"
  };
  const sourceName = sourceNameMap[sourceId];
  if (!sourceName) return;

  showToast(`正在單獨重新整理 ${sourceName} 資料...`);
  updateSourceStatus(sourceId, "loading");

  let newDisasters = [];
  let success = false;

  try {
    if (sourceId === "gdacs") {
      const gdacsFeeds = [
        CONFIG.feeds.gdacs7d,
        CONFIG.feeds.gdacsEq3m,
        CONFIG.feeds.gdacsTc3m,
        CONFIG.feeds.gdacsFl3m
      ];
      const promises = gdacsFeeds.map(url => fetchWithProxy(url).then(xml => parseGdacsRSS(xml)));
      const results = await Promise.allSettled(promises);
      
      let gdacsSuccessCount = 0;
      results.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value) {
          newDisasters.push(...result.value);
          gdacsSuccessCount++;
        }
      });
      if (gdacsSuccessCount > 0) success = true;
    } else if (sourceId === "ercc") {
      const erccXml = await fetchWithProxy(CONFIG.feeds.ercc);
      newDisasters = parseErccRSS(erccXml);
      success = true;
    } else if (sourceId === "usgs") {
      const usgsAtom = await fetchWithProxy(CONFIG.feeds.usgs);
      newDisasters = parseUsgsAtom(usgsAtom);
      success = true;
    } else if (sourceId === "reliefweb") {
      const rwJsonString = await fetchWithProxy(CONFIG.feeds.reliefweb);
      newDisasters = parseReliefWebAPI(rwJsonString);
      success = true;
    }

    if (success) {
      // 移除原有的該來源災害資料
      allDisasters = allDisasters.filter(d => d.source !== sourceName);
      
      // 加入新獲取的資料
      allDisasters.push(...newDisasters);
      
      // 去重
      const uniqueMap = new Map();
      allDisasters.forEach(d => {
        if (!uniqueMap.has(d.id)) {
          uniqueMap.set(d.id, d);
        }
      });
      allDisasters = Array.from(uniqueMap.values());

      updateSourceStatus(sourceId, "active");
      
      // 如果此時有成功的網路資料，隱藏離線標誌
      const offlineBadge = document.getElementById("offline-badge");
      if (offlineBadge) offlineBadge.classList.add("hidden");

      showToast(`${sourceName} 資料更新成功！`);
      filterAndDisplayData();
      
      if (CONFIG.enableNominatim) {
        enrichLocationsWithGeocoding();
      }
    } else {
      updateSourceStatus(sourceId, "error");
      showToast(`${sourceName} 資料更新失敗，請稍後重試。`);
    }
  } catch (err) {
    console.error(`${sourceName} 單獨重新整理失敗:`, err);
    updateSourceStatus(sourceId, "error");
    showToast(`${sourceName} 連線失敗，請檢查網路。`);
  }
}

// --- RSS/Atom/API 解析器 ---

// 1. GDACS RSS 解析
function parseGdacsRSS(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const items = xmlDoc.querySelectorAll("item");
  const results = [];

  items.forEach(item => {
    try {
      const id = xmlGetVal(item, "guid") || "";
      const title = xmlGetVal(item, "title") || "";
      const description = xmlGetVal(item, "description") || "";
      const link = xmlGetVal(item, "link") || "";
      const pubDate = xmlGetVal(item, "pubDate") || "";
      const fromdate = xmlGetVal(item, "fromdate") || "";
      const todate = xmlGetVal(item, "todate") || "";
      
      const type = xmlGetVal(item, "eventtype") || "";
      const alertlevel = xmlGetVal(item, "alertlevel") || "Green";
      const countryRaw = xmlGetVal(item, "country") || "";
      
      // 經緯度解析
      let lat = null, lng = null;
      const point = xmlGetVal(item, "point") || "";
      
      if (point) {
        const parts = point.trim().split(/\s+/);
        if (parts.length >= 2) {
          lat = parseFloat(parts[0]);
          lng = parseFloat(parts[1]);
        }
      } else {
        const latVal = xmlGetVal(item, "lat");
        const lngVal = xmlGetVal(item, "long") || xmlGetVal(item, "lng");
        if (latVal && lngVal) {
          lat = parseFloat(latVal);
          lng = parseFloat(lngVal);
        }
      }

      results.push({
        id: cleanId(id || `GDACS_${Date.now()}_${Math.random()}`),
        title,
        description,
        link,
        pubDate,
        fromdate,
        todate,
        type,
        source: "GDACS",
        lat,
        lng,
        alertlevel,
        country: countryRaw
      });
    } catch (e) {
      console.warn("解析 GDACS Item 失敗:", e);
    }
  });

  return results;
}

// 2. ERCC RSS 解析
function parseErccRSS(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const items = xmlDoc.querySelectorAll("item");
  const results = [];

  items.forEach(item => {
    try {
      const id = xmlGetVal(item, "guid") || "";
      const title = xmlGetVal(item, "title") || "";
      // 清除 html 標籤的描述
      let description = xmlGetVal(item, "description") || "";
      description = description.replace(/<\/?[^>]+(>|$)/g, "").trim();

      const link = xmlGetVal(item, "link") || "";
      const pubDate = xmlGetVal(item, "pubDate") || "";
      
      const eventTypes = xmlGetVal(item, "eventTypes") || "General";
      const countries = xmlGetVal(item, "countries") || "Europe";
      
      // 抓取第一個事件類型
      const type = eventTypes.split(",")[0].trim();

      // ERCC 無內建座標，此處給予大概的區域估計 (預設布魯塞爾，或依國家對照)
      let lat = 50.8503, lng = 4.3517; // 歐盟總部
      if (countries && countries !== "Europe") {
        const iso = countries.split(",")[0].trim();
        // 簡單查找對照
        if (iso === "COD") { lat = -4.0; lng = 21.0; }
        else if (iso === "UGA") { lat = 1.3; lng = 32.2; }
        else if (iso === "GRC") { lat = 39.07; lng = 21.82; }
        else if (iso === "CYP") { lat = 35.12; lng = 33.42; }
        else if (iso === "BGD") { lat = 23.68; lng = 90.35; }
        else if (iso === "PAK") { lat = 30.37; lng = 69.34; }
      }

      results.push({
        id: cleanId(id || `ERCC_${Date.now()}_${Math.random()}`),
        title,
        description,
        link,
        pubDate,
        type,
        source: "ERCC",
        lat,
        lng,
        alertlevel: "None",
        country: countries
      });
    } catch (e) {
      console.warn("解析 ERCC Item 失敗:", e);
    }
  });

  return results;
}

// 3. USGS Atom XML 解析
function parseUsgsAtom(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const entries = xmlDoc.querySelectorAll("entry");
  const results = [];

  entries.forEach(entry => {
    try {
      const id = xmlGetVal(entry, "id") || "";
      const title = xmlGetVal(entry, "title") || "";
      const summary = xmlGetVal(entry, "summary") || "";
      const linkNode = entry.querySelector("link");
      const link = linkNode ? linkNode.getAttribute("href") : "";
      const pubDate = entry.querySelector("updated")?.textContent || "";
      
      // 經緯度解析 georss:point
      const point = entry.querySelector("point")?.textContent || 
                    entry.querySelector("georss\\:point")?.textContent || "";
      let lat = null, lng = null;
      if (point) {
        const parts = point.trim().split(/\s+/);
        if (parts.length >= 2) {
          lat = parseFloat(parts[0]);
          lng = parseFloat(parts[1]);
        }
      }

      // 地震標題如: "M 5.2 - 10km E of ..."
      const magMatch = title.match(/M\s*([0-9.]+)/i);
      const magnitude = magMatch ? parseFloat(magMatch[1]) : 4.5;
      
      // 警報等級對照地震規模
      let alertlevel = "Green";
      if (magnitude >= 6.0) alertlevel = "Red";
      else if (magnitude >= 5.5) alertlevel = "Orange";

      results.push({
        id: cleanId(id || `USGS_${Date.now()}_${Math.random()}`),
        title,
        description: summary.replace(/<\/?[^>]+(>|$)/g, "").trim(),
        link,
        pubDate,
        type: "EQ",
        source: "USGS",
        lat,
        lng,
        alertlevel,
        country: title.split(" of ")[1] || "Global"
      });
    } catch (e) {
      console.warn("解析 USGS Entry 失敗:", e);
    }
  });

  return results;
}

// 4. ReliefWeb API JSON 解析
function parseReliefWebAPI(jsonText) {
  const results = [];
  try {
    const data = JSON.parse(jsonText);
    if (!data.data) return results;

    data.data.forEach(item => {
      const id = cleanId(`ReliefWeb_${item.id}`);
      const title = item.fields.title || "";
      const link = item.fields.url || "";
      const pubDate = item.fields.date.created || "";
      
      // 取得分類
      let type = "General";
      if (item.fields.theme && item.fields.theme.length > 0) {
        type = item.fields.theme[0].name;
      }
      
      // 取得地理資訊與國家
      let country = "Global";
      let lat = 0, lng = 0;
      if (item.fields.primary_country) {
        country = item.fields.primary_country.name;
        if (item.fields.primary_country.location) {
          lat = item.fields.primary_country.location.lat;
          lng = item.fields.primary_country.location.lon;
        }
      }

      results.push({
        id,
        title,
        description: title, // ReliefWeb API 首頁僅有標題，故簡化
        link,
        pubDate,
        type,
        source: "ReliefWeb",
        lat,
        lng,
        alertlevel: "None",
        country
      });
    });
  } catch (e) {
    console.error("解析 ReliefWeb JSON 失敗:", e);
  }
  return results;
}

// --- 經緯度格式化與逆向地理編碼 ---

// 將經緯度十進位轉換為度分秒 (DMS) 格式
function convertDecimalToDMS(deg, isLat) {
  if (deg === null || isNaN(deg)) return "";
  
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
  
  let direction = "";
  if (isLat) {
    direction = deg >= 0 ? "N" : "S";
  } else {
    direction = deg >= 0 ? "E" : "W";
  }
  
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

// --- 繁體中文簡繁轉換引擎 ---
let openccConverter = null;

// 初始化 OpenCC 轉換器 (嘗試從 window.OpenCC 取得)
function initOpenCC() {
  if (window.OpenCC && window.OpenCC.Converter) {
    try {
      openccConverter = window.OpenCC.Converter({ from: 'cn', to: 'tw' });
      console.log("OpenCC 簡繁轉換器載入成功");
    } catch (e) {
      console.error("OpenCC 轉換器初始化失敗", e);
    }
  }
}

// 內建基礎簡繁轉換對照表 (用於離線或 CDN 載入失敗時的 Fallback)
const BASIC_S2T_MAP = {
  '尔': '爾', '达': '達', '贝': '貝', '亚': '亞', '伦': '倫', '罗': '羅', '兰': '蘭', '萨': '薩',
  '维': '維', '纳': '納', '鲁': '魯', '乌': '烏', '齐': '齊', '宾': '賓', '约': '約', '叙': '敘',
  '门': '門', '几': '幾', '内': '內', '顿': '頓', '华': '華', '纽': '紐', '旧': '舊', '矶': '磯',
  '圣': '聖', '马': '馬', '诺': '諾', '时': '時', '奥': '奧', '腊': '臘', '麦': '麥', '爱': '愛',
  '岛': '島', '卢': '盧', '冈': '岡', '庄': '莊', '东': '東', '西': '西', '南': '南', '北': '北',
  '边': '邊', '湾': '灣', '桥': '橋', '园': '園', '场': '場', '厂': '廠', '库': '庫', '关': '關',
  '岭': '嶺', '峰': '峰', '气': '氣', '温': '溫', '热': '熱', '湿': '濕', '干': '乾', '灾': '災',
  '难': '難', '险': '險', '会': '會', '图': '圖', '报': '報', '响': '響', '应': '應', '队': '隊',
  '备': '備', '库': '庫', '点': '點', '线': '線', '体': '體', '动': '動', '资': '資', '数': '數',
  '据': '據', '证': '證', '视': '視', '频': '頻', '乐': '樂', '杂': '雜', '志': '誌', '态': '態',
  '变': '變', '减': '減', '员': '員', '伍': '伍', '装': '裝', '发': '發', '与': '與', '产': '產',
  '业': '業', '无': '無', '专': '專', '阶': '階', '级': '級', '铁': '鐵', '开': '開', '连': '連',
  '结': '結', '调': '調', '查': '查', '办': '辦', '公': '公', '务': '務', '计': '計', '算': '算',
  '机': '機', '脑': '腦', '网': '網', '络': '絡', '通': '通', '传': '傳', '输': '輸', '导': '導',
  '航': '航', '卫': '衛', '星': '星', '间': '間', '面': '面', '测': '測', '绘': '繪', '格': '格',
  '栏': '欄', '标': '標', '题': '題', '容': '容', '详': '詳', '细': '細', '简': '簡', '说': '說',
  '明': '明', '注': '注', '释': '釋', '参': '參', '考': '考', '献': '獻', '链': '鏈', '接': '接',
  '址': '址', '联': '聯', '系': '系', '统': '統', '平': '平', '台': '台', '功': '功', '能': '能',
  '设': '設', '置': '置', '控': '控', '制': '制', '板': '板', '过': '過', '滤': '濾', '选': '選',
  '择': '擇', '讫': '訖', '量': '量', '总': '總', '划': '劃', '邦': '邦', '都': '都', '府': '府',
  '里': '里', '克': '克', '圭': '圭', '瓜': '瓜', '多': '多', '那': '那', '玻': '玻', '利': '利',
  '秘': '秘', '智': '智', '廷': '廷', '极': '極', '洲': '洲', '洋': '洋', '区': '區', '县': '縣',
  '镇': '鎮', '乡': '鄉', '省': '省', '市': '市', '州': '州'
};

// 簡體字轉正體繁體字
function translateSimplifiedToTraditional(str) {
  if (!str) return "";
  
  // 1. 如果 OpenCC 載入成功，使用 OpenCC 進行專業轉換
  if (openccConverter) {
    return openccConverter(str);
  }
  
  // 2. Fallback: 使用內建字典進行字元替換
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    result += BASIC_S2T_MAP[char] || char;
  }
  return result;
}

// 動態呼叫 OSM Nominatim 取得詳細地名 (含簡繁轉換、中英對照、節流與快取)
async function enrichLocationsWithGeocoding() {
  const itemsToGeocode = allDisasters.filter(d => d.lat !== null && d.lng !== null && !d.chineseLocationDetail);
  if (itemsToGeocode.length === 0) return;

  console.log(`開始進行地理逆向編碼，共 ${itemsToGeocode.length} 筆資料...`);
  
  for (let i = 0; i < itemsToGeocode.length; i++) {
    const item = itemsToGeocode[i];
    const cacheKey = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
    
    // 檢查快取
    const cachedVal = geocodeCache[cacheKey];
    if (cachedVal) {
      if (typeof cachedVal === "string") {
        // 升級舊的字串快取
        item.chineseLocationDetail = translateSimplifiedToTraditional(cachedVal);
        item.englishLocationDetail = cachedVal;
      } else {
        item.chineseLocationDetail = translateSimplifiedToTraditional(cachedVal.zh);
        item.englishLocationDetail = cachedVal.en;
      }
      // 以地理編碼結果再次確認是否為台灣（補足座標偵測未能辨識的情況）
      correctTaiwanCountry(item);
      continue;
    }

    // 遵守 Nominatim API 政策：每秒至多 1 次請求
    await new Promise(resolve => setTimeout(resolve, 1000));

    let formattedLocZh = "";
    let formattedLocEn = "";

    // 1. 查詢中文 (zh-TW)
    try {
      const urlZh = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${item.lat}&lon=${item.lng}&zoom=8&accept-language=zh-TW`;
      const responseZh = await fetch(urlZh, {
        headers: {
          'User-Agent': 'DisasterReportHub/1.0 (johnson@gemini.local)'
        }
      });
      if (responseZh.ok) {
        const dataZh = await responseZh.json();
        if (dataZh.address) {
          const addr = dataZh.address;
          const county = addr.county || addr.city || addr.state || "";
          const region = addr.suburb || addr.town || addr.village || "";
          if (county) formattedLocZh += county;
          if (region) formattedLocZh += " " + region;
          formattedLocZh = formattedLocZh.trim();
        }
      }
    } catch (e) {
      console.warn("地理中文逆編碼失敗:", e);
    }

    // 2. 為了在切換英文模式時也能顯示英文地名，多發送一次 en 請求
    await new Promise(resolve => setTimeout(resolve, 1000)); // 遵守 rate limit

    try {
      const urlEn = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${item.lat}&lon=${item.lng}&zoom=8&accept-language=en`;
      const responseEn = await fetch(urlEn, {
        headers: {
          'User-Agent': 'DisasterReportHub/1.0 (johnson@gemini.local)'
        }
      });
      if (responseEn.ok) {
        const dataEn = await responseEn.json();
        if (dataEn.address) {
          const addr = dataEn.address;
          const county = addr.county || addr.city || addr.state || "";
          const region = addr.suburb || addr.town || addr.village || "";
          if (county) formattedLocEn += county;
          if (region) formattedLocEn += " " + region;
          formattedLocEn = formattedLocEn.trim();
        }
      }
    } catch (e) {
      console.warn("地理英文逆編碼失敗:", e);
    }

    // 3. 儲存快取與更新欄位
    if (formattedLocZh || formattedLocEn) {
      const cacheVal = {
        zh: translateSimplifiedToTraditional(formattedLocZh || formattedLocEn),
        en: formattedLocEn || formattedLocZh
      };
      geocodeCache[cacheKey] = cacheVal;
      item.chineseLocationDetail = cacheVal.zh;
      item.englishLocationDetail = cacheVal.en;
      // 以地理編碼結果確認是否為台灣（最精確的時機）
      correctTaiwanCountry(item);
      
      // 寫入快取 LocalStorage
      localStorage.setItem("geocode_cache", JSON.stringify(geocodeCache));
      
      // 每次成功解析就小幅度重新整理表格，增加流暢度
      renderTableOnly();
    }
  }
}

// --- 中文翻譯規則引擎 (內建字典與範本解析) ---

// 國家名稱翻譯
function translateCountry(rawCountry) {
  if (!rawCountry) return "未知地點";
  const trimmed = rawCountry.trim().toUpperCase();
  
  // 1. 直接查表對照
  if (COUNTRY_MAP[trimmed]) return COUNTRY_MAP[trimmed];
  
  // 2. 對於包含逗號等多國列表，分開處理
  if (trimmed.includes(",")) {
    return trimmed.split(",")
                  .map(c => translateCountry(c))
                  .join("、");
  }

  // 3. 常規模糊配對 (使用獨立單字邊界，避免 "Indonesia" 因包含 "IND" 誤判為 "印度")
  for (let key in COUNTRY_MAP) {
    const regex = new RegExp('\\b' + key + '\\b', 'i');
    if (regex.test(trimmed)) {
      return COUNTRY_MAP[key];
    }
  }

  return rawCountry.trim(); // 找不到則回傳英文原名
}

// 類別翻譯
function getCategoryInfo(rawType) {
  const typeKey = rawType ? rawType.trim() : "General";
  return CATEGORY_MAP[typeKey] || { name: rawType || "其它災害", cssClass: "cat-general" };
}

// 災害說明繁體中文模組 (根據不同組織與欄位做中文化格式化)
function generateChineseDescription(disaster) {
  const dateStr = formatDate(disaster.pubDate);
  const countryCn = translateCountry(disaster.country);
  const catName = getCategoryInfo(disaster.type).name;

  // ── 輔助：取警報等級的中文字串 ──
  function alertCn(level) {
    if (level === "Red") return "紅色警戒";
    if (level === "Orange") return "橙色警戒";
    if (level === "Green") return "綠色警報";
    return "";
  }
  const alertLevel = disaster.alertlevel && disaster.alertlevel !== "None" ? alertCn(disaster.alertlevel) : "";

  // 1. 如果是 GDACS，進行範本規則剖析
  if (disaster.source === "GDACS") {
    const desc = disaster.description || "";
    const title = disaster.title || "";

    // ── 地震（EQ）──
    if (disaster.type === "EQ") {
      const magMatch  = desc.match(/Magnitude[\s:]+([0-9.]+M?)/i) || title.match(/M\s*([0-9.]+)/i);
      const depthMatch = desc.match(/Depth[:\s]+([0-9.]+\s*km)/i);
      const popMatch  = desc.match(/potentially affecting\s*([0-9.,\w\s]+?)\s*(?:people\s*in|in\s*the)/i)
                     || desc.match(/potentially affecting\s*([0-9.,\w\s]+?)\s*in/i);
      const deathMatch  = desc.match(/(\d+)\s*deaths?\s*(?:reported|confirmed|have been)/i)
                       || desc.match(/deaths?[:\s]+(\d+)/i)
                       || desc.match(/caused?\s*(\d+)\s*deaths?/i);
      const injuryMatch = desc.match(/(\d+)\s*injur(?:ed|ies)/i)
                       || desc.match(/injur(?:ed|ies)[:\s]+(\d+)/i);
      const tsunamiMatch = desc.match(/[Tt]sunami\s*(?:alert|warning)?[:\s]*(\w+)/i);
      // 震央位置：「45km NE of Istanbul」
      const locMatch = title.match(/(\d+)\s*km\s*([NSEW]+)\s*of\s*([^,]+)/i)
                    || desc.match(/(\d+)\s*km\s*([NSEW]+)\s*of\s*([^,\.]+)/i);

      const mag    = magMatch   ? magMatch[1]   : "未知規模";
      const depth  = depthMatch ? depthMatch[1].trim() : "未知深度";
      const pop    = popMatch   ? translatePopText(popMatch[1].trim()) : null;
      const deaths = deathMatch ? parseInt(deathMatch[1]) : 0;
      const injuries = injuryMatch ? parseInt(injuryMatch[1]) : 0;
      const tsunamiYes = tsunamiMatch && !/^no$/i.test(tsunamiMatch[1]);

      // 方位英翻中
      const dirMap = { N:"北",S:"南",E:"東",W:"西",NE:"東北",NW:"西北",SE:"東南",SW:"西南",
                       NNE:"北北東",NNW:"北北西",SSE:"南南東",SSW:"南南西",
                       ENE:"東北東",ESE:"東南東",WNW:"西北西",WSW:"西南西" };
      let locStr = "";
      if (locMatch) {
        const dir = dirMap[locMatch[2].toUpperCase()] || locMatch[2];
        locStr = `，震央位於${locMatch[3].trim()}${dir}方向 ${locMatch[1]} 公里處`;
      }

      let casualtyStr = "";
      if (deaths > 0 && injuries > 0) casualtyStr = `，通報 ${deaths} 人死亡、${injuries} 人受傷`;
      else if (deaths > 0) casualtyStr = `，通報 ${deaths} 人死亡`;
      else if (injuries > 0) casualtyStr = `，通報 ${injuries} 人受傷`;

      const tsunamiStr = tsunamiYes ? "，並已發布海嘯警報，沿海居民請立即撤離" : "";
      const popStr     = pop ? `，預計 100 公里半徑內約 ${pop} 受到潛在影響` : "";
      const alertStr   = alertLevel ? `（${alertLevel}）` : "";

      return `${dateStr}，${countryCn}發生芮氏規模 ${mag} 地震${alertStr}，震源深度 ${depth}${locStr}${popStr}${casualtyStr}${tsunamiStr}。`;
    }

    // ── 洪水（FL）──
    if (disaster.type === "FL") {
      const deathMatch  = desc.match(/caused\s*(\d+)\s*deaths/i)
                       || desc.match(/(\d+)\s*deaths?\s*(?:reported|confirmed)/i)
                       || desc.match(/deaths?[:\s]+(\d+)/i);
      const dispMatch   = desc.match(/([0-9,]+)\s*displaced/i)
                       || desc.match(/displaced[:\s]+([0-9,]+)/i);
      const injuryMatch = desc.match(/(\d+)\s*injur(?:ed|ies)/i);
      const affMatch    = desc.match(/potentially affecting\s*([0-9.,\w\s]+?)\s*(?:people|in)/i)
                       || desc.match(/affected\s*population[:\s]+([0-9.,\w\s]+)/i);
      const homelessMatch = desc.match(/([0-9,]+)\s*(?:homeless|houses?\s*(?:damaged|destroyed))/i);
      const regionMatch = desc.match(/(?:in|affecting)\s+([A-Z][a-z]+(?:[,\s]+and\s+[A-Z][a-z]+)*)\s+(?:states?|provinces?|regions?|districts?)/i);

      const deaths   = deathMatch  ? deathMatch[1]  : "0";
      const disp     = dispMatch   ? dispMatch[1].replace(/,/g, "")   : null;
      const injuries = injuryMatch ? injuryMatch[1] : null;
      const affected = affMatch    ? translatePopText(affMatch[1].trim()) : null;
      const homeless = homelessMatch ? homelessMatch[1].replace(/,/g, "") : null;
      const regionStr = regionMatch ? `（${regionMatch[1]}等地）` : "";
      const alertStr  = alertLevel ? `（${alertLevel}）` : "";

      const stats = [];
      if (parseInt(deaths) > 0) stats.push(`${deaths} 人死亡`);
      if (injuries) stats.push(`${injuries} 人受傷`);
      if (disp)     stats.push(`${disp} 人流離撤離`);
      if (homeless) stats.push(`${homeless} 棟建築受損或摧毀`);
      if (affected) stats.push(`受影響人口約 ${affected}`);

      const base = `自 ${dateStr} 起，${countryCn}${regionStr}爆發嚴重淹水災害${alertStr}`;
      if (stats.length > 0) return `${base}。截至最新通報：${stats.join("、")}。`;
      return `${base}，災情持續蔓延，當局正積極應對中。`;
    }

    // ── 熱帶氣旋（TC）──
    if (disaster.type === "TC") {
      const windMatch = desc.match(/maximum wind speed of\s*(\d+\s*km\/h)/i);
      const gustMatch = desc.match(/gusts?\s*(?:of|up to)?\s*(\d+\s*km\/h)/i);
      const popMatch  = desc.match(/potentially affecting\s*([0-9.,\w\s]+?)\s*(?:people|in)/i)
                     || desc.match(/affected\s*population[:\s]+([0-9.,\w\s]+)/i);
      const nameMatch = title.match(/tropical\s*cyclone\s*([\w\d\-]+)/i)
                     || title.match(/typhoon\s*([\w\d\-]+)/i)
                     || title.match(/hurricane\s*([\w\d\-]+)/i)
                     || title.match(/cyclone\s*([\w\d\-]+)/i);
      const surgeMatch    = /storm\s*surge/i.test(desc);
      const landfallMatch = /landfall/i.test(desc);

      const nameStr = nameMatch ? `「${nameMatch[1].toUpperCase()}」` : "";
      const wind    = windMatch ? windMatch[1] : null;
      const gusts   = gustMatch ? gustMatch[1] : null;
      const pop     = popMatch  ? translatePopText(popMatch[1].trim()) : null;

      const windStr  = wind && gusts ? `最大風速 ${wind}、陣風達 ${gusts}` : wind ? `最大風速 ${wind}` : "";
      const popStr   = pop ? `，估計受影響人口達 ${pop}` : "";
      const alertStr = alertLevel ? `，目前警報等級為${alertLevel}` : "";
      const extraParts = [];
      if (surgeMatch)    extraParts.push("具風暴潮威脅");
      if (landfallMatch) extraParts.push("預計或已登陸");
      const extraStr = extraParts.length > 0 ? `，${extraParts.join("，")}` : "";

      return `監測顯示，${dateStr} 期間熱帶氣旋/颱風 ${nameStr}持續活躍${windStr ? `（${windStr}）` : ""}，正波及${countryCn}等鄰近地區${popStr}${alertStr}${extraStr}，請密切注意風雨動態。`;
    }

    // ── 乾旱（DR）──
    if (disaster.type === "DR") {
      const sevMatch = desc.match(/severity\s*(?:value|level)?[:\s]+([0-9.]+)/i)
                    || desc.match(/level\s*is\s*(\w+)/i);
      const popMatch = desc.match(/potentially affecting\s*([0-9.,\w\s]+?)\s*(?:people|in)/i)
                    || desc.match(/affected\s*(?:population)?[:\s]+([0-9.,\w\s]+)/i);

      const sev = sevMatch ? `乾旱嚴重程度指數：${sevMatch[1]}` : null;
      const pop = popMatch ? translatePopText(popMatch[1].trim()) : null;
      const alertStr = alertLevel ? `警報等級為${alertLevel}` : "警報發布中";

      const parts = [`目前${countryCn}部分地區正遭遇持續乾旱危機，農業生產與水資源供應受到嚴重衝擊，${alertStr}`];
      if (sev) parts.push(sev);
      if (pop) parts.push(`受影響人口估計達 ${pop}`);
      return parts.join("；") + "。";
    }

    // ── 野火（WF / FF）── （新增範本）
    if (disaster.type === "WF" || disaster.type === "FF") {
      const areaMatch    = desc.match(/([0-9,]+)\s*(?:hectares?|ha\b)/i)
                        || desc.match(/burned\s*area[:\s]+([0-9,]+)/i);
      const evacMatch    = desc.match(/([0-9,]+)\s*people\s*(?:evacuated|ordered\s*to\s*evacuate|displaced)/i)
                        || desc.match(/evacuat\w*\s*(?:of\s*|order\s*for\s*)?([0-9,]+)/i);
      const popMatch     = desc.match(/potentially affecting\s*([0-9.,\w\s]+?)\s*(?:people|in)/i);
      const containMatch = desc.match(/(\d+)\s*%\s*contained/i);
      const homesMatch   = desc.match(/([0-9,]+)\s*(?:homes?|structures?|buildings?)\s*(?:damaged|destroyed)/i);

      const area    = areaMatch    ? areaMatch[1].replace(/,/g, "")    : null;
      const evac    = evacMatch    ? evacMatch[1].replace(/,/g, "")    : null;
      const pop     = popMatch     ? translatePopText(popMatch[1].trim()) : null;
      const contain = containMatch ? containMatch[1] : null;
      const homes   = homesMatch   ? homesMatch[1].replace(/,/g, "")  : null;
      const alertStr = alertLevel ? `（${alertLevel}）` : "";

      const stats = [];
      if (area)    stats.push(`過火面積約 ${area} 公頃`);
      if (evac)    stats.push(`${evac} 人接獲撤離命令`);
      if (homes)   stats.push(`${homes} 棟建築受損或摧毀`);
      if (pop)     stats.push(`受威脅人口約 ${pop}`);
      if (contain) stats.push(`火勢控制率 ${contain}%`);

      const base = `${dateStr}，${countryCn}爆發野火${alertStr}`;
      if (stats.length > 0) return `${base}；${stats.join("、")}。`;
      return `${base}，火情持續蔓延，請關注最新疏散資訊。`;
    }

    // ── 火山（VO）── （新增範本）
    if (disaster.type === "VO") {
      const veiMatch  = desc.match(/VEI[:\s]+(\d+)/i)
                     || desc.match(/explosivity\s*index[:\s]+(\d+)/i);
      const ashMatch  = desc.match(/ash\s*(?:cloud\s*|plume\s*)?(?:height|column)[:\s]+([0-9,]+\s*(?:m|km|ft))/i)
                     || desc.match(/ash\s*(?:at|up to|reaching)\s+([0-9,]+\s*(?:m|km|ft))/i);
      const evacMatch = desc.match(/([0-9,]+)\s*people\s*(?:evacuated|displaced)/i)
                     || desc.match(/evacuat\w*[:\s]+([0-9,]+)/i);
      const lavaMatch   = /lava\s*flow/i.test(desc);
      const tsunamiMatch = /tsunami/i.test(desc);
      const volcanMatch = title.match(/([A-Z][a-zA-Z]+)\s*(?:volcano|eruption)/i)
                       || title.match(/volcano\s+(?:in\s+)?([A-Z][a-zA-Z\s]+?)(?:\s*[-,]|\s+in\b)/i);

      const vei  = veiMatch  ? veiMatch[1]  : null;
      const ash  = ashMatch  ? ashMatch[1]  : null;
      const evac = evacMatch ? evacMatch[1].replace(/,/g, "") : null;
      const volcanStr = volcanMatch ? `（${volcanMatch[1]}火山）` : "";
      const alertStr  = alertLevel ? `，警報等級為${alertLevel}` : "";

      const stats = [];
      if (vei)  stats.push(`火山爆發指數 (VEI) ${vei}`);
      if (ash)  stats.push(`火山灰柱高度達 ${ash}`);
      if (evac) stats.push(`${evac} 人已撤離`);
      if (lavaMatch)   stats.push("伴有熔岩流");
      if (tsunamiMatch) stats.push("具海嘯威脅，沿岸請注意");

      const base = `${dateStr}，${countryCn}發生火山噴發活動${volcanStr}${alertStr}`;
      if (stats.length > 0) return `${base}；${stats.join("、")}。`;
      return `${base}，請密切關注當局發布之安全警示。`;
    }
  }

  // 2. 如果是 ERCC (一般地圖說明)
  if (disaster.source === "ERCC") {
    const desc  = disaster.description || "";
    const title = disaster.title || "";

    // ERCC description 常為 "Region | Event Type"
    if (desc.includes("|")) {
      const parts = desc.split("|").map(p => p.trim());
      const region = translateCountry(parts[0]);
      const event  = translateEventEnglishToCn(parts[1]);
      // 嘗試從標題額外取得更完整的事件說明
      const titleEventMatch = title.match(/[-–]\s*(.+)$/);
      const eventLabel = titleEventMatch
        ? translateEventEnglishToCn(titleEventMatch[1].trim())
        : event;
      return `歐盟緊急應變協調中心 (ERCC) 發布最新形勢地圖：${region}近期受到【${eventLabel}】影響，歐盟已啟動跨境人道應變與民防資訊整合機制，持續動態監測中。`;
    }

    // 有標題但無 | 分隔符
    if (title) {
      const eventMatch = title.match(/[-–]\s*(.+)$/);
      const eventStr   = eventMatch ? translateEventEnglishToCn(eventMatch[1].trim()) : (desc || title);
      return `歐盟緊急應變協調中心 (ERCC) 每日監測簡報：${countryCn}近期發生【${eventStr}】事件，歐盟持續協調各成員國進行人道救援與民防應對工作。`;
    }
    return `歐盟應急中心發布最新監測地圖：${desc}。此資訊與歐盟人道救援、民防應變及防範災害後續衝擊相關。`;
  }

  // 3. 如果是 USGS 地震
  if (disaster.source === "USGS") {
    const title = disaster.title || "";
    const desc  = disaster.description || "";

    // title format: "M 5.8 - 45km W of Petropavlovsk-Kamchatsky, Russia"
    const magMatch   = title.match(/M\s*([0-9.]+)/i);
    const locParts   = title.split(" - ");
    const locStr     = locParts.length > 1 ? locParts[1].trim() : "全球震區";
    const depthMatch = desc.match(/Depth[:\s]+([0-9.]+\s*(?:km|kilometers?))/i);

    const magNum = magMatch ? parseFloat(magMatch[1]) : 4.5;
    let intensityStr = "有感地震";
    if      (magNum >= 7.0) intensityStr = "強烈大地震";
    else if (magNum >= 6.0) intensityStr = "強震";
    else if (magNum >= 5.0) intensityStr = "中強震";

    const depthStr = depthMatch ? `，震源深度 ${depthMatch[1]}` : "";
    const alertStr = alertLevel ? `，${alertLevel}` : "";

    return `${dateStr}，USGS 地震監測網偵測到${countryCn}（${locStr}）發生芮氏規模 ${magNum.toFixed(1)} ${intensityStr}${depthStr}${alertStr}。`;
  }

  // 4. 如果是 ReliefWeb
  if (disaster.source === "ReliefWeb") {
    const title = disaster.title || "";

    // 從標題解析報告類型和聯合國機構縮寫
    const reportTypeMatch = title.match(/Situation\s*Report|Flash\s*Update|Emergency\s*Appeal|Humanitarian\s*Update|Crisis\s*Update|Response\s*Plan|Fact\s*Sheet|Assessment/i);
    const orgMatch        = title.match(/\b(OCHA|UNHCR|UNICEF|WFP|IFRC|MSF|WHO|FAO|IOM|UNDP|IRC|NRC|CARE|ACF)\b/i);

    const reportType = reportTypeMatch ? translateReliefWebReportType(reportTypeMatch[0]) : "情勢報告";
    const org        = orgMatch ? orgMatch[0].toUpperCase() : "聯合國人道機構";
    const alertStr   = alertLevel ? `（${alertLevel}）` : "";

    return `聯合國 ReliefWeb 發布最新${reportType}（${org}）：${countryCn}${catName}危機${alertStr}持續演變，詳情請參閱官方報告連結取得完整評估資訊。`;
  }

  // 5. 萬用備用翻譯 (如果完全無法套用範本，則簡單套入並翻譯)
  return `${dateStr}，於${countryCn}發生${catName}事件。英文原標題：${disaster.title}`;
}

// 輔助翻譯：人口數量級翻譯
function translatePopText(englishPop) {
  if (!englishPop) return "少數居民";
  let text = englishPop.toLowerCase();
  text = text.replace("thousand", "千人");
  text = text.replace("million", "百萬人");
  text = text.replace("few people affected", "少數人受影響");
  text = text.replace("no people affected", "無人受波及");
  return text.trim();
}

// 輔助翻譯：ReliefWeb 報告類型英翻中
function translateReliefWebReportType(engType) {
  if (!engType) return "情勢報告";
  const t = engType.toLowerCase();
  if (t.includes("situation report"))    return "形勢報告";
  if (t.includes("flash update"))        return "緊急快報";
  if (t.includes("emergency appeal"))    return "緊急援助呼籲";
  if (t.includes("humanitarian update")) return "人道情勢更新";
  if (t.includes("crisis update"))       return "危機情勢更新";
  if (t.includes("response plan"))       return "應對計畫";
  if (t.includes("fact sheet"))          return "事實摘要";
  if (t.includes("assessment"))          return "形勢評估";
  return engType;
}

// 輔助翻譯：一般事件名英翻中
function translateEventEnglishToCn(evtEng) {
  if (!evtEng) return "";
  const dict = {
    "Recent heatwave": "近期熱浪",
    "Heatwave": "熱浪",
    "Extreme heat": "極端高溫",
    "Wildfires": "野火",
    "Wildfire": "野火",
    "Wild fire": "野火",
    "Forest fire": "森林火災",
    "Forest Firefighting": "森林消防準備",
    "Monsoon season": "季風雨季",
    "Monsoon flooding": "季風洪水",
    "Ebola": "伊波拉病毒疫情",
    "Epidemic": "傳染病爆發",
    "Cholera": "霍亂疫情",
    "Drought": "乾旱",
    "Flood": "淹水",
    "Flooding": "洪水氾濫",
    "Flash flood": "閃洪",
    "Tropical Cyclone": "熱帶氣旋",
    "Tropical storm": "熱帶風暴",
    "Typhoon": "颱風",
    "Hurricane": "颶風",
    "Earthquake": "地震",
    "Tsunami": "海嘯",
    "Volcanic activity": "火山活動",
    "Eruption": "火山噴發",
    "Landslide": "山崩/土石流",
    "Refugee crisis": "難民危機",
    "Conflict": "武裝衝突",
    "Food insecurity": "糧食不安全",
    "Food crisis": "糧食危機"
  };
  // 精確比對（不分大小寫）
  const key = Object.keys(dict).find(k => k.toLowerCase() === evtEng.toLowerCase());
  if (key) return dict[key];
  // 包含模糊比對
  const partialKey = Object.keys(dict).find(k => evtEng.toLowerCase().includes(k.toLowerCase()));
  if (partialKey) return dict[partialKey];
  return evtEng;
}

// 格式化日期字串 (將 Wed, 03 Jun 2026 22:23:39 GMT 轉成 06/03)
function formatDate(dateString) {
  if (!dateString) return "--/--";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "--/--";
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  } catch (e) {
    return "--/--";
  }
}

// 格式化日期範圍，如果有起訖日則顯示範圍 (如 05/31 ~ 06/03)，否則顯示單日
function formatDateRange(fromStr, toStr, pubStr) {
  if (!fromStr && !toStr) {
    return formatDate(pubStr);
  }
  
  const fromFormatted = fromStr ? formatDate(fromStr) : "--/--";
  const toFormatted = toStr ? formatDate(toStr) : "--/--";
  
  if (fromFormatted === "--/--" && toFormatted === "--/--") {
    return formatDate(pubStr);
  }
  if (fromFormatted === "--/--") return toFormatted;
  if (toFormatted === "--/--") return fromFormatted;
  
  if (fromFormatted === toFormatted) {
    return fromFormatted;
  }
  
  return `${fromFormatted} ~ ${toFormatted}`;
}

// --- 雙向文獻檢索連結生成 (Search Grounding & Official Link) ---
// 輔助函數：將分類對照回適合搜尋的英文關鍵字
function getCategoryEnglishKeyword(type) {
  const info = getCategoryInfo(type);
  const name = info.name;
  if (name === "熱帶氣旋" || name === "強烈天氣") return "cyclone OR storm OR typhoon OR hurricane";
  if (name === "淹水") return "flood OR flooding";
  if (name === "地震") return "earthquake";
  if (name === "火山") return "volcano OR eruption";
  if (name === "野火") return "wildfire OR forest fire";
  if (name === "乾旱") return "drought";
  return type || "disaster";
}

// 輔助函數：將分類對照回適合搜尋的英文單數名稱 (用於連結標題)
function getCategoryEnglishSingular(type) {
  const info = getCategoryInfo(type);
  const name = info.name;
  if (name === "熱帶氣旋" || name === "強烈天氣") return "Storm";
  if (name === "淹水") return "Flood";
  if (name === "地震") return "Earthquake";
  if (name === "火山") return "Volcano";
  if (name === "野火") return "Wildfire";
  if (name === "乾旱") return "Drought";
  return "Disaster";
}

function generateReferenceLinks(disaster) {
  const links = [];
  
  // 1. 官方原始連結
  let officialTitle = "官方報告";
  if (disaster.source === "GDACS") officialTitle = "GDACS 詳細數據報告";
  else if (disaster.source === "ERCC") officialTitle = "ERCC 官方形勢圖下載";
  else if (disaster.source === "USGS") officialTitle = "USGS 地震詳細網頁";
  else if (disaster.source === "ReliefWeb") officialTitle = "ReliefWeb 全文報告";

  links.push({
    title: officialTitle,
    url: disaster.link
  });

  // 2. 自動生成相關的第三方與即時新聞檢索連結 (解決無 Gemini API 搜尋之痛點)
  const countryCn = translateCountry(disaster.country);
  const countryEn = disaster.country || "";
  const typeInfo = getCategoryInfo(disaster.type);
  const catCn = typeInfo.name;
  const catEn = getCategoryEnglishKeyword(disaster.type);
  const catEnSingular = getCategoryEnglishSingular(disaster.type);

  // 中文查詢：國家中文名 + 災害中文名 + 當前年份
  const queryCn = encodeURIComponent(`${countryCn} ${catCn} 2026`);
  // 英文查詢：國家英文名 + 災害英文關鍵字組 + 當前年份
  const queryEn = encodeURIComponent(`${countryEn} (${catEn}) 2026`);

  // Google News 中文即時搜尋連結
  links.push({
    title: `Google 新聞 (${typeInfo.name})`,
    url: `https://news.google.com/search?q=${queryCn}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
  });

  // Google News 英文即時搜尋連結
  links.push({
    title: `Google News (${catEnSingular})`,
    url: `https://news.google.com/search?q=${queryEn}&hl=en-US&gl=US&ceid=US:en`
  });

  // Watchers.news 即時科學/災害新聞
  const watchersQuery = encodeURIComponent(`${disaster.country} ${disaster.type}`);
  links.push({
    title: "Watchers.news 災害快訊",
    url: `https://watchers.news/?s=${watchersQuery}`
  });



  return links;
}

// --- 進階 Gemini AI 翻譯與報導生成 (如果用戶儲存了 API Key) ---
async function tryGeminiTranslation(disaster, descContainer) {
  const apiKey = localStorage.getItem("gemini_api_key");
  if (!apiKey) return false;

  try {
    console.log(`啟用 Gemini AI 翻譯增強: ${disaster.id}`);
    
    // 建立一個輕量的加載提示
    const originalText = descContainer.innerHTML;
    if (!showOriginalEnglish) {
      descContainer.innerHTML = `<span class="spinner" style="width:12px; height:12px; display:inline-block; margin-right:6px; vertical-align:middle;"></span>正在利用 Gemini AI 翻譯中...`;
    }

    // 準備 Prompt
    const prompt = `你是一個專業的全球災害監測與人道救援專家。請將以下全球災害資訊（英文）摘要並翻譯成精煉、流暢的繁體中文，格式需適合放在網頁表格的「災害說明」欄位。
資訊來源: ${disaster.source}
標題: ${disaster.title}
英文描述: ${disaster.description}
國家/地點: ${disaster.country}
災害類型: ${disaster.type}

翻譯與改寫要求：
1. 長度控制在 100-150 字之間，以繁體中文 (台灣用語，如風災、洪災、熱浪、芮氏規模) 回答。
2. 內容需包含發生時間、地點、災害規模/程度（如死亡撤離人數、風速或地震震級）以及可能的災情衝擊。
3. 語氣需專業、客觀。請直接輸出翻譯好的中文摘要，不要有任何「好的，以下是...」等贅詞。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.2 }
      })
    });

    if (!response.ok) throw new Error(`Gemini 回傳 HTTP 錯誤: ${response.status}`);
    
    const resData = await response.json();
    const resultText = resData.candidates[0].content.parts[0].text.trim();
    
    // 更新網頁上的文字
    if (!showOriginalEnglish) {
      const searchVal = document.getElementById("table-search").value.trim();
      const highlightedResultText = highlightText(resultText, searchVal);
      descContainer.innerHTML = `
        ${disaster.alertlevel && disaster.alertlevel !== "None" ? 
          `<span class="desc-alert-badge ${disaster.alertlevel.toLowerCase()}">${disaster.alertlevel === 'Red' ? '紅色警戒' : disaster.alertlevel === 'Orange' ? '橙色警戒' : '綠色警報'}</span>` : ''}
        <span class="desc-text">${highlightedResultText}</span>
        <span class="desc-ai-generated">✦ AI 智慧生成繁中摘要</span>
      `;
    }

    // 同步把此 AI 翻譯結果存入記憶體快取中
    disaster.aiChineseDescription = resultText;
    return true;
  } catch (err) {
    console.error("Gemini 翻譯失敗:", err);
    // 復原為預設翻譯
    disaster.aiChineseDescription = null; // 清除快取，使用內建模版
    return false;
  }
}

// --- 資料篩選與渲染渲染 ---

function filterAndDisplayData() {
  const timeRangeVal = document.getElementById("time-range").value;
  const alertRedChk = document.getElementById("alert-red-chk").checked;
  const alertOrangeChk = document.getElementById("alert-orange-chk").checked;
  const alertGreenChk = document.getElementById("alert-green-chk").checked;
  const alertNoneChk = document.getElementById("alert-none-chk").checked;
  const searchVal = document.getElementById("table-search").value.trim().toLowerCase();

  const gdacsChk = document.getElementById("source-gdacs-chk").checked;
  const erccChk = document.getElementById("source-ercc-chk").checked;
  const usgsChk = document.getElementById("source-usgs-chk").checked;
  const reliefwebChk = document.getElementById("source-reliefweb-chk").checked;

  const now = new Date();
  let startDate = null;
  let endDate = null;

  // 計算時間過濾起訖日
  if (timeRangeVal === "custom") {
    const startStr = document.getElementById("start-date").value;
    const endStr = document.getElementById("end-date").value;
    if (startStr) startDate = new Date(startStr);
    if (endStr) {
      endDate = new Date(endStr);
      endDate.setHours(23, 59, 59, 999); // 包含整天
    }
  } else {
    const days = parseInt(timeRangeVal);
    startDate = new Date();
    startDate.setDate(now.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0); // 起始日從當天 00:00 開始
    endDate = now;
  }

  // 執行篩選
  const filteredDisasters = allDisasters.filter(d => {
    // 1. 篩選資料來源
    if (d.source === "GDACS" && !gdacsChk) return false;
    if (d.source === "ERCC" && !erccChk) return false;
    if (d.source === "USGS" && !usgsChk) return false;
    if (d.source === "ReliefWeb" && !reliefwebChk) return false;

    // 1.5 篩選災害類別
    const stdGroup = getStandardCategoryGroup(d.type);
    if (stdGroup === "TC" && !document.getElementById("cat-tc-chk").checked) return false;
    if (stdGroup === "FL" && !document.getElementById("cat-fl-chk").checked) return false;
    if (stdGroup === "EQ" && !document.getElementById("cat-eq-chk").checked) return false;
    if (stdGroup === "VO" && !document.getElementById("cat-vo-chk").checked) return false;
    if (stdGroup === "WF" && !document.getElementById("cat-wf-chk").checked) return false;
    if (stdGroup === "DR" && !document.getElementById("cat-dr-chk").checked) return false;
    if (stdGroup === "OTHER" && !document.getElementById("cat-other-chk").checked) return false;

    // 2. 篩選警報等級
    if (d.alertlevel === "Red" && !alertRedChk) return false;
    if (d.alertlevel === "Orange" && !alertOrangeChk) return false;
    if (d.alertlevel === "Green" && !alertGreenChk) return false;
    if ((!d.alertlevel || d.alertlevel === "None") && !alertNoneChk) return false;

    // 3. 篩選時間區段 (判斷災害活動區間與篩選區間是否有重疊)
    // 災害區間：fromdate (或 pubDate) ~ todate (或 pubDate)
    // 篩選區間：startDate ~ endDate
    // 重疊條件：災害結束日 >= 篩選起始日 且 災害起始日 <= 篩選結束日
    const itemDate = new Date(d.pubDate);
    if (isNaN(itemDate.getTime())) return false; // 無效日期過濾掉

    const itemFromDate = d.fromdate ? new Date(d.fromdate) : itemDate;
    const itemToDate = d.todate ? new Date(d.todate) : itemDate;
    const effectiveFrom = !isNaN(itemFromDate.getTime()) ? itemFromDate : itemDate;

    // 將 effectiveTo 標準化為「當日 23:59:59.999 本地時間」
    // 避免因 UTC 時間戳解析差異（如 "2026-06-02T00:00:00Z" 等於本地 06/02 08:00）
    // 而意外將「日期區間結束在篩選起始日當天」的事件排除在外。
    // 例：todate = 6/2、篩選起始 = 6/2，確保 6/2 的事件一定被納入過去七天。
    let effectiveTo = !isNaN(itemToDate.getTime()) ? itemToDate : itemDate;
    if (!isNaN(effectiveTo.getTime())) {
      // 取得本地日期的年/月/日，設定為當日結束時刻
      const toEndOfDay = new Date(
        effectiveTo.getFullYear(),
        effectiveTo.getMonth(),
        effectiveTo.getDate(),
        23, 59, 59, 999
      );
      effectiveTo = toEndOfDay;
    }

    // 災害完全在篩選區間之前結束 → 排除
    if (startDate && effectiveTo < startDate) return false;
    // 災害完全在篩選區間之後才開始 → 排除
    if (endDate && effectiveFrom > endDate) return false;

    // 4. 關鍵字模糊檢索 (搜尋國家、標題、中文說明或類別)
    if (searchVal) {
      const typeInfo = getCategoryInfo(d.type);
      const chineseDesc = d.aiChineseDescription || generateChineseDescription(d);
      const matchesSearch = 
        d.title.toLowerCase().includes(searchVal) ||
        d.description.toLowerCase().includes(searchVal) ||
        d.country.toLowerCase().includes(searchVal) ||
        translateCountry(d.country).includes(searchVal) ||
        typeInfo.name.includes(searchVal) ||
        chineseDesc.includes(searchVal);
      
      if (!matchesSearch) return false;
    }

    return true;
  });

  // 按類別優先級排序 (TC > FL > EQ > VO > WF > DR > 其它)，同類別則按日期由新到舊排序
  filteredDisasters.sort((a, b) => {
    const priorityA = CATEGORY_PRIORITY[a.type] || 99;
    const priorityB = CATEGORY_PRIORITY[b.type] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 若優先級相同，則比較日期 (由新到舊)
    const dateA = new Date(a.pubDate);
    const dateB = new Date(b.pubDate);
    return dateB - dateA;
  });

  // 快取篩選結果以進行局部渲染
  currentFilteredDisasters = filteredDisasters;

  // 渲染地圖標記與表格
  renderMapMarkers(currentFilteredDisasters);
  renderTable(currentFilteredDisasters);
  renderStats(currentFilteredDisasters);
}

// 僅渲染表格 (用於逆向地理編碼完成時的局部重繪，避免重置地圖)
function renderTableOnly() {
  // 僅更新表格內容，避免影響地圖上的 Open Popup 與標記狀態
  renderTable(currentFilteredDisasters);
}

// --- 渲染地圖標記 ---
function renderMapMarkers(disasters) {
  if (!map || !markersGroup) return;
  markersGroup.clearLayers();

  disasters.forEach(d => {
    if (d.lat === null || d.lng === null || isNaN(d.lat) || isNaN(d.lng)) return;

    // 根據警報等級設定不同的標記樣式
    let colorClass = "blue";
    if (d.alertlevel === "Red") colorClass = "red";
    else if (d.alertlevel === "Orange") colorClass = "orange";
    else if (d.alertlevel === "Green") colorClass = "green";

    // 建立自訂的 Glowing CSS Marker
    const customIcon = L.divIcon({
      className: `map-marker-pulse ${colorClass}`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    const marker = L.marker([d.lat, d.lng], { icon: customIcon });

    // 彈出視窗內容
    const countryCn = translateCountry(d.country);
    const catName = getCategoryInfo(d.type).name;
    const popupContent = `
      <div class="map-popup-card">
        <h4>[${d.source}] ${countryCn} · ${catName}</h4>
        <p>${d.title}</p>
        <p style="font-size:11px; color:#9ca3af; margin-bottom: 4px;">座標: ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</p>
        <a href="#row-${d.id}" class="popup-link" onclick="highlightTableRow('${d.id}')">🔍 在下方報表中查看</a>
      </div>
    `;

    marker.bindPopup(popupContent);
    marker.on('click', () => {
      highlightTableRow(d.id);
    });

    markersGroup.addLayer(marker);
  });
}

// --- 搜尋關鍵字高亮標記輔助函數 ---
function highlightText(text, keyword) {
  if (text === null || text === undefined) return "";
  const textStr = String(text);
  if (!keyword) return textStr;
  const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  return textStr.replace(regex, '<mark>$1</mark>');
}

// --- 渲染數據表格 ---
function renderTable(disasters) {
  const tableBody = document.getElementById("disaster-table-body");
  const summaryText = document.getElementById("table-summary-text");
  const searchVal = document.getElementById("table-search").value.trim();

  if (disasters.length === 0) {
    summaryText.textContent = "找到 0 筆符合條件的災害事件。";
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">
          <div class="table-empty-icon">📂</div>
          <p>沒有找到符合目前篩選條件的災害事件。</p>
        </td>
      </tr>
    `;
    return;
  }

  summaryText.textContent = `在指定時間內共找到 ${disasters.length} 筆重大災害事件。`;
  tableBody.innerHTML = "";

  disasters.forEach(d => {
    const tr = document.createElement("tr");
    tr.id = `row-${d.id}`;
    
    // 雙擊或點擊行在地圖上定位
    tr.addEventListener("click", () => {
      focusOnMap(d.lat, d.lng, d.id);
    });

    // 1. 日期欄位 (起訖日或單日)
    const dateCell = document.createElement("td");
    dateCell.className = "date-cell";
    dateCell.setAttribute("data-label", "日期");
    
    // 如果有 fromdate/todate 則顯示起訖日，否則顯示單日
    const dateStr = formatDateRange(d.fromdate, d.todate, d.pubDate);
    dateCell.textContent = dateStr;
    tr.appendChild(dateCell);

    // 2. 地點欄位 (國家、省份/州、座標、Google Map)
    const locCell = document.createElement("td");
    locCell.className = "location-cell";
    locCell.setAttribute("data-label", "地點");
    
    const countryName = showOriginalEnglish ? (d.country || "Unknown Country") : translateCountry(d.country);
    const flagImg = getCountryFlagImgHtml(d.country);
    
    let continent = getCountryContinent(d.country);
    if (showOriginalEnglish) {
      const continentEnMap = {
        "亞洲": "Asia",
        "歐洲": "Europe",
        "北美洲": "North America",
        "南美洲": "South America",
        "非洲": "Africa",
        "大洋洲": "Oceania",
        "其它地區": "Other"
      };
      continent = continentEnMap[continent] || continent;
    }
    
    // 高亮國家/地點關鍵字
    const highlightedCountryName = highlightText(countryName, searchVal);
    
    // 格式為：國旗 洲 國名 (無括弧)
    const countryLabel = flagImg ? `${flagImg} ${continent} ${highlightedCountryName}` : `${continent} ${highlightedCountryName}`;
    
    const dmsLat = convertDecimalToDMS(d.lat, true);
    const dmsLng = convertDecimalToDMS(d.lng, false);
    
    // Nominatim 逆編碼獲得的詳細地址 (如果存在)
    let detailLocText = "";
    if (showOriginalEnglish) {
      detailLocText = d.englishLocationDetail || "";
    } else {
      detailLocText = translateSimplifiedToTraditional(d.chineseLocationDetail || "");
    }
    const highlightedDetailLocText = highlightText(detailLocText, searchVal);
    const detailLocStr = highlightedDetailLocText ? `<div class="loc-details">${highlightedDetailLocText}</div>` : '';
    
    let mapUrl = "#";
    if (d.lat !== null && d.lng !== null) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`;
    }

    locCell.innerHTML = `
      <div class="loc-country">${countryLabel}</div>
      ${detailLocStr}
      ${d.lat !== null ? `<span class="loc-coords">${dmsLat}<br>${dmsLng}</span>` : ''}
      ${d.lat !== null ? `<a href="${mapUrl}" target="_blank" class="loc-maps-link" onclick="event.stopPropagation();">📍 Google 地圖</a>` : ''}
    `;
    tr.appendChild(locCell);

    // 3. 類別欄位
    const catCell = document.createElement("td");
    catCell.className = "category-cell";
    catCell.setAttribute("data-label", "類別");
    const catInfo = getCategoryInfo(d.type);
    catCell.innerHTML = `<span class="cat-badge ${catInfo.cssClass}">${catInfo.name}</span>`;
    tr.appendChild(catCell);

    // 4. 災害說明 (如果已經有快取的 AI 翻譯，則直接使用；否則使用範本引擎，並啟動異步 Gemini 翻譯)
    const descCell = document.createElement("td");
    descCell.className = "desc-cell";
    descCell.setAttribute("data-label", "災害說明");

    // 警報等級外觀
    const alertBadge = d.alertlevel && d.alertlevel !== "None" ? 
      `<span class="desc-alert-badge ${d.alertlevel.toLowerCase()}">${d.alertlevel === 'Red' ? '紅色警戒' : d.alertlevel === 'Orange' ? '橙色警戒' : '綠色警報'}</span>` : "";

    const fallbackDescText = generateChineseDescription(d);
    
    if (showOriginalEnglish) {
      const highlightedTitle = highlightText(d.title, searchVal);
      const highlightedDesc = highlightText(d.description, searchVal);
      const origText = d.description && d.description !== d.title ?
        `<strong>${highlightedTitle}</strong><br>${highlightedDesc}` : highlightedTitle;
      descCell.innerHTML = `
        ${alertBadge}
        <span class="desc-text">${origText}</span>
      `;
    } else if (d.aiChineseDescription) {
      const rawChineseDesc = translateSimplifiedToTraditional(d.aiChineseDescription);
      const highlightedChineseDesc = highlightText(rawChineseDesc, searchVal);
      descCell.innerHTML = `
        ${alertBadge}
        <span class="desc-text">${highlightedChineseDesc}</span>
        <span class="desc-ai-generated">✦ AI 智慧生成繁中摘要</span>
      `;
    } else {
      const rawFallbackDescText = translateSimplifiedToTraditional(fallbackDescText);
      const highlightedFallbackDesc = highlightText(rawFallbackDescText, searchVal);
      descCell.innerHTML = `
        ${alertBadge}
        <span class="desc-text">${highlightedFallbackDesc}</span>
      `;
      // 嘗試調用 Gemini 翻譯 (如果 API Key 設定的話會在後台跑並動態更新)
      tryGeminiTranslation(d, descCell);
    }
    
    tr.appendChild(descCell);

    // 5. 文獻連結
    const refsCell = document.createElement("td");
    refsCell.className = "refs-cell";
    refsCell.setAttribute("data-label", "文獻連結");
    
    const refLinks = generateReferenceLinks(d);
    const list = document.createElement("ul");
    list.className = "refs-list";
    refLinks.forEach(ref => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="${ref.url}" target="_blank" class="ref-anchor" onclick="event.stopPropagation();">${ref.title}</a>`;
      list.appendChild(li);
    });
    refsCell.appendChild(list);
    tr.appendChild(refsCell);

    // 6. 操作欄位 (一鍵複製)
    const actionCell = document.createElement("td");
    actionCell.className = "action-cell";
    actionCell.setAttribute("data-label", "操作");
    
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-row-btn";
    copyBtn.title = showOriginalEnglish ? "Copy summary" : "複製災情摘要";
    copyBtn.innerHTML = `📋 複製`;
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止地圖定位
      copyDisasterSummary(d);
    });
    
    actionCell.appendChild(copyBtn);
    tr.appendChild(actionCell);

    tableBody.appendChild(tr);
  });
}

// --- 渲染側邊欄統計面板 ---
function renderStats(disasters) {
  document.getElementById("stat-total-count").textContent = disasters.length;
  
  const redCount = disasters.filter(d => d.alertlevel === "Red").length;
  const orangeCount = disasters.filter(d => d.alertlevel === "Orange").length;
  const greenCount = disasters.filter(d => d.alertlevel === "Green").length;

  document.getElementById("stat-red-count").textContent = redCount;
  document.getElementById("stat-orange-count").textContent = orangeCount;
  document.getElementById("stat-green-count").textContent = greenCount;

  // 計算類別分佈
  const typeCounts = {};
  disasters.forEach(d => {
    const catName = getCategoryInfo(d.type).name;
    typeCounts[catName] = (typeCounts[catName] || 0) + 1;
  });

  const categoryBars = document.getElementById("category-bars");
  if (disasters.length === 0) {
    categoryBars.innerHTML = `<div class="no-data-text">無資料</div>`;
    return;
  }

  categoryBars.innerHTML = "";
  // 排序類別：由多到少
  const sortedCategories = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  sortedCategories.forEach(([catName, count]) => {
    const percentage = ((count / disasters.length) * 100).toFixed(0);
    
    // 對照 CSS color
    let fillClass = "blue-fill";
    if (catName === "地震") fillClass = "red-fill";
    else if (catName === "淹水") fillClass = "green-fill";
    else if (catName === "熱帶氣旋") fillClass = "orange-fill";
    else if (catName === "熱浪") fillClass = "red-fill";

    const barItem = document.createElement("div");
    barItem.className = "category-bar-item";
    barItem.innerHTML = `
      <div class="category-bar-label">
        <span>${catName}</span>
        <span>${count} 次 (${percentage}%)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${fillClass}" style="width: ${percentage}%"></div>
      </div>
    `;
    categoryBars.appendChild(barItem);
  });
}

// --- 表格與地圖連動功能 ---

// 點擊地圖標記時，高亮下方表格的對應行並滾動定位
function highlightTableRow(id) {
  // 移除其它高亮
  document.querySelectorAll(".disaster-table tbody tr").forEach(row => {
    row.classList.remove("row-highlight");
  });

  const targetRow = document.getElementById(`row-${id}`);
  if (targetRow) {
    targetRow.classList.add("row-highlight");
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// 點擊表格行時，地圖視角自動聚焦該事件點，並展開地圖 popup
function focusOnMap(lat, lng, id) {
  if (!map || lat === null || lng === null || isNaN(lat) || isNaN(lng)) return;

  // 移動地圖中心
  map.setView([lat, lng], 6, { animate: true, duration: 1.0 });

  // 尋找對應的標記並開啟 Popup
  markersGroup.eachLayer(marker => {
    const markerLatLng = marker.getLatLng();
    // 經緯度微小誤差比對即可
    if (Math.abs(markerLatLng.lat - lat) < 0.001 && Math.abs(markerLatLng.lng - lng) < 0.001) {
      marker.openPopup();
    }
  });

  // 表格本行也加上高亮
  document.querySelectorAll(".disaster-table tbody tr").forEach(row => {
    row.classList.remove("row-highlight");
  });
  const targetRow = document.getElementById(`row-${id}`);
  if (targetRow) targetRow.classList.add("row-highlight");
}

// --- 匯出 CSV 報表 ---
function exportToCSV() {
  if (allDisasters.length === 0) {
    alert("目前沒有資料可匯出！");
    return;
  }

  // 欄位標題
  const headers = ["日期", "國家", "詳細地點", "經度", "緯度", "災害類別", "警報等級", "災害說明", "災害說明(英文)", "官方連結"];
  
  const csvRows = [headers.join(",")];

  // 遍歷當前載入的資料
  allDisasters.forEach(d => {
    const dateStr = formatDateRange(d.fromdate, d.todate, d.pubDate);
    const flag = getCountryFlag(d.country);
    const continent = getCountryContinent(d.country);
    const countryCn = translateCountry(d.country);
    const country = flag ? `${flag} ${continent} ${countryCn}` : `${continent} ${countryCn}`;
    const details = translateSimplifiedToTraditional(d.chineseLocationDetail || "");
    const lat = d.lat || "";
    const lng = d.lng || "";
    const category = getCategoryInfo(d.type).name;
    const level = d.alertlevel || "None";
    const desc = translateSimplifiedToTraditional(d.aiChineseDescription || generateChineseDescription(d)).replace(/"/g, '""'); // CSV 跳脫雙引號
    
    // 獲取原始英文災害說明：若有 description 且與 title 不同，則合併；否則只用 title
    let descEnRaw = d.description && d.description !== d.title ? `${d.title} | ${d.description}` : d.title || "";
    // 去除 HTML/XML 標籤並整理格式
    descEnRaw = descEnRaw.replace(/<\/?[^>]+(>|$)/g, "").trim();
    const descEn = descEnRaw.replace(/"/g, '""'); // CSV 跳脫雙引號
    
    const link = d.link;

    const row = [
      `"${dateStr}"`,
      `"${country}"`,
      `"${details}"`,
      `"${lng}"`,
      `"${lat}"`,
      `"${category}"`,
      `"${level}"`,
      `"${desc}"`,
      `"${descEn}"`,
      `"${link}"`
    ];
    csvRows.push(row.join(","));
  });

  // 加上 BOM 防止 Excel 開啟中文亂碼
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", `全球災害彙整報表_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- 一鍵複製災情摘要 ---
function copyDisasterSummary(d) {
  const countryName = showOriginalEnglish ? (d.country || "Unknown Country") : translateCountry(d.country);
  const catInfo = getCategoryInfo(d.type);

  // 對齊網頁表格顯示：加入洲名（如「南美洲」）
  let continent = getCountryContinent(d.country);
  if (showOriginalEnglish) {
    const continentEnMap = {
      "亞洲": "Asia", "歐洲": "Europe", "北美洲": "North America",
      "南美洲": "South America", "非洲": "Africa", "大洋洲": "Oceania", "其它地區": "Other"
    };
    continent = continentEnMap[continent] || continent;
  }
  let dateStr = formatDateRange(d.fromdate, d.todate, d.pubDate);
  
  // 依照用戶 PPT 格式優化日期顯示 (例如 03/25 ~ 03/27 ➔ 3/25-3/27)
  dateStr = dateStr.replace(/0(\d)/g, '$1').replace(/\s*~\s*/g, '-');
  
  let alertText = "";
  if (d.alertlevel && d.alertlevel !== "None") {
    if (showOriginalEnglish) {
      alertText = `${d.alertlevel} Alert`;
    } else {
      alertText = d.alertlevel === 'Red' ? '紅色警戒' : d.alertlevel === 'Orange' ? '橙色警戒' : '綠色警報';
    }
  } else {
    alertText = showOriginalEnglish ? "Green/No Alert" : "綠色/無警報";
  }
  
  let detailLocText = "";
  if (showOriginalEnglish) {
    detailLocText = d.englishLocationDetail || "";
  } else {
    detailLocText = translateSimplifiedToTraditional(d.chineseLocationDetail || "");
  }
  
  const dmsLat = convertDecimalToDMS(d.lat, true);
  const dmsLng = convertDecimalToDMS(d.lng, false);
  const mapUrl = d.lat !== null && d.lng !== null ? `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}` : "";
  
  // 組合成與 PPT 相符的「地點」儲存格內容（洲名 國名 詳細地址 座標 地圖）
  let locCellContent = `${continent} ${countryName}`;
  if (detailLocText) {
    locCellContent += `\n${detailLocText}`;
  }
  if (d.lat !== null && d.lng !== null) {
    locCellContent += `\n${dmsLat} ${dmsLng}`;
    locCellContent += `\n${mapUrl}`;
  }

  let descText = "";
  if (showOriginalEnglish) {
    descText = d.description && d.description !== d.title ?
      `${d.title}\n${d.description}` : d.title;
  } else if (d.aiChineseDescription) {
    descText = translateSimplifiedToTraditional(d.aiChineseDescription);
  } else {
    descText = translateSimplifiedToTraditional(generateChineseDescription(d));
  }
  
  // 移除可能存在的 HTML 標籤
  descText = descText.replace(/<\/?[^>]+(>|$)/g, "");
  
  const refLinks = generateReferenceLinks(d);
  const refUrls = refLinks.map(ref => ref.url).join("\n");

  // TSV 單元格防破格處理輔助函數
  const formatCellForTSV = (val) => {
    if (val === null || val === undefined) return "";
    let str = String(val).trim();
    str = str.replace(/"/g, '""'); // CSV/TSV 標準：雙引號轉為兩個雙引號
    if (str.includes('\n') || str.includes('\r') || str.includes('\t') || str.includes('"')) {
      str = `"${str}"`;
    }
    return str;
  };

  // 1. 純文字格式 (TSV) - 支援本機文字檔或 Excel 直貼
  const plainText = [
    formatCellForTSV(dateStr),
    formatCellForTSV(locCellContent),
    formatCellForTSV(catInfo.name),
    formatCellForTSV(descText),
    formatCellForTSV(refUrls)
  ].join("\t");

  // 2. HTML 格式 (Table) - 支援 MS Word 與 PPT 表格「直接貼入多格」
  const toHtmlTd = (val) => {
    if (val === null || val === undefined) return `<td style="font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 14pt; vertical-align: top;"></td>`;
    let str = String(val).trim();
    // 轉義 HTML 字元以防注入與破格
    str = str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    // 將換行符轉為 <br>
    str = str.replace(/\n/g, "<br>");
    return `<td style="font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 14pt; vertical-align: top; line-height: 1.4;">${str}</td>`;
  };

  const htmlText = `<table style="border-collapse: collapse; font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 14pt;"><tr style="font-family: 'Microsoft JhengHei', '微軟正黑體', sans-serif; font-size: 14pt;">` +
    toHtmlTd(dateStr) +
    toHtmlTd(locCellContent) +
    toHtmlTd(catInfo.name) +
    toHtmlTd(descText) +
    toHtmlTd(refUrls) +
    `</tr></table>`;

  // 執行複製：優先寫入富文字 (HTML) 與純文字雙重格式，若瀏覽器不支援則 fallback 至純文字
  try {
    const textBlob = new Blob([plainText], { type: "text/plain" });
    const htmlBlob = new Blob([htmlText], { type: "text/html" });
    const clipboardItem = new ClipboardItem({
      "text/plain": textBlob,
      "text/html": htmlBlob
    });
    navigator.clipboard.write([clipboardItem]).then(() => {
      showToast(showOriginalEnglish ? "Copied in PPT Table format!" : "已複製 PPT 表格格式（選取第一個格子貼上即可）！");
    }).catch(err => {
      // Fallback
      navigator.clipboard.writeText(plainText).then(() => {
        showToast(showOriginalEnglish ? "Copied in TSV format!" : "已複製表格文字格式（支援 PPT 直貼）！");
      });
    });
  } catch (e) {
    // Fallback
    navigator.clipboard.writeText(plainText).then(() => {
      showToast(showOriginalEnglish ? "Copied in TSV format!" : "已複製表格文字格式（支援 PPT 直貼）！");
    });
  }
}

// --- 顯示 Toast 訊息提示 ---
function showToast(message) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.innerHTML = `<span>🔔</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  // 強制重繪以觸發動畫
  toast.offsetHeight;
  
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- 簡報圖卡生成器邏輯實作 ---

// 根據可用空間自動雙向縮放簡報畫布，防止橫向與縱向溢出捲動
function resizeSlideCanvas() {
  const modalBody = document.querySelector(".slide-modal-body");
  const container = document.querySelector(".slide-canvas-container");
  const scaler = document.getElementById("slide-canvas-scaler");
  const canvas = document.getElementById("slide-canvas");
  if (!modalBody || !container || !scaler || !canvas) return;

  // 1. 取得 modal-body 內部實際可視高寬
  const bodyW = modalBody.clientWidth;
  const bodyH = modalBody.clientHeight;

  // 2. 側邊欄固定寬 340px，間距 24px，左右內距與邊界補償約 56px
  const availableWidth = bodyW - 340 - 24 - 56;
  // 上下內距與提示文字 tip 佔用空間補償約 64px
  const availableHeight = bodyH - 64;

  const baseWidth = 1200;
  const baseHeight = 675;

  // 3. 計算寬度比與高度比
  const scaleW = availableWidth / baseWidth;
  const scaleH = availableHeight / baseHeight;

  // 4. 取得兩軸最小的縮放比例，且上限為 1.0 (不放大)
  const scale = Math.max(0.1, Math.min(scaleW, scaleH, 1.0));

  // 5. 套用縮放
  canvas.style.transform = `scale(${scale})`;
  
  // 6. 同步修改 scaler 的 Layout 排版寬高，以防瀏覽器產生橫向與縱向捲動條
  scaler.style.width = `${baseWidth * scale}px`;
  scaler.style.height = `${baseHeight * scale}px`;
}

// 開啟簡報圖卡生成器 Modal
function openSlideGenerator() {
  if (!currentFilteredDisasters || currentFilteredDisasters.length === 0) {
    alert("目前沒有任何篩選出的災情，無法生成圖卡。請調整篩選器！");
    return;
  }

  // 1. 計算日期區間文字
  const timeRangeVal = document.getElementById("time-range").value;
  let startStr = "";
  let endStr = "";
  if (timeRangeVal === "custom") {
    startStr = document.getElementById("start-date").value;
    endStr = document.getElementById("end-date").value;
  } else {
    const days = parseInt(timeRangeVal);
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - (days - 1));
    startStr = start.toISOString().split('T')[0];
    endStr = now.toISOString().split('T')[0];
  }
  
  const formatSlideDate = (dateStr) => {
    if (!dateStr) return "";
    return dateStr.replace(/-/g, '.');
  };
  const dateText = startStr && endStr ? ` (${formatSlideDate(startStr)} ~ ${formatSlideDate(endStr)})` : "";
  document.getElementById("slide-title-text").textContent = `重大災害回顧${dateText}`;

  // 2. 渲染側邊欄勾選清單
  const listContainer = document.getElementById("slide-disaster-list");
  listContainer.innerHTML = "";
  
  currentFilteredDisasters.forEach((d, idx) => {
    const item = document.createElement("div");
    item.className = "slide-disaster-item";
    
    // 預設選取前 3 筆
    const isChecked = idx < 3 ? "checked" : "";
    const dateRange = formatDateRange(d.fromdate, d.todate, d.pubDate);
    const shortDate = dateRange.replace(/0(\d)/g, '$1').replace(/\s*~\s*/g, '-');
    const countryName = translateCountry(d.country);
    
    item.innerHTML = `
      <input type="checkbox" id="slide-chk-${d.id}" data-id="${d.id}" ${isChecked}>
      <div class="slide-disaster-info">
        <span class="title">${shortDate} ${countryName} ${getCategoryInfo(d.type).name}</span>
        <span class="meta">
          <span>來源: ${d.source}</span>
          <span>警報: ${d.alertlevel === 'Red' ? '紅色' : d.alertlevel === 'Orange' ? '橙色' : d.alertlevel === 'Green' ? '綠色' : '無'}</span>
        </span>
      </div>
    `;
    
    // 點擊整項即可切換 checkbox 狀態
    item.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        const chk = item.querySelector("input");
        chk.checked = !chk.checked;
        chk.dispatchEvent(new Event("change"));
      }
    });
    
    listContainer.appendChild(item);
  });

  // 監聽所有複選框的狀態變化
  const checkboxes = listContainer.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(chk => {
    chk.addEventListener("change", () => {
      // 限制最多只能勾選 5 筆
      const checkedCount = listContainer.querySelectorAll("input[type='checkbox']:checked").length;
      if (checkedCount > 5) {
        chk.checked = false;
        alert("為維持 16:9 簡報排版美觀，最多只能同時選取 5 筆災害顯示在圖卡上喔！");
        return;
      }
      updateSlideCanvas();
    });
  });

  // 3. 初次更新畫布與繪製
  updateSlideCanvas();

  // 4. 顯示 Modal
  document.getElementById("slide-generator-modal").classList.remove("hidden");

  // 5. 執行畫布自適應縮放並綁定視窗事件
  setTimeout(resizeSlideCanvas, 50);
  window.addEventListener("resize", resizeSlideCanvas);
}

// 根據勾選項目更新畫布內容
function updateSlideCanvas() {
  const layer = document.getElementById("slide-interactive-layer");
  if (!layer) return;
  layer.innerHTML = ""; // 清空舊內容

  const checkedDisasters = [];
  const listContainer = document.getElementById("slide-disaster-list");
  const checkedBoxes = listContainer.querySelectorAll("input[type='checkbox']:checked");
  
  checkedBoxes.forEach(chk => {
    const dId = chk.getAttribute("data-id");
    const found = currentFilteredDisasters.find(d => d.id === dId);
    if (found) checkedDisasters.push(found);
  });

  // 定義預設擺放位置 (Slot 1~5)
  const defaultCardPositions = [
    { left: 60, top: 120 },    // Slot 1: 左上
    { left: 850, top: 80 },    // Slot 2: 右上
    { left: 850, top: 430 },   // Slot 3: 右下
    { left: 60, top: 430 },    // Slot 4: 左下
    { left: 455, top: 80 }     // Slot 5: 中上
  ];

  checkedDisasters.forEach((d, index) => {
    // A. 換算地圖上的 XY 畫布座標
    const dotPos = getCanvasXY(d.lat, d.lng);
    
    // B. 建立發光地圖定位點
    const dot = document.createElement("div");
    dot.className = "slide-map-dot";
    dot.id = `slide-dot-${d.id}`;
    dot.style.left = `${dotPos.x}px`;
    dot.style.top = `${dotPos.y}px`;
    layer.appendChild(dot);

    // C. 建立災情說明卡片
    const dateRange = formatDateRange(d.fromdate, d.todate, d.pubDate);
    const shortDate = dateRange.replace(/0(\d)/g, '$1').replace(/\s*~\s*/g, '-');
    const countryName = translateCountry(d.country);
    const catName = getCategoryInfo(d.type).name;
    const flagHtml = getCountryFlagImgHtmlForSlide(d.country);
    
    let descText = d.aiChineseDescription ? translateSimplifiedToTraditional(d.aiChineseDescription) : translateSimplifiedToTraditional(generateChineseDescription(d));
    // 移除可能存在的 HTML 標籤
    descText = descText.replace(/<\/?[^>]+(>|$)/g, "").trim();

    const card = document.createElement("div");
    card.className = "slide-callout-card";
    card.id = `slide-card-${d.id}`;
    card.setAttribute("data-dot-id", `slide-dot-${d.id}`);
    
    // 根據 Slot 給予預設 Left/Top，如果同仁有拖曳過可以保留或重新排序
    const pos = defaultCardPositions[index % defaultCardPositions.length];
    card.style.left = `${pos.left}px`;
    card.style.top = `${pos.top}px`;

    card.innerHTML = `
      <div class="slide-card-header">
        <span class="slide-card-title-text" style="outline: none;">${shortDate} ${countryName} ${catName}</span>
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          ${flagHtml}
          <button class="slide-card-copy-btn" title="複製單張卡片為圖片" style="background: none; border: none; color: #006064; cursor: pointer; padding: 2px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; outline: none; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">📋</button>
        </span>
      </div>
      <div class="slide-card-body" style="outline: none;">${descText}</div>
    `;
    
    layer.appendChild(card);

    // 雙擊與編輯事件綁定
    const titleTextEl = card.querySelector(".slide-card-title-text");
    const bodyTextEl = card.querySelector(".slide-card-body");
    const copyBtn = card.querySelector(".slide-card-copy-btn");

    if (copyBtn) {
      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // 阻止事件冒泡以防觸發卡片拖曳
        copyCardAsImage(card);
      });
    }

    const enableEdit = (el) => {
      el.setAttribute("contenteditable", "true");
      el.focus();
      
      // 移動游標至文字尾端並選取
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };

    titleTextEl.addEventListener("dblclick", (e) => {
      enableEdit(titleTextEl);
      e.stopPropagation(); // 阻止事件冒泡防止觸發拖拽
    });
    bodyTextEl.addEventListener("dblclick", (e) => {
      enableEdit(bodyTextEl);
      e.stopPropagation();
    });

    // 即時重新計算線條（防寬高改變）
    titleTextEl.addEventListener("input", drawConnectingLines);
    bodyTextEl.addEventListener("input", drawConnectingLines);

    // 失去焦點關閉編輯狀態
    titleTextEl.addEventListener("blur", () => {
      titleTextEl.setAttribute("contenteditable", "false");
      drawConnectingLines();
    });
    bodyTextEl.addEventListener("blur", () => {
      bodyTextEl.setAttribute("contenteditable", "false");
      drawConnectingLines();
    });

    // 攔截貼上事件，強制以純文字插入
    // 原因：瀏覽器預設會將剪貼簿中的 HTML 格式（字型大小、粗細、顏色）一併貼入，
    //       導致貼上的文字與圖卡的 CSS 樣式不符。此處取出純文字再插入游標位置。
    const handlePastePlainText = (e) => {
      e.preventDefault();
      // 取得純文字內容（去除所有 HTML 標籤與格式）
      const plainText = (e.clipboardData || window.clipboardData).getData("text/plain");
      if (!plainText) return;

      // 使用 Selection API 在游標位置插入純文字節點
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents(); // 刪除已選取的文字（若有）
      range.insertNode(document.createTextNode(plainText));
      // 移動游標到插入文字的尾端
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      // 觸發 input 事件以重新計算連接線
      e.target.dispatchEvent(new Event("input", { bubbles: true }));
    };
    titleTextEl.addEventListener("paste", handlePastePlainText);
    bodyTextEl.addEventListener("paste", handlePastePlainText);


    // D. 綁定卡片拖動功能
    makeCardDraggable(card);
  });

  // E. 重新繪製連接線
  setTimeout(drawConnectingLines, 50);
}

// 經緯度對應至 1200x675 簡報畫布 (底圖 size 1100x471.35, offset 左50, 上120)
function getCanvasXY(lat, lng) {
  if (lat === null || lat === undefined || isNaN(lat)) lat = 0;
  if (lng === null || lng === undefined || isNaN(lng)) lng = 0;

  // 紐西蘭在地圖上被向左平移了約 15.38 度，在此進行區域性經度補償
  if (lng > 160 && lat < -30) {
    lng -= 15.38;
  }

  // 使用擬合出的精確等距柱狀投影 (Equirectangular) 轉換係數 (以離島中心點擬合以消除質心噪聲)
  // 151KB world_map.svg 原始視窗座標 2000x857
  const svgX = 5.571924 * lng + 989.252408;
  const svgY = -6.344521 * lat + 501.417600;
  
  // 畫布顯示尺寸與偏移量 (地圖實際大小 1100x471.35, 偏移左50, 上120)
  const x = (svgX / 2000) * 1100 + 50;
  const y = (svgY / 857) * 471.35 + 120;
  
  return { x, y };
}

// 計算定位點到卡片矩形邊界上最近的點，確保連接線永遠指向卡片邊緣
function getClosestPointOnCardRect(dotX, dotY, cardLeft, cardTop, cardWidth, cardHeight) {
  const cardRight = cardLeft + cardWidth;
  const cardBottom = cardTop + cardHeight;
  
  const closestX = Math.max(cardLeft, Math.min(dotX, cardRight));
  const closestY = Math.max(cardTop, Math.min(dotY, cardBottom));
  
  return { x: closestX, y: closestY };
}

// 繪製連接線
function drawConnectingLines() {
  const svg = document.getElementById("slide-lines-svg");
  if (!svg) return;
  svg.innerHTML = ""; // 清空舊連接線

  const cards = document.querySelectorAll(".slide-callout-card");
  cards.forEach(card => {
    const dotId = card.getAttribute("data-dot-id");
    const dot = document.getElementById(dotId);
    if (!dot) return;

    const dotX = parseFloat(dot.style.left) || 0;
    const dotY = parseFloat(dot.style.top) || 0;

    const cardLeft = parseFloat(card.style.left) || 0;
    const cardTop = parseFloat(card.style.top) || 0;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;

    // 計算最佳貼合連接點
    const target = getClosestPointOnCardRect(dotX, dotY, cardLeft, cardTop, cardWidth, cardHeight);

    // 建立 SVG 直線
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", dotX);
    line.setAttribute("y1", dotY);
    line.setAttribute("x2", target.x);
    line.setAttribute("y2", target.y);
    line.setAttribute("stroke", "#06b6d4"); // 與地圖定位點一致的亮青色
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("opacity", "0.85");
    svg.appendChild(line);
  });
}

// 輕量化滑鼠與觸控卡片拖曳邏輯
function makeCardDraggable(cardEl) {
  const header = cardEl.querySelector(".slide-card-header");
  if (!header) return;

  let activeDrag = false;
  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;

  const onStart = (e) => {
    activeDrag = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    startX = clientX;
    startY = clientY;
    
    initLeft = parseFloat(cardEl.style.left) || 0;
    initTop = parseFloat(cardEl.style.top) || 0;
    
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!activeDrag) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // 取得畫布目前的縮放比例 (防本機解析度或網頁縮放導致移動速度不一致)
    const canvas = document.getElementById("slide-canvas");
    const rect = canvas.getBoundingClientRect();
    const scale = 1200 / rect.width;

    let newLeft = initLeft + dx * scale;
    let newTop = initTop + dy * scale;

    // 限制在 1200x675 簡報範圍內
    newLeft = Math.max(0, Math.min(1200 - cardEl.offsetWidth, newLeft));
    newTop = Math.max(0, Math.min(675 - cardEl.offsetHeight, newTop));

    cardEl.style.left = `${newLeft}px`;
    cardEl.style.top = `${newTop}px`;

    // 實時重新繪製連接線
    drawConnectingLines();
    e.preventDefault();
  };

  const onEnd = () => {
    activeDrag = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onEnd);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
  };

  header.addEventListener("mousedown", onStart);
  header.addEventListener("touchstart", onStart, { passive: false });
}

// 下載投影片圖卡為高解析度 PNG
function downloadSlidePNG() {
  const canvas = document.getElementById("slide-canvas");
  const scaler = document.getElementById("slide-canvas-scaler");
  if (!canvas) return;

  showToast("正在生成高解析度簡報圖卡，請稍候...");

  // 暫時移除縮放以確保 html2canvas 擷取到原始 1200x675 尺寸的完美像素
  const prevTransform = canvas.style.transform;
  const prevScalerW = scaler ? scaler.style.width : "";
  const prevScalerH = scaler ? scaler.style.height : "";
  
  canvas.style.transform = "none";
  if (scaler) {
    scaler.style.width = "1200px";
    scaler.style.height = "675px";
  }

  // 截圖前隱藏所有卡片的複製按鈕（📋），避免出現在下載圖片中
  const copyBtns = canvas.querySelectorAll(".slide-card-copy-btn");
  copyBtns.forEach(btn => { btn.style.display = "none"; });

  const svgEl = document.getElementById("slide-map-bg");
  let imgEl = null;

  const proceedToCanvas = () => {
    // 將 scale 設為 1.6 (1200 * 1.6 = 1920, 675 * 1.6 = 1080)
    // 以便匯出符合 PPT 標準寬幅 1080p 的超清晰圖片
    html2canvas(canvas, {
      scale: 1.6,
      useCORS: true,
      allowTaint: false,
      logging: true,
      backgroundColor: "#f8fafc"
    }).then(canvasEl => {
      // 恢復縮放
      canvas.style.transform = prevTransform;
      if (scaler) {
        scaler.style.width = prevScalerW;
        scaler.style.height = prevScalerH;
      }

      // 恢復 SVG
      if (svgEl && imgEl && imgEl.parentNode) {
        imgEl.parentNode.replaceChild(svgEl, imgEl);
      }

      // 恢復複製按鈕顯示
      copyBtns.forEach(btn => { btn.style.display = ""; });

      const url = canvasEl.toDataURL("image/png");
      const titleText = document.getElementById("slide-title-text").textContent.trim();
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titleText}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("簡報圖卡下載成功！");
    }).catch(err => {
      console.error("生成圖卡失敗:", err);
      // 恢復縮放
      canvas.style.transform = prevTransform;
      if (scaler) {
        scaler.style.width = prevScalerW;
        scaler.style.height = prevScalerH;
      }

      // 恢復 SVG
      if (svgEl && imgEl && imgEl.parentNode) {
        imgEl.parentNode.replaceChild(svgEl, imgEl);
      }

      // 恢復複製按鈕顯示
      copyBtns.forEach(btn => { btn.style.display = ""; });

      alert("簡報圖卡生成失敗，可能是圖檔快取或瀏覽器限制，請重試或聯繫開發同仁。");
    });
  };

  if (svgEl) {
    try {
      // 序列化 SVG 為字串並轉為 Base64 Data URL
      const svgString = new XMLSerializer().serializeToString(svgEl);
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      const imgUrl = "data:image/svg+xml;base64," + svgBase64;
      
      // 建立暫時的 <img> 標籤並複製樣式與屬性
      imgEl = document.createElement("img");
      imgEl.id = "slide-map-bg";
      imgEl.src = imgUrl;
      imgEl.style.position = "absolute";
      imgEl.style.width = "1100px";
      imgEl.style.height = "471.35px";
      imgEl.style.left = "50px";
      imgEl.style.top = "120px";
      imgEl.style.opacity = "0.9";
      imgEl.style.zIndex = "1";
      
      imgEl.onload = proceedToCanvas;
      imgEl.onerror = (e) => {
        console.error("Failed to load temporary SVG image, falling back", e);
        if (imgEl && imgEl.parentNode) {
          imgEl.parentNode.replaceChild(svgEl, imgEl);
        }
        proceedToCanvas();
      };
      
      svgEl.parentNode.replaceChild(imgEl, svgEl);
    } catch (err) {
      console.error("Error creating temporary SVG image, falling back", err);
      proceedToCanvas();
    }
  } else {
    proceedToCanvas();
  }
}

// 複製單張災情資訊卡為透明 PNG 圖片至剪貼簿
function copyCardAsImage(cardEl) {
  if (!cardEl) return;

  showToast("正在複製卡片，請稍候...");

  // ── 修正文字重疊問題 ──────────────────────────────────────────
  // html2canvas 直接截取在 CSS transform 父容器內的元素時，
  // 會因座標系統偏差而導致文字雙重渲染（重疊）。
  // 解法：將卡片 clone 至 document.body（脫離 transform 影響），
  // 截圖後再移除 clone，不影響原始卡片的任何狀態。
  // ──────────────────────────────────────────────────────────────
  const clone = cardEl.cloneNode(true);

  // 移除 clone 內的複製按鈕，確保不出現在截圖中
  const cloneCopyBtn = clone.querySelector(".slide-card-copy-btn");
  if (cloneCopyBtn) cloneCopyBtn.remove();

  // 將 clone 放到畫面外，但保持與原卡片相同的寬度
  clone.style.position  = "fixed";
  clone.style.top       = "-9999px";
  clone.style.left      = "-9999px";
  clone.style.transform = "none";
  clone.style.zIndex    = "-9999";
  clone.style.width     = cardEl.offsetWidth + "px";
  clone.style.height    = "auto";
  document.body.appendChild(clone);

  html2canvas(clone, {
    scale: 2.0,       // 高解析度 (2×)
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff" // 白底，確保文字清晰
  }).then(canvas => {
    // 移除 clone
    document.body.removeChild(clone);

    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("已成功將資訊卡複製至剪貼簿，可直接在 PPT 中貼上 (Ctrl+V)！");
      } catch (err) {
        console.error("複製卡片至剪貼簿失敗:", err);
        alert("複製卡片至剪貼簿失敗，可能受限於瀏覽器安全政策，請改用簡報圖卡下載功能！");
      }
    }, "image/png");
  }).catch(err => {
    document.body.removeChild(clone);
    console.error("生成卡片圖片失敗:", err);
    alert("複製卡片失敗，請重試！");
  });
}

// 複製選定的重大災害文字摘要至剪貼簿
function copySummaryTextToClipboard() {
  const listContainer = document.getElementById("slide-disaster-list");
  if (!listContainer) return;
  
  const checkedBoxes = listContainer.querySelectorAll("input[type='checkbox']:checked");
  if (checkedBoxes.length === 0) {
    alert("目前沒有選取任何災害項目！請先在左側勾選要加入的災害。");
    return;
  }

  const checkedDisasters = [];
  checkedBoxes.forEach(chk => {
    const dId = chk.getAttribute("data-id");
    const found = currentFilteredDisasters.find(d => d.id === dId);
    if (found) checkedDisasters.push(found);
  });

  // 1. 取得標題並轉換日期格式 (去前導零，如 2026.03.24 -> 2026.3.24)
  const slideTitleText = document.getElementById("slide-title-text").textContent.trim();
  let summaryTitle = "上周重大災情回顧";
  const dateMatch = slideTitleText.match(/\(([^)]+)\)/);
  if (dateMatch) {
    const rawDateRange = dateMatch[1];
    // 去除 .01~.09 的前導 0 (如 2026.03.24 -> 2026.3.24)
    const formattedDateRange = rawDateRange.replace(/\.0(\d)/g, '.$1');
    summaryTitle = `上周重大災情回顧 (${formattedDateRange})`;
  }

  let textOutput = summaryTitle + "\n\n";

  // 2. 組合各個災害的文字摘要與連結
  checkedDisasters.forEach(d => {
    // 優先從畫布卡片 DOM 中提取使用者可能即時修改過的最新內容
    const cardEl = document.getElementById(`slide-card-${d.id}`);
    let titleText = "";
    let descText = "";

    if (cardEl) {
      const titleEl = cardEl.querySelector(".slide-card-title-text");
      const bodyEl = cardEl.querySelector(".slide-card-body");
      if (titleEl) {
        titleText = titleEl.textContent.trim();
      }
      if (bodyEl) {
        descText = bodyEl.textContent.trim();
      }
    }

    // Fallback: 如果拿不到卡片，則使用原始物件資料重建
    if (!titleText) {
      const dateRange = formatDateRange(d.fromdate, d.todate, d.pubDate);
      const shortDate = dateRange.replace(/0(\d)/g, '$1').replace(/\s*~\s*/g, '-');
      const countryName = translateCountry(d.country);
      const catName = getCategoryInfo(d.type).name;
      titleText = `${shortDate} ${countryName} ${catName}`;
    }

    if (!descText) {
      descText = d.aiChineseDescription ? translateSimplifiedToTraditional(d.aiChineseDescription) : translateSimplifiedToTraditional(generateChineseDescription(d));
      descText = descText.replace(/<\/?[^>]+(>|$)/g, "").trim();
    }

    textOutput += `# ${titleText}\n${descText}\n`;

    // 3. 取得該災害的文獻/新聞檢索連結
    const refLinks = generateReferenceLinks(d);
    if (refLinks && refLinks.length > 0) {
      textOutput += "\n參考連結：\n";
      refLinks.forEach(ref => {
        textOutput += `- ${ref.title}: ${ref.url}\n`;
      });
    }

    textOutput += "\n";
  });

  textOutput = textOutput.trim();

  // 4. 複製至剪貼簿
  navigator.clipboard.writeText(textOutput).then(() => {
    showToast("已成功將選定災害文字摘要複製至剪貼簿！");
  }).catch(err => {
    console.error("複製文字摘要失敗:", err);
    alert("複製文字摘要失敗，請重試！");
  });
}

