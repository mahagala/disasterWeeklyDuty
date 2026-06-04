/**
 * 坡洪組國際災情值周用全球災害資訊整合平台 - Core Application Logic
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

// --- 國家代碼與名稱中英對照表 (ISO3 / 常見英文名稱) ---
const COUNTRY_MAP = {
  // ISO-3 Codes
  "TWN": "台灣", "CHN": "中國", "JPN": "日本", "KOR": "韓國", "USA": "美國",
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
  "COLOMBIA": "哥聯比亞",
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
  "FL": { name: "洪災", cssClass: "cat-flood" },
  "TC": { name: "風災", cssClass: "cat-storm" },
  "DR": { name: "乾旱", cssClass: "cat-wildfire" },
  "VO": { name: "火山", cssClass: "cat-volcano" },
  "WF": { name: "野火", cssClass: "cat-wildfire" },
  "Wild fire": { name: "野火", cssClass: "cat-wildfire" },
  "Heat Wave": { name: "熱浪", cssClass: "cat-heat" },
  "Epidemic": { name: "傳染病", cssClass: "cat-epidemic" },
  "Severe Weather": { name: "強烈天氣", cssClass: "cat-storm" },
  "Tropical Cyclone": { name: "風災", cssClass: "cat-storm" },
  "Flood": { name: "洪災", cssClass: "cat-flood" },
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
  "TWN": "亞洲", "台灣": "亞洲", "TAIWAN": "亞洲",
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

// --- 國家 2 位 ISO 代碼對照表 (用於 Flagcdn 載入國旗圖片) ---
const ISO2_MAP = {
  "TWN": "tw", "台灣": "tw", "TAIWAN": "tw",
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

// 獲取國旗圖片 HTML (解決 Windows 無法顯示國旗 emoji 的問題)
function getCountryFlagImgHtml(country) {
  if (!country) return "";
  const iso2 = getCountryIso2(country);
  if (iso2) {
    return `<img src="https://flagcdn.com/w20/${iso2}.png" alt="${country}" class="flag-icon" style="height: 12px; width: auto; vertical-align: middle; margin-right: 6px; border: 1px solid rgba(255,255,255,0.15); border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">`;
  }
  return "";
}

// 獲取國旗 Emojis
function getCountryFlag(country) {
  if (!country) return "";
  const trimmed = country.trim().toUpperCase();
  
  if (FLAG_MAP[trimmed]) return FLAG_MAP[trimmed];
  
  const translated = translateCountry(country);
  if (FLAG_MAP[translated]) return FLAG_MAP[translated];
  
  for (let key in FLAG_MAP) {
    if (trimmed.includes(key.toUpperCase()) || translated.includes(key)) {
      return FLAG_MAP[key];
    }
  }
  
  return ""; 
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
    clockEl.textContent = now.toLocaleTimeString('zh-TW', { hour12: false });
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
    maxZoom: 15
  }).setView([20, 0], 2);

  // 載入 CartoDB Dark Matter 暗色系地圖瓦片 (非常有科技感且能突出彩色標記)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  markersGroup = L.layerGroup().addTo(map);
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
      // 設定預設起訖日 (起: 7天前，迄: 今天)
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      
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

  // 其他篩選器連動
  document.getElementById("alert-level").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-gdacs-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-ercc-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-usgs-chk").addEventListener("change", filterAndDisplayData);
  document.getElementById("source-reliefweb-chk").addEventListener("change", filterAndDisplayData);
  
  // 表格搜尋框
  document.getElementById("table-search").addEventListener("input", filterAndDisplayData);

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

  // 1. 下載 GDACS (並行下載 7天總覽, 3個月地震, 3個月風災, 3個月洪災)
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
        id: id || `GDACS_${Date.now()}_${Math.random()}`,
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
        id: id || `ERCC_${Date.now()}_${Math.random()}`,
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
        id: id || `USGS_${Date.now()}_${Math.random()}`,
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
      const id = `ReliefWeb_${item.id}`;
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

// 動態呼叫 OSM Nominatim 取得詳細中文地名 (含節流與快取)
async function enrichLocationsWithGeocoding() {
  const itemsToGeocode = allDisasters.filter(d => d.lat !== null && d.lng !== null && !d.chineseLocationDetail);
  if (itemsToGeocode.length === 0) return;

  console.log(`開始進行地理逆向編碼，共 ${itemsToGeocode.length} 筆資料...`);
  
  for (let i = 0; i < itemsToGeocode.length; i++) {
    const item = itemsToGeocode[i];
    const cacheKey = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
    
    if (geocodeCache[cacheKey]) {
      item.chineseLocationDetail = geocodeCache[cacheKey];
      continue;
    }

    // 遵守 Nominatim API 政策：每秒至多 1 次請求
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // 逆向地理編碼 API
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${item.lat}&lon=${item.lng}&zoom=8&accept-language=zh-TW`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DisasterReportHub/1.0 (johnson@gemini.local)'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.address) {
          const addr = data.address;
          const county = addr.county || addr.city || addr.state || "";
          const region = addr.suburb || addr.town || addr.village || "";
          
          let formattedLoc = "";
          if (county) formattedLoc += county;
          if (region) formattedLoc += " " + region;
          
          if (formattedLoc.trim() !== "") {
            geocodeCache[cacheKey] = formattedLoc.trim();
            item.chineseLocationDetail = formattedLoc.trim();
            
            // 寫入快取 LocalStorage
            localStorage.setItem("geocode_cache", JSON.stringify(geocodeCache));
            
            // 每次成功解析就小幅度重新整理表格，增加流暢度
            renderTableOnly();
          }
        }
      }
    } catch (e) {
      console.warn("地理逆向編碼查詢失敗:", e);
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

  // 1. 如果是 GDACS，進行範本規則剖析
  if (disaster.source === "GDACS") {
    const desc = disaster.description || "";
    
    // 地震範本解析
    if (disaster.type === "EQ") {
      const magMatch = desc.match(/Magnitude\s*([0-9.]+M?)/i);
      const depthMatch = desc.match(/Depth:\s*([0-9.]+km)/i);
      const popMatch = desc.match(/potentially affecting\s*([0-9.\w\s]+)\s*in/i);
      
      const mag = magMatch ? magMatch[1] : "未知規模";
      const depth = depthMatch ? depthMatch[1].replace("Depth:", "") : "未知深度";
      const pop = popMatch ? translatePopText(popMatch[1]) : "少數人口";

      return `${dateStr}，在${countryCn}發生規模 ${mag} 地震，震源深度為 ${depth}，預計對周邊 100 公里內約 ${pop} 造成潛在影響。`;
    }
    
    // 洪水範本解析
    if (disaster.type === "FL") {
      const deathMatch = desc.match(/caused\s*(\d+)\s*deaths/i);
      const dispMatch = desc.match(/(\d+)\s*displaced/i);
      
      const deaths = deathMatch ? deathMatch[1] : "0";
      const displaced = dispMatch ? dispMatch[1] : "0";

      return `自 ${dateStr} 起，${countryCn}爆發洪淹災害。截至目前最新通報，此災害已造成 ${deaths} 人死亡、${displaced} 人撤離流離失所。`;
    }

    // 風災 (熱帶氣旋) 範本解析
    if (disaster.type === "TC") {
      const windMatch = desc.match(/maximum wind speed of\s*(\d+\s*km\/h)/i);
      const wind = windMatch ? windMatch[1] : "";
      const nameMatch = disaster.title.match(/tropical cyclone\s*([\w\d\-]+)/i) || disaster.title.match(/cyclone\s*([\w\d\-]+)/i);
      const nameStr = nameMatch ? `「${nameMatch[1]}」` : "";

      return `監測顯示，${dateStr} 期間熱帶風暴/氣旋 ${nameStr}持續活躍中${wind ? `（最大風速達 ${wind}）` : ""}，正波及${countryCn}等鄰近地區，請密切注意風雨威脅。`;
    }

    // 乾旱範本解析
    if (disaster.type === "DR") {
      const severityMatch = desc.match(/severity value\s*([0-9.]+)/i) || desc.match(/level is\s*(\w+)/i);
      const sev = severityMatch ? "輕度至中度影響" : "警報發布";
      return `目前在${countryCn}部分地區正遭遇持續乾旱危機，農業與水資源受到衝擊，警報等級為${disaster.alertlevel === "Green" ? "綠色警報" : "橙/紅色警戒"}。`;
    }
  }

  // 2. 如果是 ERCC (一般地圖說明)
  if (disaster.source === "ERCC") {
    const desc = disaster.description || "";
    // ERCC description 常為 "Western and central Europe | Recent heatwave"
    if (desc.includes("|")) {
      const parts = desc.split("|").map(p => p.trim());
      const region = translateCountry(parts[0]);
      const event = translateEventEnglishToCn(parts[1]);
      return `歐盟應急響應協調中心 (ERCC) 發布每日最新形勢地圖：監測顯示${region}近期正受到【${event}】事件影響，歐盟已啟動人道應變或 civil protection 資訊整合。`;
    }
    return `歐盟應急中心發布最新監測地圖：${desc}。此地圖與歐盟人道救援、民防應變及防範災害後續衝擊相關。`;
  }

  // 3. 如果是 USGS 地震
  if (disaster.source === "USGS") {
    const title = disaster.title || "";
    // title format: "M 5.8 - 45km W of Petropavlovsk-Kamchatsky, Russia"
    const magMatch = title.match(/M\s*([0-9.]+)/i);
    const locMatch = title.split(" - ");
    const locStr = locMatch.length > 1 ? locMatch[1] : "全球震區";
    return `${dateStr}，全球地震監測網 (USGS) 錄得${countryCn}周邊（${locStr}）發生芮氏規模 ${magMatch ? magMatch[1] : "4.5"} 的中強震。`;
  }

  // 4. 如果是 ReliefWeb 
  if (disaster.source === "ReliefWeb") {
    return `聯合國人道事務協調廳 (ReliefWeb) 發布最新形勢報告：針對${countryCn}地區之【${disaster.type}】危機提供即時評估，目前正密切關注災情動態與國際人道救援應對措施。`;
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

// 輔助翻譯：一般事件名英翻中
function translateEventEnglishToCn(evtEng) {
  const dict = {
    "Recent heatwave": "近期熱浪",
    "Heatwave": "熱浪",
    "Wildfires": "野火",
    "Wild fire": "野火",
    "Forest Firefighting": "森林消防準備",
    "Monsoon season": "季風雨季預防",
    "Ebola": "伊波拉病毒疫情",
    "Epidemic": "傳染病爆發",
    "Flood": "洪災",
    "Tropical Cyclone": "熱帶氣旋"
  };
  return dict[evtEng] || evtEng;
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
  const countryName = translateCountry(disaster.country);
  const typeInfo = getCategoryInfo(disaster.type);
  const queryText = encodeURIComponent(`${countryName} ${typeInfo.name} 2026`);

  // Google News 即時搜尋連結
  links.push({
    title: `Google 新聞搜尋 (${typeInfo.name})`,
    url: `https://news.google.com/search?q=${queryText}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`
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
    descContainer.innerHTML = `<span class="spinner" style="width:12px; height:12px; display:inline-block; margin-right:6px; vertical-align:middle;"></span>正在利用 Gemini AI 翻譯中...`;

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
    descContainer.innerHTML = `
      ${disaster.alertlevel && disaster.alertlevel !== "None" ? 
        `<span class="desc-alert-badge ${disaster.alertlevel.toLowerCase()}">${disaster.alertlevel} Alert</span>` : ''}
      <span class="desc-text">${resultText}</span>
      <span class="desc-ai-generated">✦ AI 智慧生成繁中摘要</span>
    `;

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
  const alertLevelVal = document.getElementById("alert-level").value;
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
    startDate.setDate(now.getDate() - days);
    endDate = now;
  }

  // 執行篩選
  const filteredDisasters = allDisasters.filter(d => {
    // 1. 篩選資料來源
    if (d.source === "GDACS" && !gdacsChk) return false;
    if (d.source === "ERCC" && !erccChk) return false;
    if (d.source === "USGS" && !usgsChk) return false;
    if (d.source === "ReliefWeb" && !reliefwebChk) return false;

    // 2. 篩選警報等級
    if (alertLevelVal !== "all" && d.alertlevel !== alertLevelVal) return false;

    // 3. 篩選時間區段 (比對最新通報時間與災害實際結束時間)
    const itemDate = new Date(d.pubDate);
    if (isNaN(itemDate.getTime())) return false; // 無效日期過濾掉

    // 如果災害有明確的結束日期 (todate)，且該結束日期小於篩選的起始時間 (startDate)，
    // 代表此災害事件在篩選時間之前就已經完全結束了，直接過濾掉（不屬於過去 7/14/30 天的活躍災害）
    if (d.todate) {
      const itemToDate = new Date(d.todate);
      if (!isNaN(itemToDate.getTime()) && startDate && itemToDate < startDate) {
        return false;
      }
    }

    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;

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

// --- 渲染數據表格 ---
function renderTable(disasters) {
  const tableBody = document.getElementById("disaster-table-body");
  const summaryText = document.getElementById("table-summary-text");

  if (disasters.length === 0) {
    summaryText.textContent = "找到 0 筆符合條件的災害事件。";
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">
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
    
    const countryCn = translateCountry(d.country);
    const flagImg = getCountryFlagImgHtml(d.country);
    const continent = getCountryContinent(d.country);
    
    // 格式為：國旗 洲 國名 (無括弧)
    const countryLabel = flagImg ? `${flagImg} ${continent} ${countryCn}` : `${continent} ${countryCn}`;
    
    const dmsLat = convertDecimalToDMS(d.lat, true);
    const dmsLng = convertDecimalToDMS(d.lng, false);
    
    // Nominatim 逆編碼獲得的詳細地址 (如果存在)
    const detailLocStr = d.chineseLocationDetail ? `<div class="loc-details">${d.chineseLocationDetail}</div>` : '';
    
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
    
    if (d.aiChineseDescription) {
      descCell.innerHTML = `
        ${alertBadge}
        <span class="desc-text">${d.aiChineseDescription}</span>
        <span class="desc-ai-generated">✦ AI 智慧生成繁中摘要</span>
      `;
    } else {
      descCell.innerHTML = `
        ${alertBadge}
        <span class="desc-text">${fallbackDescText}</span>
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
    else if (catName === "洪災") fillClass = "green-fill";
    else if (catName === "風災") fillClass = "orange-fill";
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
  const headers = ["日期", "國家", "詳細地點", "經度", "緯度", "災害類別", "警報等級", "災害說明說明", "官方連結"];
  
  const csvRows = [headers.join(",")];

  // 遍歷當前載入的資料
  allDisasters.forEach(d => {
    const dateStr = formatDateRange(d.fromdate, d.todate, d.pubDate);
    const flag = getCountryFlag(d.country);
    const continent = getCountryContinent(d.country);
    const countryCn = translateCountry(d.country);
    const country = flag ? `${flag} ${continent} ${countryCn}` : `${continent} ${countryCn}`;
    const details = d.chineseLocationDetail || "";
    const lat = d.lat || "";
    const lng = d.lng || "";
    const category = getCategoryInfo(d.type).name;
    const level = d.alertlevel || "None";
    const desc = (d.aiChineseDescription || generateChineseDescription(d)).replace(/"/g, '""'); // CSV 跳脫雙引號
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
