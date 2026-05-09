import { z } from 'zod';

export const NormalizedArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  publishedAt: z.string(),
  source: z.string(),
  sourceType: z.enum(['rss', 'twitter', 'news_api']),
});

export const ReaderOutputSchema = z.object({
  headline_fact: z.string(),
  tickers: z.array(z.string()),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  category: z.enum(['geopolitics', 'macro', 'earnings', 'commodities', 'regulation', 'crypto', 'price_action']),
  importance: z.number().min(1).max(10),
  story_fingerprint: z.string(),
});

export const RankedStorySchema = z.object({
  fingerprint: z.string(),
  headline_fact: z.string(),
  tickers: z.array(z.string()),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  category: z.string(),
  importance: z.number(),
  source_count: z.number(),
  score: z.number(),
  sources: z.array(z.string()),
});

export const BriefingEventSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  full_text: z.string(),
  tickers: z.array(z.string()),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  category: z.string(),
});

export const WatchItemSchema = z.object({
  item: z.string(),
  description: z.string(),
});

export const BriefingSchema = z.object({
  title: z.string(),
  theme: z.string(),
  date: z.string(),
  events: z.array(BriefingEventSchema).min(4).max(6),
  watch_today: z.array(WatchItemSchema),
});

export const MarketOverviewSchema = z.object({
  us_overview: z.string(),
  commodities: z.string(),
  crypto: z.string(),
  sector_rotation: z.string(),
});

export type NormalizedArticle = z.infer<typeof NormalizedArticleSchema>;
export type ReaderOutput = z.infer<typeof ReaderOutputSchema>;
export type RankedStory = z.infer<typeof RankedStorySchema>;
export type BriefingEvent = z.infer<typeof BriefingEventSchema>;
export type Briefing = z.infer<typeof BriefingSchema>;
export type MarketOverview = z.infer<typeof MarketOverviewSchema>;
