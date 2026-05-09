import Parser from 'rss-parser';
import { NormalizedArticle } from '../schemas';
import { randomUUID } from 'crypto';

interface RssFeedConfig {
  url: string;
  name: string;
  weight: number;
}

const DEFAULT_FEEDS: RssFeedConfig[] = [
  { url: 'https://feeds.feedburner.com/zerohedge/feed', name: 'ZeroHedge', weight: 3 },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', weight: 2 },
  { url: 'https://theblock.co/rss.xml', name: 'TheBlock', weight: 2 },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', name: 'MarketWatch', weight: 2 },
  { url: 'https://finance.yahoo.com/news/rssindex', name: 'YahooFinance', weight: 2 },
  { url: 'https://www.forexlive.com/feed/news', name: 'ForexLive', weight: 2 },
  { url: 'https://blockworks.co/feed', name: 'Blockworks', weight: 2 },
  { url: 'https://dlnews.com/feed/', name: 'DLNews', weight: 2 },
];

function getFeeds(): RssFeedConfig[] {
  const override = process.env.RSS_FEEDS_JSON;
  if (override) {
    try {
      return JSON.parse(override);
    } catch {
      console.warn('[rss] RSS_FEEDS_JSON parse failed, using defaults');
    }
  }
  return DEFAULT_FEEDS;
}

async function fetchFeed(
  parser: Parser,
  config: RssFeedConfig,
  maxAgeHours = 8
): Promise<NormalizedArticle[]> {
  try {
    const feed = await parser.parseURL(config.url);
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    return (feed.items ?? [])
      .filter((item) => {
        const pub = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
        return pub > cutoff;
      })
      .slice(0, 15)
      .map((item) => ({
        id: randomUUID(),
        title: item.title ?? '',
        content: (item.contentSnippet ?? item.content ?? item.summary ?? '').slice(0, 1200),
        url: item.link ?? '',
        publishedAt: item.pubDate ?? new Date().toISOString(),
        source: config.name,
        sourceType: 'rss' as const,
      }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[rss] Failed to fetch ${config.name}: ${msg}`);
    return [];
  }
}

export async function fetchRssArticles(): Promise<NormalizedArticle[]> {
  const parser = new Parser({ timeout: 10000 });
  const feeds = getFeeds();

  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(parser, f)));

  const articles: NormalizedArticle[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }

  console.log(`[rss] Fetched ${articles.length} articles from ${feeds.length} feeds`);
  return articles;
}
