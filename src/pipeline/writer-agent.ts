import Anthropic from '@anthropic-ai/sdk';
import { RankedStory, Briefing, BriefingSchema, MarketOverview, MarketOverviewSchema } from '../schemas';
import { MarketSnapshot } from '../types';
import { formatSnapshot } from './market-data';
import { format } from 'date-fns';

const WRITER_SYSTEM_PROMPT = `You are the voice of Freeport Markets — a sharp, accessible market analyst writing for a general audience interested in finance but not professional traders.

AUDIENCE: People who follow markets casually. They know SPX but not "vol surface." They understand "inflation" but not "breakeven spreads."

TONE RULES:
- Punchy and direct. Every clause earns its place.
- No jargon without a one-word translation in parentheses if needed.
- Accessible but not dumbed down. Treat readers like smart adults who are busy.
- No price lists. Embed prices only when they make the story ("Brent crossed $100 for the first time since March").
- Magnitude calibration:
  * "surged" / "exploded" = equity +3%, crypto +8%, oil +5%
  * "jumped" / "popped" = equity +1.5%, crypto +4%, oil +2.5%
  * "edged" / "crept" = equity +0.3%, crypto +1%, oil +1%
  * "collapsed" / "crashed" = equity -3%, crypto -10%, oil -5%
  * "slipped" / "dipped" = equity -0.5%, crypto -2%, oil -1%

DENSITY RULE: Every clause must state what happened OR what it means. Never both are vague. "Markets rose" alone is banned — tell us why or so what.

FORMAT: Write 4-6 bullet point events. Each event has:
- headline: 8-12 words, punchy, contains the key fact
- summary: ~25 words, the "so what" for casual investors
- full_text: 2 sentences. Sentence 1 = what happened. Sentence 2 = why it matters or what to watch.
- tickers: relevant tickers
- sentiment: bullish/bearish/neutral
- category: geopolitics/macro/earnings/commodities/regulation/crypto

WATCH TODAY: 2-3 forward-looking items (upcoming catalysts, earnings, data releases).

BAD EXAMPLE: "Markets were mixed as investors weighed conflicting signals."
GOOD EXAMPLE: "NASDAQ outpaced the S&P by 2 points as semiconductor stocks led, suggesting the AI trade is back in command."

BAD EXAMPLE: "There are concerns about oil prices."
GOOD EXAMPLE: "Brent crossed $100 on renewed Hormuz tension, squeezing airlines and logistics stocks that rallied last month on cheap fuel."`;

function buildWriterPrompt(stories: RankedStory[], snapshot: MarketSnapshot, date: string): string {
  const dateStr = format(new Date(date), 'EEEE, MMMM d, yyyy');
  const priceData = formatSnapshot(snapshot);

  const storyText = stories
    .slice(0, 10)
    .map(
      (s, i) =>
        `[${i + 1}] IMPORTANCE:${s.importance} SCORE:${s.score.toFixed(1)} SOURCES:${s.source_count}\n` +
        `CATEGORY: ${s.category} | SENTIMENT: ${s.sentiment}\n` +
        `FACT: ${s.headline_fact}\n` +
        `TICKERS: ${s.tickers.join(', ') || 'none'}`
    )
    .join('\n\n');

  return `DATE: ${dateStr}

LIVE MARKET PRICES:
${priceData}

TOP RANKED STORIES (by importance × source coverage):
${storyText}

Write the morning briefing for ${dateStr}. Return ONLY valid JSON matching this schema:
{
  "title": "Morning Briefing — May 8",
  "date": "${dateStr}",
  "events": [
    {
      "headline": "...",
      "summary": "...",
      "full_text": "...",
      "tickers": ["..."],
      "sentiment": "bullish|bearish|neutral",
      "category": "..."
    }
  ],
  "watch_today": [
    { "item": "...", "description": "..." }
  ]
}`;
}

const OVERVIEW_SYSTEM_PROMPT = `You are writing the "Market Updates" section for Freeport Markets — a 2-4 sentence snapshot of what drove markets today.

Write 4 short sections: us_overview, commodities, crypto, sector_rotation.
Each section: 1-2 sentences. Specific numbers, clear drivers. No vague language.

GOOD: "NASDAQ +2.5% crushes S&P +0.6% as semis explode on the Intel-Apple foundry deal; Russell +0.6% trails the tech surge."
BAD: "Stocks moved higher on positive sentiment."`;

export async function runWriterAgent(
  stories: RankedStory[],
  snapshot: MarketSnapshot,
  date: string
): Promise<{ briefing: Briefing; overview: MarketOverview }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = buildWriterPrompt(stories, snapshot, date);

  // Run briefing and overview in parallel
  const [briefingResponse, overviewResponse] = await Promise.all([
    client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
      system: WRITER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: OVERVIEW_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Write the market overview for ${format(new Date(date), 'EEEE, MMMM d, yyyy')}.\n\nPRICES:\n${formatSnapshot(snapshot)}\n\nReturn JSON: { "us_overview": "...", "commodities": "...", "crypto": "...", "sector_rotation": "..." }`,
        },
      ],
    }),
  ]);

  // Parse briefing
  const briefingText = briefingResponse.content[0].type === 'text' ? briefingResponse.content[0].text : '';
  const briefingMatch = briefingText.match(/\{[\s\S]*\}/);
  if (!briefingMatch) throw new Error('Writer returned no JSON');

  const briefingParsed = BriefingSchema.parse(JSON.parse(briefingMatch[0]));

  // Parse overview
  const overviewText = overviewResponse.content[0].type === 'text' ? overviewResponse.content[0].text : '';
  const overviewMatch = overviewText.match(/\{[\s\S]*\}/);
  if (!overviewMatch) throw new Error('Overview writer returned no JSON');

  const overviewParsed = MarketOverviewSchema.parse(JSON.parse(overviewMatch[0]));

  return { briefing: briefingParsed, overview: overviewParsed };
}

