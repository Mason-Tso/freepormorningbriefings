# Freeport Markets — Morning Briefing Bot

## What This Does
Generates the daily morning briefing X post for @freeportmrkts. The post matches the briefing shown in the Freeport Markets app and is formatted for X (Twitter).

## Daily Workflow
1. Mason screenshots the morning briefing from the Freeport app
2. Pastes the screenshot here
3. Claude formats it into an X post + finds a matching image
4. Mason copies the post + downloads the image and posts to X

That's it. No need to run the pipeline manually unless testing.

## Running the Pipeline (Optional)
```bash
npm run generate
```
Outputs to `output/x-post.txt` and `output/lead-image-url.txt`.

Note: The pipeline generates its own briefing from RSS + FMP news. It will NOT match the app unless the app's briefing is pasted in manually. Always prefer the screenshot workflow above.

## X Post Format Rules
- Short. Pick the 3-5 most important stories only.
- No em dashes (—). Use periods instead. Rephrase if needed.
- No stock tickers ($AMD, etc.) in the post body.
- No "download Freeport Markets" or app mentions at the end.
- Human, conversational tone. Write like a smart friend, not a newsletter.
- End with a market data one-liner: `📊 SPX +0.8% · NDX +2.3% · BTC $80,914 · WTI $95 · Gold $4,731 · 10Y 4.36%`

## Image Workflow
- Find a direct .jpg/.jpeg image URL matching the top story headline
- Best sources: Reuters CDN, AP News, Al Jazeera, TechCrunch (Getty images)
- Give Mason the URL to download and attach when posting

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
  index.ts                        — Main pipeline entry point
  pipeline/
    market-data.ts                — FMP + CoinGecko price fetcher
    writer-agent.ts               — Claude Opus briefing writer
    reader-agent.ts               — Article extraction (Claude Haiku)
    deduplicator.ts               — Story ranking and dedup
  fetchers/
    fmp-news-fetcher.ts           — FMP news API
    rss-fetcher.ts                — 8 RSS feeds fallback
    source-orchestrator.ts        — Combines all sources
  output/
    graphic-generator.ts          — HTML card generator (not used in X post workflow)
    script-generator.ts           — GRWM video script (not used in X post workflow)
output/
  x-post.txt                      — Ready-to-post X text
  lead-image-url.txt              — Image URL to download and attach
```

## What NOT to Do
- Do not run the graphic generator or video pipeline for morning briefings (dropped in favor of screenshot workflow)
- Do not use Yahoo Finance as primary source — FMP stable API is preferred
- Do not use `/v3/` FMP endpoints — legacy, not supported on this plan
