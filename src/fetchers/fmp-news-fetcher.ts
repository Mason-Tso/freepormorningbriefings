import axios from 'axios';
import { NormalizedArticle } from '../schemas';
import { randomUUID } from 'crypto';

const FMP_STABLE = 'https://financialmodelingprep.com/stable';

interface FmpNewsItem {
  symbol?: string | null;
  publishedDate: string;
  publisher?: string;
  title: string;
  image?: string;
  site?: string;
  text?: string;
  url: string;
}

export async function fetchFmpNews(maxAgeHours = 8): Promise<{ articles: NormalizedArticle[]; leadImage: string | null }> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    console.warn('[fmp-news] No FMP_API_KEY — skipping');
    return { articles: [], leadImage: null };
  }

  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  try {
    const [generalRes, stockRes] = await Promise.allSettled([
      axios.get<FmpNewsItem[]>(`${FMP_STABLE}/news/general-latest`, {
        params: { limit: 50, apikey: apiKey },
        timeout: 12000,
      }),
      axios.get<FmpNewsItem[]>(`${FMP_STABLE}/news/stock-latest`, {
        params: { limit: 50, apikey: apiKey },
        timeout: 12000,
      }),
    ]);

    const generalItems: FmpNewsItem[] =
      generalRes.status === 'fulfilled' ? (generalRes.value.data ?? []) : [];
    const stockItems: FmpNewsItem[] =
      stockRes.status === 'fulfilled' ? (stockRes.value.data ?? []) : [];

    const seen = new Set<string>();
    const recent = [...generalItems, ...stockItems].filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      const pub = new Date(item.publishedDate).getTime();
      return pub > cutoff;
    });

    const leadImage = recent.find((i) => i.image && i.image.startsWith('http'))?.image ?? null;

    const articles: NormalizedArticle[] = recent.map((item) => ({
      id: randomUUID(),
      title: item.title,
      content: (item.text ?? '').slice(0, 1200),
      url: item.url,
      publishedAt: item.publishedDate,
      source: item.publisher ?? item.site ?? 'FMP',
      sourceType: 'news_api' as const,
    }));

    console.log(`[fmp-news] ${articles.length} articles (${generalItems.length} general + ${stockItems.length} stock)`);
    return { articles, leadImage };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fmp-news] Failed: ${msg}`);
    return { articles: [], leadImage: null };
  }
}
