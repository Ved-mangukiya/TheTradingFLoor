/**
 * THE TRADING FLOOR CHAMPIONSHIP PLATFORM
 * REAL-WORLD LIVE FINANCIAL NEWS INTEGRATION ENGINE (server/real_news_feed.js)
 *
 * Fetches, parses, deduplicates, and caches genuine live financial news
 * from official market feeds (Google News Financial RSS / NSE Feeds / Configured APIs),
 * preserving genuine publisher sources, publication timestamps, and external URLs.
 *
 * Offline-First & Resilient:
 * When online, fetches and refreshes genuine market news every 15 minutes.
 * When offline, serves verified cached real-world news from data/real_news_cache.json
 * with clear indicators of cache age, never fabricating live timestamps.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'real_news_cache.json');

// Canonical Indian Equities Ticker & Keyword Mapping
const TICKER_KEYWORDS = {
  RELIANCE: ['reliance', 'ril', 'jio', 'mukesh ambani'],
  TATAMOTORS: ['tata motors', 'tatamotors', 'jlr', 'jaguar land rover', 'tata commercial vehicles'],
  TCS: ['tcs', 'tata consultancy services', 'tata consultancy'],
  HDFCBANK: ['hdfc bank', 'hdfcbank', 'hdfc'],
  ICICIBANK: ['icici bank', 'icicibank', 'icici'],
  SBIN: ['state bank of india', 'sbi', 'sbin'],
  INFY: ['infosys', 'infy', 'salil parekh'],
  LT: ['larsen & toubro', 'larsen and toubro', 'l&t'],
  AIRTEL: ['bharti airtel', 'airtel', 'sunil mittal'],
  ITC: ['itc limited', 'itc ltd', 'itc hotels'],
  MARUTI: ['maruti suzuki', 'maruti'],
  AXISBANK: ['axis bank', 'axisbank'],
  KOTAKBANK: ['kotak mahindra', 'kotak bank'],
  WIPRO: ['wipro'],
  HCLTECH: ['hcl tech', 'hcl technologies'],
  SUNPHARMA: ['sun pharma', 'sun pharmaceutical'],
  TITAN: ['titan company', 'titan watches', 'tanishq'],
  BAJFINANCE: ['bajaj finance', 'bajaj finserv'],
  ADANIENT: ['adani enterprises', 'adani group', 'gautam adani'],
  ADANIPORTS: ['adani ports', 'mundra port']
};

// Positive / Negative Financial Sentiment Lexicon
const BULLISH_KEYWORDS = [
  'profit jumps', 'profit surges', 'rally', 'rallies', 'soars', 'surges', 'beats estimates',
  'strong earnings', 'revenue rises', 'growth accelerates', 'upgrade', 'outperform',
  'order win', 'mega contract', 'dividend', 'expansion', 'buy rating', 'record high',
  'bullish', 'gainers', 'climbs', 'jumps', 'advances', 'positive outlook'
];

const BEARISH_KEYWORDS = [
  'profit drops', 'profit plunges', 'slumps', 'plunges', 'declines', 'misses estimates',
  'revenue falls', 'losses widen', 'downgrade', 'underperform', 'probe', 'investigation',
  'regulatory fine', 'penalty', 'audit scrutiny', 'selloff', 'drags', 'bearish',
  'losers', 'tumbles', 'falls', 'weak demand', 'supply friction', 'inflation pressure'
];

let cachedNewsData = {
  status: 'INITIALIZING',
  lastSyncTime: null,
  isOfflineCached: false,
  provider: 'None',
  articles: []
};

// Load existing disk cache on startup
function loadCacheFromDisk() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.articles)) {
        cachedNewsData = {
          status: 'OFFLINE_CACHED',
          lastSyncTime: data.lastSyncTime || null,
          isOfflineCached: true,
          provider: data.provider || 'Disk Cache',
          articles: data.articles
        };
        logger.info('REAL NEWS', `Loaded ${data.articles.length} verified real-world news articles from disk cache.`);
        return true;
      }
    } catch (err) {
      logger.warn('NEWS CACHE', 'Could not read real-world news cache file.', null, err);
    }
  }
  return false;
}

// Save verified articles to disk cache
function saveCacheToDisk(articles, providerName = 'Official Financial RSS') {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      lastSyncTime: new Date().toISOString(),
      provider: providerName,
      count: articles.length,
      articles
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    logger.warn('NEWS CACHE', 'Could not persist real news cache to disk.', null, err);
  }
}

// Clean and decode HTML entities from text
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '') // Strip embedded HTML tags
    .trim();
}

// Determine sentiment score (-1 to +1) based on headline vocabulary
function calculateSentiment(text) {
  const lower = text.toLowerCase();
  let bullCount = 0;
  let bearCount = 0;

  BULLISH_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw)) bullCount++;
  });
  BEARISH_KEYWORDS.forEach((kw) => {
    if (lower.includes(kw)) bearCount++;
  });

  if (bullCount > bearCount) return { sentiment: 'BULLISH', score: Math.min(1.0, 0.35 + bullCount * 0.25) };
  if (bearCount > bullCount) return { sentiment: 'BEARISH', score: Math.max(-1.0, -(0.35 + bearCount * 0.25)) };
  return { sentiment: 'NEUTRAL', score: 0 };
}

// Identify active stock tickers referenced in the news headline or summary
function matchTickers(text) {
  const lower = text.toLowerCase();
  const matched = [];

  Object.entries(TICKER_KEYWORDS).forEach(([ticker, keywords]) => {
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      // Match whole word or exact token
      const pattern = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i');
      if (pattern.test(lower)) {
        matched.push(ticker);
        break;
      }
    }
  });

  return matched;
}

/**
 * Parses XML RSS feed without third-party dependencies
 */
