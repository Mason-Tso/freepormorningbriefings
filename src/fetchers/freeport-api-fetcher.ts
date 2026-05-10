const BRIEFING_URL = 'https://trading-api.freeportmarkets.com/v1/analyst/briefing';

export interface FreeportBriefingEvent {
  headline: string;
  summary: string;
  text: string;
  details: string | null;
  tickers: string[];
  sources: string[];
  hours_ago: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  category: string;
}

export interface FreeportWatchItem {
  event: string;
  time: string;
  why_it_matters: string;
}

export interface FreeportBriefing {
  headline: string;
  market_mood: 'risk-on' | 'risk-off' | 'mixed' | 'quiet';
  events: FreeportBriefingEvent[];
  watch_today: FreeportWatchItem[];
  narratives: string[];
}

export async function fetchFreeportBriefing(): Promise<FreeportBriefing> {
  const resp = await fetch(BRIEFING_URL, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json' },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Briefing API ${resp.status}: ${body.slice(0, 200)}`);
  }

  const json = (await resp.json()) as { data: { briefing: FreeportBriefing } };
  if (!json?.data?.briefing) throw new Error('Unexpected API shape — briefing missing from response');
  return json.data.briefing;
}
