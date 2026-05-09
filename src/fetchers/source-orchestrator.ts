import { NormalizedArticle } from '../schemas';
import { fetchRssArticles } from './rss-fetcher';

export async function fetchAllSources(): Promise<NormalizedArticle[]> {
  console.log('[orchestrator] Fetching all sources in parallel...');

  const [rssArticles] = await Promise.all([
    fetchRssArticles(),
    // Twitter signal fetcher would go here (requires TradeNews API or Twitter API)
    // fetchTwitterSignals(),
    // News wire fetcher (requires Polygon API key)
    // fetchNewsWire(),
  ]);

  const all = [...rssArticles];

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = all.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  console.log(`[orchestrator] ${deduped.length} unique articles after URL dedup`);
  return deduped;
}