function parseRssFeed(xmlText) {
  const articles = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(itemXml);
    const pubDateMatch = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(itemXml);
    const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(itemXml);
    const linkMatch = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(itemXml);
    const descMatch = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(itemXml);

    let rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
    if (!rawTitle) continue;

    let source = sourceMatch ? decodeHtmlEntities(sourceMatch[1]) : '';
    if (!source && rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      source = parts.pop().trim();
      rawTitle = parts.join(' - ').trim();
    }
    if (!source) source = 'Financial Wire';

    let publishedAt = null;
    let publishedAtFormatted = 'Recent';
    if (pubDateMatch) {
      try {
        const d = new Date(pubDateMatch[1]);
        if (!isNaN(d.getTime())) {
          publishedAt = d.toISOString();
          publishedAtFormatted = d.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Kolkata'
          });
        }
      } catch (e) {}
    }

    const link = linkMatch ? linkMatch[1].trim() : '';
    const summary = descMatch ? decodeHtmlEntities(descMatch[1]).slice(0, 240) : '';

    const matchedTickers = matchTickers(rawTitle + ' ' + summary);
    const { sentiment, score } = calculateSentiment(rawTitle);

    articles.push({
      id: 'NEWS_' + Math.abs(hashCode(link || rawTitle)),
      headline: rawTitle,
      source,
      publishedAt,
      publishedAtFormatted,
      summary,
      url: link,
      matchedTickers,
      sentiment,
      sentimentScore: score,
      fetchedAt: new Date().toISOString()
    });
  }

  return articles;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Deduplicate articles by normalized headline similarity
 */
function deduplicateArticles(articles) {
  const seen = new Set();
  const result = [];

  articles.forEach((art) => {
    const key = art.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(art);
    }
  });

  return result;
}

/**
 * Primary Real-World News Fetcher
 * Queries Google News Financial RSS / Configured Endpoint
 */
async function fetchRealWorldNews(forceRefresh = false) {
  // If we fetched within the last 5 minutes and not forcing, return memory cache
  const fiveMinutesMs = 5 * 60 * 1000;
  if (!forceRefresh && cachedNewsData.lastSyncTime && Date.now() - new Date(cachedNewsData.lastSyncTime).getTime() < fiveMinutesMs) {
    return cachedNewsData;
  }

  const endpointUrl = process.env.NEWS_API_URL || 'https://news.google.com/rss/search?q=NSE+Nifty+Sensex+stocks+India&hl=en-IN&gl=IN&ceid=IN:en';
  const customHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8'
  };

  if (process.env.NEWS_API_KEY) {
    customHeaders['Authorization'] = `Bearer ${process.env.NEWS_API_KEY}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s network timeout

    const res = await fetch(endpointUrl, {
      headers: customHeaders,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const xmlText = await res.text();
    const rawArticles = parseRssFeed(xmlText);
    const deduped = deduplicateArticles(rawArticles);

    if (deduped.length > 0) {
      cachedNewsData = {
        status: 'ONLINE',
        lastSyncTime: new Date().toISOString(),
        isOfflineCached: false,
        provider: process.env.NEWS_API_URL ? 'Custom Market API' : 'Google News Official Financial RSS',
        articles: deduped
      };
      saveCacheToDisk(deduped, cachedNewsData.provider);
      logger.success('REAL NEWS', `Synchronized ${deduped.length} genuine financial news articles.`);
      return cachedNewsData;
    } else {
      throw new Error('Received 0 articles from market feed.');
    }
  } catch (err) {
    logger.warn('REAL NEWS OFFLINE', `Could not reach live news provider (${err.message}). Using verified local cache.`);
    // Fall back to disk cache if available
    if (loadCacheFromDisk()) {
      return cachedNewsData;
    }

    cachedNewsData = {
      status: 'UNAVAILABLE',
      lastSyncTime: null,
      isOfflineCached: false,
      provider: 'None',
      error: err.message,
      articles: []
    };
    return cachedNewsData;
  }
}

/**
 * Returns current news cache state immediately (non-blocking)
 */
function getRealWorldNews() {
  return cachedNewsData;
}

/**
 * Converts a genuine real-world news item into an in-game market shock event
 */
function createMarketEventFromRealNews(article, targetTicker, shockPct = 5.0, durationSec = 45) {
  if (!article || !targetTicker) return null;
  const eventId = `EVT_REAL_${Date.now()}`;
  return {
    event_id: eventId,
    type: 'REAL_WORLD_NEWS',
    headline: article.headline,
    source: article.source,
    published_at: article.publishedAt,
    published_at_formatted: article.publishedAtFormatted,
    url: article.url,
    summary: article.summary,
    simple_explanation: `Genuine market news report from ${article.source} (${article.publishedAtFormatted || 'Recent'}). Affects ${targetTicker}.`,
    is_real_world: true,
    impacts: {
      [targetTicker]: {
        delta_pct: parseFloat(shockPct) || 5.0,
        duration_sec: parseInt(durationSec, 10) || 45
      }
    }
  };
}

// Background Auto-Sync Worker (runs every 15 minutes)
let syncIntervalHandle = null;
function startAutoNewsSync(intervalMinutes = 15) {
  if (syncIntervalHandle) clearInterval(syncIntervalHandle);
  // Initial fetch on startup
  fetchRealWorldNews().catch(() => {});
  syncIntervalHandle = setInterval(() => {
    fetchRealWorldNews(true).catch(() => {});
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  fetchRealWorldNews,
  getRealWorldNews,
  createMarketEventFromRealNews,
  startAutoNewsSync,
  loadCacheFromDisk
};
