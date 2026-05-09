import { NormalizedArticle } from '../schemas';
import { fetchRssArticles } from './rss-fetcher';
import { fetchFmpNews } from './fmp-news-fetcher';

export interface SourceResult {
  articles: NormalizedArticle[];
  leadImage: string | null;
}

export async function fetchAllSources(): Promise<SourceResult> {
  console.log('[orchestrator] Fetching all sources in parallel...');

  const [fmpResult, rssArticles] = await Promise.all([
    fetchFmpNews(8),
    fetchRssArticles(),
  ]);

  const all = [...fmpResult.articles, ...rssArticles];

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = all.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`[orchestrator] ${deduped.length} unique articles (${fmpResult.articles.length} FMP + ${rssArticles.length} RSS)`);
  return { articles: deduped, leadImage: fmpResult.leadImage };
}
