# Freeport Markets — Morning Briefing Bot

## What This Does
Generates the daily morning briefing X post for @freeportmrkts. The post matches the briefing shown in the Freeport Markets app and is formatted for X (Twitter).

## Daily Workflow
```bash
npm run briefing
```
Fetches the live briefing directly from the Freeport app API + live market prices, prints the raw briefing and the formatted X post, writes the post to `output/x-post.txt`.

After running the command:
1. Review the raw briefing output (all events, app format)
2. Claude writes a hook based on the top themes (see Hook section below)
3. Claude finds a direct image URL for the top story
4. Mason copies the final post + downloads the image and posts to X

## How It Works
- Hits `GET https://trading-api.freeportmarkets.com/v1/analyst/briefing` (no auth required — shared briefing is public)
- Prints raw briefing first: `briefing.headline` + all `events[].summary` bullets (matches app format)
- Picks the top 4 events for the X post body (already ranked by the backend)
- Fetches live market prices from FMP + CoinGecko
- Formats into X post per the rules below and writes to `output/x-post.txt`

## Legacy Pipeline (RSS-based, rarely needed)
```bash
npm run generate
```
Generates its own briefing from RSS + FMP news. Does NOT match the app briefing. Only useful for testing the full pipeline end-to-end.

## Full Post Format
The final post delivered to Mason looks like this:

```
Morning Briefing — [Date]

**[Hook — one punchy sentence summarising the day's key themes. Bold.]**

[Event 1 — full 2-sentence details text, no em dashes]

[Event 2]

[Event 3]

[Event 4]

📊 SPX 7,399 (+0.8%) · NDX 29,235 (+2.3%) · BTC $80,646 (+0.5%) · WTI $95 (+0.6%) · Gold $4,731 (+0.4%) · 10Y 4.36% (-0.6%)

Watch today:
  · [Event] ([Time])
  · [Event] ([Time])
```

## Hook Rules
- One sentence, written like the app's top headline — packs the key themes (conflict, macro, tech move, market reaction)
- Mirrors the style of `briefing.headline` but can be expanded to hit 2-3 themes
- No em dashes. Use periods instead.
- Bold when presenting the final post to Mason
- Example: "Iran's ceasefire frays at Hormuz and Lebanon strikes widen the conflict map, while China stimulus and a $7B DeepSeek raise power tech to +3.4%. Blowout Q1 earnings cushioning the rest."

## X Post Format Rules
- Heading: `Morning Briefing — [Date]`
- Hook first (bold), then event paragraphs
- Pick the top 4 events (already ranked by the API)
- Use `events[].details` for each event body (full 2-sentence writer output)
- No em dashes (—). Use periods instead. Rephrase if needed.
- No stock tickers ($AMD, etc.) in the post body.
- No "download Freeport Markets" or app mentions at the end.
- Human, conversational tone. Write like a smart friend, not a newsletter.
- End with a market data one-liner: `📊 SPX · NDX · BTC · WTI · Gold · 10Y`
- Include Watch today items (max 2) below the market line

## Image Workflow
- Search for a direct .jpg/.jpeg image URL matching the top story headline
- Best sources: ABC News CDN (i.abcnewsfe.com), Al Jazeera, AP News, Reuters CDN
- Reuters and AP News domains are blocked to the crawler — try ABC News or Al Jazeera first
- Give Mason the direct URL to download and attach when posting
- Always verify the URL is openable before giving it to Mason

## APIs (all keys in .env)
| Key | Service | What it's used for |
|-----|---------|-------------------|
| `ANTHROPIC_API_KEY` | Anthropic | Generates briefing text (Claude Opus) |
| `FMP_API_KEY` | Financial Modeling Prep | Live market prices (indices, commodities) — uses `/stable/` endpoints only, NOT `/v3/` (legacy) |
| `COINGECKO_API_KEY` | CoinGecko Pro | Crypto prices (BTC, ETH, SOL) — uses `pro-api.coingecko.com` |
| `TWITTER_BEARER_TOKEN` | Twitter API v2 | Available for news signals (expensive, limit use) |
| `DEFI_LLAMA_API_KEY` | DefiLlama | Available for DeFi/onchain data |
| `OPENAI_API_KEY` | OpenAI | Available if needed |

## FMP API Notes
- Base URL: `https://financialmodelingprep.com/stable`
- Quote endpoint: `/stable/quote?symbol=^GSPC&apikey=KEY` (single symbol only, no comma-separated batch)
- News: `/stable/news/general-latest?limit=50&apikey=KEY`
- Index symbols: `^GSPC` (SPX), `^NDX`, `^DJI`, `^RUT`, `^VIX`, `^TNX`
- Commodity symbols: `GCUSD` (Gold), `CLUSD` (WTI), `BZUSD` (Brent), `NGUSD` (Nat Gas)

## Live Market Prices (reference)
As of May 2026: Gold ~$4,730, BTC ~$80,000-82,000, SPX ~7,400, NDX ~29,000, WTI ~$95, 10Y ~4.36%

## Key Files
```
src/
  from-app.ts                     — PRIMARY entry point (npm run briefing)
  index.ts                        — Legacy RSS pipeline entry point
  fetchers/
    freeport-api-fetcher.ts       — Fetches live briefing from Freeport app API
    fmp-news-fetcher.ts           — FMP news API (legacy pipeline only)
    rss-fetcher.ts                — RSS feeds (legacy pipeline only)
    source-orchestrator.ts        — Combines news sources (legacy pipeline only)
  pipeline/
    market-data.ts                — FMP + CoinGecko price fetcher (used by both pipelines)
    writer-agent.ts               — Claude Opus briefing writer (legacy pipeline only)
    reader-agent.ts               — Article extraction (legacy pipeline only)
    deduplicator.ts               — Story ranking (legacy pipeline only)
  output/
    graphic-generator.ts          — Not used in X post workflow
    script-generator.ts           — Not used in X post workflow
output/
  x-post.txt                      — Ready-to-post X text
```

## Freeport API Response Shape
`data.briefing` from the API:
- `headline` — punchy opener sentence (used as basis for the hook)
- `market_mood` — 'risk-on' | 'risk-off' | 'mixed' | 'quiet'
- `events[]` — ranked events; use `details` for full 2-sentence text (`text` is overwritten with the short summary at the API layer); `summary` is the short 1-sentence version shown as bullets in the app
- `watch_today[]` — scheduled events with `event`, `time`, `why_it_matters`

## What NOT to Do
- Do not run the graphic generator or video pipeline for morning briefings
- Do not use Yahoo Finance as primary source — FMP stable API is preferred
- Do not use `/v3/` FMP endpoints — legacy, not supported on this plan
- Do not try Reuters or AP News domains for image search — blocked to the crawler
