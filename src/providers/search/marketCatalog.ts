export interface DirectSearchSource {
  id: string;
  label: string;
  group: "core_marketplace" | "price_aggregator" | "fishing_store_ua" | "jdm_international";
  priority: number;
  searchUrl: (query: string) => string;
}

export const UKRAINIAN_DIRECT_SEARCH_SOURCES: DirectSearchSource[] = [
  {
    id: "olx",
    label: "OLX Ukraine",
    group: "core_marketplace",
    priority: 1,
    searchUrl: (query) => `https://www.olx.ua/uk/list/q-${slugifyForOlx(query)}/`
  },
  {
    id: "rozetka",
    label: "Rozetka",
    group: "core_marketplace",
    priority: 2,
    searchUrl: (query) => `https://rozetka.com.ua/ua/search/?text=${encodeURIComponent(query)}`
  },
  {
    id: "prom",
    label: "Prom.ua",
    group: "core_marketplace",
    priority: 3,
    searchUrl: (query) => `https://prom.ua/ua/search?search_term=${encodeURIComponent(query)}`
  },
  {
    id: "epicentr",
    label: "Epicentr",
    group: "core_marketplace",
    priority: 4,
    searchUrl: (query) => `https://epicentrk.ua/ua/search/?q=${encodeURIComponent(query)}`
  },
  {
    id: "bigl",
    label: "Bigl.ua",
    group: "core_marketplace",
    priority: 5,
    searchUrl: (query) => `https://bigl.ua/ua/search?search_term=${encodeURIComponent(query)}`
  },
  {
    id: "allo",
    label: "Allo",
    group: "core_marketplace",
    priority: 6,
    searchUrl: (query) => `https://allo.ua/ua/catalogsearch/result/?q=${encodeURIComponent(query)}`
  },
  {
    id: "hotline",
    label: "Hotline",
    group: "price_aggregator",
    priority: 7,
    searchUrl: (query) => `https://hotline.ua/ua/sr/?q=${encodeURIComponent(query)}`
  },
  {
    id: "ek",
    label: "E-Katalog",
    group: "price_aggregator",
    priority: 8,
    searchUrl: (query) => `https://ek.ua/ua/ek-list.php?search_=${encodeURIComponent(query)}&search_but_=`
  },
  {
    id: "price",
    label: "Price.ua",
    group: "price_aggregator",
    priority: 9,
    searchUrl: (query) => `https://price.ua/search/?q=${encodeURIComponent(query)}`
  },
  {
    id: "flagman",
    label: "Flagman",
    group: "fishing_store_ua",
    priority: 10,
    searchUrl: (query) => `https://flagman.ua/search/${encodeURIComponent(query)}`
  },
  {
    id: "ibis",
    label: "IBIS Gear",
    group: "fishing_store_ua",
    priority: 11,
    searchUrl: (query) => `https://ibis-gear.com/search/?searchstring=${encodeURIComponent(query)}`
  },
  {
    id: "fish-fish",
    label: "Fish-Fish",
    group: "fishing_store_ua",
    priority: 12,
    searchUrl: (query) => `https://fish-fish.com.ua/ua-search?search=${encodeURIComponent(query)}`
  },
  {
    id: "shimano-kiev",
    label: "Shimano Kiev",
    group: "fishing_store_ua",
    priority: 13,
    searchUrl: (query) => `https://shimano.kiev.ua/search?q=${encodeURIComponent(query)}`
  },
  {
    id: "daiwa-ua",
    label: "Daiwa Ukraine",
    group: "fishing_store_ua",
    priority: 14,
    searchUrl: (query) => `https://daiwa.in.ua/ua/index.php?route=product/search&search=${encodeURIComponent(query)}`
  },
  {
    id: "zabros",
    label: "Zabros",
    group: "fishing_store_ua",
    priority: 15,
    searchUrl: (query) => `https://zabros.com.ua/ua/search/?q=${encodeURIComponent(query)}`
  },
  {
    id: "fanatik",
    label: "Fanatik",
    group: "fishing_store_ua",
    priority: 16,
    searchUrl: (query) => `https://fanatik.com.ua/ua/search/?search=${encodeURIComponent(query)}`
  },
  {
    id: "aquatory",
    label: "Aquatory",
    group: "fishing_store_ua",
    priority: 17,
    searchUrl: (query) => `https://aquatory.com.ua/ua/search/?search=${encodeURIComponent(query)}`
  },
  {
    id: "onlyfishing",
    label: "Only Fishing",
    group: "fishing_store_ua",
    priority: 18,
    searchUrl: (query) => `https://onlyfishing.com.ua/search/?search=${encodeURIComponent(query)}`
  },
  {
    id: "jdm-com-ua",
    label: "JDM Ukraine",
    group: "fishing_store_ua",
    priority: 19,
    searchUrl: (query) => `https://jdm.com.ua/search?search=${encodeURIComponent(query)}`
  }
];

export const JDM_DIRECT_SEARCH_SOURCES: DirectSearchSource[] = [
  {
    id: "zenmarket",
    label: "ZenMarket",
    group: "jdm_international",
    priority: 101,
    searchUrl: (query) => `https://zenmarket.jp/en/search.aspx?q=${encodeURIComponent(query)}`
  },
  {
    id: "digitaka",
    label: "Digitaka",
    group: "jdm_international",
    priority: 102,
    searchUrl: (query) => `https://www.digitaka.com/list.php?keywords=${encodeURIComponent(query)}`
  },
  {
    id: "japantackle",
    label: "JapanTackle",
    group: "jdm_international",
    priority: 103,
    searchUrl: (query) => `https://japantackle.com/catalogsearch/result/?q=${encodeURIComponent(query)}`
  },
  {
    id: "jdmtackleheaven",
    label: "JDM Tackle Heaven",
    group: "jdm_international",
    priority: 104,
    searchUrl: (query) => `https://jdmtackleheaven.com/search?q=${encodeURIComponent(query)}`
  },
  {
    id: "ebay",
    label: "eBay",
    group: "jdm_international",
    priority: 105,
    searchUrl: (query) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`
  }
];

export function normalizeDirectSearchQuery(query: string): string {
  return query
    .replace(/\bOR\b/gi, " ")
    .replace(/\bsite:\S+/gi, " ")
    .replace(/\b(japan|japanese|jdm|used|for sale|price|buy)\b/gi, " ")
    .replace(/\b(olx|rozetka|prom|hotline)\b/gi, " ")
    .replace(/(^|\s)(купити|ціна|україна|наявності)(?=\s|$)/giu, " ")
    .replace(/(^|\s)б\/в(?=\s|$)/giu, " ")
    .replace(/中古|釣竿|ロッド|ヤフオク|メルカリ|楽天/gu, " ")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyForOlx(query: string): string {
  return normalizeDirectSearchQuery(query)
    .toLowerCase()
    .replace(/[^a-zа-яіїєґё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "");
}
