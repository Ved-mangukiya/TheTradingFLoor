/**
 * server/real_news_feed.js
 * Predefined Curated Financial News Timeline
 * Clean, structured news articles written in clear, accessible English.
 * Purely local, zero external scraping, 100% offline-ready.
 */

const PREDEFINED_NEWS_ARTICLES = [
  {
    id: "NEWS_DAY1_01",
    headline: "Reserve Bank of India Keeps Benchmark Interest Rates Steady at 6.50%",
    source: "Monetary Policy Review",
    publishedAt: new Date().toISOString(),
    publishedAtFormatted: "Today, Morning Session",
    summary: "The central bank maintained stable interest rates and announced ample liquidity for commercial lenders. Favorable for banking and NBFC stocks.",
    matchedTickers: ["HDFCBANK", "ICICIBANK", "SBIN"],
    sentiment: "BULLISH",
    sentimentScore: 0.85
  },
  {
    id: "NEWS_DAY1_02",
    headline: "Government Expands National Electric Vehicle and Component Manufacturing Subsidies",
    source: "Ministry of Heavy Industries",
    publishedAt: new Date().toISOString(),
    publishedAtFormatted: "Today, Mid-Day Session",
    summary: "New production-linked incentives were finalized for commercial vehicles, battery manufacturing, and passenger cars. Boosts domestic automakers.",
    matchedTickers: ["TATAMOTORS", "M&M", "MARUTI"],
    sentiment: "BULLISH",
    sentimentScore: 0.90
  },
  {
    id: "NEWS_DAY2_01",
    headline: "North American Enterprise Cloud Modernization Budgets Expand for Q3",
    source: "Global Technology Index",
    publishedAt: new Date().toISOString(),
    publishedAtFormatted: "Today, Enterprise Wire",
    summary: "Large US commercial banks and retail enterprises increased their multi-year digital transformation and cloud contracts with Indian tech leaders.",
    matchedTickers: ["TCS", "INFY", "WIPRO"],
    sentiment: "BULLISH",
    sentimentScore: 0.82
  },
  {
    id: "NEWS_DAY2_02",
    headline: "National Highway and Port Infrastructure Spending Accelerates with New Allocations",
    source: "Infrastructure Review",
    publishedAt: new Date().toISOString(),
    publishedAtFormatted: "Today, Industrial Wire",
    summary: "Capital expenditures for nationwide logistics corridors and industrial freight hubs were approved ahead of schedule.",
    matchedTickers: ["LT", "ULTRACEMCO"],
    sentiment: "BULLISH",
    sentimentScore: 0.78
  },
  {
    id: "NEWS_DAY3_01",
    headline: "US FDA Issues Zero-Observation Inspection Clearance for Domestic Generic Facilities",
    source: "Healthcare Regulatory Gazette",
    publishedAt: new Date().toISOString(),
    publishedAtFormatted: "Today, Pharma Dispatch",
    summary: "Clean regulatory inspection audits ensure uninterrupted export clearances of life-saving medicines and specialized generic formulations.",
    matchedTickers: ["SUNPHARMA", "CIPLA", "DRREDDY"],
    sentiment: "BULLISH",
    sentimentScore: 0.88
  },
  {
    id: "NEWS_DAY3_02",
    headline: "Festive Consumer Demand Spikes 18% Across Packaged Goods and Retail Networks",
    source: "Consumer Market Barometer",
    publishedAt: new Date().toISOString(),
    publishedAtFormatted: "Today, Retail Wire",
    summary: "Rural and urban retail spending showed resilient double-digit volume growth, boosting revenues for consumer goods companies.",
    matchedTickers: ["HINDUNILVR", "ITC", "NESTLEIND"],
    sentiment: "BULLISH",
    sentimentScore: 0.80
  }
];

class RealNewsFeed {
  constructor() {
    this.articles = PREDEFINED_NEWS_ARTICLES;
  }

  async fetchLiveNews() {
    return this.articles;
  }

  getArticles() {
    return this.articles;
  }

  getRecentArticles(limit = 10) {
    return this.articles.slice(0, limit);
  }

  getArticlesForTicker(ticker) {
    if (!ticker) return [];
    return this.articles.filter((a) => a.matchedTickers.includes(ticker));
  }

  getStats() {
    return {
      totalArticles: this.articles.length,
      lastSyncTime: new Date().toISOString(),
      cacheAgeMinutes: 0,
      isFresh: true,
      provider: "Predefined Financial News Engine"
    };
  }
}

module.exports = new RealNewsFeed();
