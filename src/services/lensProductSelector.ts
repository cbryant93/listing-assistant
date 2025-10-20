/**
 * Smart product page selector for Google Lens visual matches
 * Filters out marketplaces, prefers real retailers, ranks by relevance
 */

export type LensMatch = {
  title?: string;
  link?: string;
  source?: string;
  thumbnail?: string;
  position?: number;
  price?: string | number;
  currency?: string;
};

// Marketplaces to deprioritize (unless no retailers found)
const MARKETPLACES = [
  "ebay.", "poshmark.", "depop.", "vinted.", "grailed.", "etsy.", "pinterest.",
  "amazon.", "facebook.", "instagram.",
];

// Preferred UK/US retailers
const RETAILER_PREFER = [
  // UK department stores
  "johnlewis.", "marksandspencer.", "selfridges.", "harrods.", "houseoffraser.",
  "debenhams.", "next.co.uk", "very.co.uk",

  // UK fashion retailers
  "asos.", "boohoo.", "prettylittlething.", "misguided.", "topshop.", "topman.",
  "newlook.", "riverisland.", "zara.", "hm.com", "cosstores.", "arket.",

  // Sports & streetwear
  "nike.", "adidas.", "jdsports.", "footlocker.", "sportsdirect.", "size.",
  "flannels.", "endclothing.", "offspring.", "schuh.", "office.",

  // US/Global retailers
  "urbanoutfitters.", "anthropologie.", "freepeople.", "nordstrom.", "macys.",
  "bloomingdales.", "gap.", "bananarepublic.", "oldnavy.", "uniqlo.", "zalando.",

  // Workwear/outdoor brands
  "dickies.", "carhartt.", "levi.", "wrangler.", "levis.", "timberland.",
  "northface.", "patagonia.", "columbia.",
];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isMarketplace(host: string): boolean {
  return MARKETPLACES.some(m => host.includes(m));
}

function isPreferredRetailer(host: string): boolean {
  return RETAILER_PREFER.some(r => host.includes(r));
}

/**
 * De-duplicate matches by domain + normalized title
 */
function dedupe(matches: LensMatch[]): LensMatch[] {
  const seen = new Set<string>();
  const out: LensMatch[] = [];

  for (const m of matches) {
    if (!m.link || !m.title) continue;

    // Normalize title: lowercase, collapse whitespace
    const normalizedTitle = m.title.toLowerCase().replace(/\s+/g, " ").trim();
    const key = `${domainOf(m.link)}|${normalizedTitle}`;

    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }

  return out;
}

/**
 * Score a match for relevance (higher = better)
 */
function scoreMatch(m: LensMatch, brandHint?: string): number {
  const host = domainOf(m.link ?? "");
  let score = 0;

  // 1. Prefer retailers over marketplaces
  if (isMarketplace(host)) {
    score -= 0.5;
  }
  if (isPreferredRetailer(host)) {
    score += 0.8;
  }

  // 2. Brand/domain hint
  if (brandHint) {
    const brandLower = brandHint.toLowerCase();
    if (host.includes(brandLower)) {
      score += 0.7;
    }
    if ((m.title || "").toLowerCase().includes(brandLower)) {
      score += 0.2;
    }
  }

  // 3. Title length heuristic (short titles = product detail pages)
  const titleLen = (m.title || "").length;
  if (titleLen > 0 && titleLen < 90) {
    score += 0.1;
  }

  // 4. Position from Lens (earlier = usually better)
  if (typeof m.position === "number") {
    score += Math.max(0, 0.2 - (m.position * 0.01));
  }

  // 5. UK bias (GBP prices, .co.uk domains)
  if ((m.title || "").toLowerCase().includes("£")) {
    score += 0.1;
  }
  if (host.endsWith(".co.uk")) {
    score += 0.2;
  }

  // 6. Has price = likely product page
  if (m.price) {
    score += 0.15;
  }

  return score;
}

/**
 * Pick top product pages from Google Lens visual matches
 *
 * Strategy:
 * 1. De-duplicate by domain + title
 * 2. Score each match (retailers > marketplaces, brand match, UK bias, etc.)
 * 3. Prefer retailers; only include marketplaces if no retailers found
 * 4. Return top N results
 *
 * @param visualMatches Raw visual_matches array from Google Lens
 * @param opts Options: brand hint, max results
 * @returns Top product pages, ranked by relevance
 */
export function pickProductPagesFromLens(
  visualMatches: LensMatch[],
  opts?: { brand?: string; take?: number }
): LensMatch[] {
  const { brand, take = 5 } = opts ?? {};

  // Clean: remove invalid matches and de-dupe
  const cleaned = dedupe(visualMatches).filter(m => m.link && m.title);

  // Rank by score
  const ranked = cleaned
    .map(m => ({ m, score: scoreMatch(m, brand) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.m);

  // Prefer retailers; if none found, include marketplaces as fallback
  const retailers = ranked.filter(m => !isMarketplace(domainOf(m.link!)));
  const final = retailers.length > 0 ? retailers : ranked;

  return final.slice(0, take);
}

/**
 * Get best retailer URL for scraping
 * Returns the top-ranked non-marketplace result
 */
export function getBestRetailerUrl(
  visualMatches: LensMatch[],
  brand?: string
): string | null {
  const topPages = pickProductPagesFromLens(visualMatches, { brand, take: 1 });
  return topPages[0]?.link || null;
}
