// 離線模擬與快取備用數據，確保在網路代理失敗時仍有精美範例展示
const mockDisasters = [
  {
    id: "TC1001273",
    title: "Green notification for tropical cyclone AMANDA-26. Population affected by Category 1 (120 km/h) wind speeds or higher is 0",
    description: "From 02/06/2026 to 03/06/2026, a Tropical Storm (maximum wind speed of 93 km/h) AMANDA-26 was active in EastPacific. The cyclone affects these countries: [unknown]. Estimated population affected by category 1 wind speeds or higher is 0.",
    link: "https://www.gdacs.org/report.aspx?eventtype=TC&eventid=1001273",
    pubDate: "Wed, 03 Jun 2026 21:20:06 GMT",
    type: "TC",
    source: "GDACS",
    lat: 10.8,
    lng: -128.9,
    alertlevel: "Green",
    country: "East Pacific"
  },
  {
    id: "FL1103923",
    title: "Green flood alert in Italy",
    description: "On 02/06/2026, a flood started in Italy, lasting until 04/06/2026 (last update). The flood caused 0 deaths and 0 displaced.",
    link: "https://www.gdacs.org/report.aspx?eventtype=FL&eventid=1103923",
    pubDate: "Wed, 03 Jun 2026 08:05:52 GMT",
    type: "FL",
    source: "GDACS",
    lat: 45.5703694,
    lng: 9.7732524,
    alertlevel: "Green",
    country: "Italy"
  },
  {
    id: "EQ1544046",
    title: "Green earthquake (Magnitude 4.7M, Depth:161.24km) in Japan 03/06/2026 19:02 UTC",
    description: "On 6/3/2026 7:02:45 PM, an earthquake occurred in Japan potentially affecting Few people affected in 100km. The earthquake had Magnitude 4.7M, Depth:161.24km.",
    link: "https://www.gdacs.org/report.aspx?eventtype=EQ&eventid=1544046",
    pubDate: "Wed, 03 Jun 2026 19:46:42 GMT",
    type: "EQ",
    source: "GDACS",
    lat: 29.7153,
    lng: 129.4691,
    alertlevel: "Green",
    country: "Japan"
  },
  {
    id: "ERCC_Map_5683",
    title: "ECHO Daily Map of 03 June 2026",
    description: "Western and central Europe | Recent heatwave",
    link: "https://erccportal.jrc.ec.europa.eu/ECHOProducts//Maps#/maps/5683",
    pubDate: "Wed, 03 Jun 2026 18:42:51 GMT",
    type: "Heat Wave",
    source: "ERCC",
    lat: 48.5,
    lng: 10.0,
    alertlevel: "None",
    country: "Europe"
  },
  {
    id: "ERCC_Map_5677",
    title: "ECHO Daily Map of 29 May 2026",
    description: "Democratic Republic of the Congo, Uganda | Ebola Bundibugyo virus disease outbreak and EU response",
    link: "https://erccportal.jrc.ec.europa.eu/ECHOProducts//Maps#/maps/5677",
    pubDate: "Fri, 29 May 2026 17:51:45 GMT",
    type: "Epidemic",
    source: "ERCC",
    lat: -1.0,
    lng: 32.0,
    alertlevel: "None",
    country: "Congo, Uganda"
  },
  {
    id: "USGS_us7000lx99",
    title: "M 5.8 - 45km W of Petropavlovsk-Kamchatsky, Russia",
    description: "Time: 2026-06-03 12:45:00 UTC. Magnitude: 5.8. Depth: 60.5 km. Location: 45km W of Petropavlovsk-Kamchatsky, Russia. Ground shaking reported by residents.",
    link: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000lx99",
    pubDate: "Wed, 03 Jun 2026 12:45:00 GMT",
    type: "EQ",
    source: "USGS",
    lat: 53.03,
    lng: 158.05,
    alertlevel: "Orange",
    country: "Russia"
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mockDisasters };
}
