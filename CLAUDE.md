# Freeport Markets — Morning Briefing Bot

## What This Does
Generates the daily morning briefing X post for @freeportmrkts, formatted for X (Twitter) in a human, journalist style.

## Daily Workflow

### Step 1 — Pull the data
```bash
npm run briefing
```
This prints:
- Raw briefing (all events in app format)
- Raw source tweets (the actual signals used to build the briefing)
- Live market data
- A draft X post (starting point only — rewrite from source tweets)

### Step 2 — Mason sends front page screenshots
Mason screenshots Bloomberg and WSJ front pages and pastes them into the chat. This catches big stories the API may have missed (it happens — e.g. Supreme Leader MIA story was on WSJ front page but not in the API briefing).

### Step 3 — Claude writes the post
Using the raw source tweets + Bloomberg/WSJ screenshots:
- Order stories by importance (biggest news first)
- Write in human journalist style (see Writing Style below)
- Add hook at top (bold)
- End with market data line
- Find image URL for top story

### Step 4 — Mason reviews and posts
One manual check before posting. Adjust anything that reads off.

---

## Writing Style — ZeroHedge Overnight News Format
Write like a financial journalist, not an AI analyst. Model: @zerohedge "Top Overnight News" posts.

**Do:**
- Lead with the fact, end with the source: `Iran submitted its response to the US peace framework. WSJ`
- Short, punchy sentences. One idea per line.
- Use real numbers from the source tweets: `Aramco Q1 profit jumped 25%`
- Source attribution at end of each item: `BBG`, `WSJ`, `FT`, `RTRS`, `ABC`, `GS`, `Forbes`
- Order by importance — biggest story first, always
- Include stories from Bloomberg/WSJ screenshots even if not in the API

**Don't:**
- "This matters because..." — cut it
- "That helps explain why..." — cut it
- "That keeps X supported while Y..." — cut it
- "Markets read it as..." — cut it
- AI analyst framing of any kind
- Em dashes (—) — use periods or commas instead
- Stock tickers ($AMD etc.) in the body
- "Download Freeport Markets" or any app mention

**Example of correct tone:**
> Iran's Supreme Leader Mojtaba Khamenei hasn't appeared publicly since US and Iranian officials say he was severely injured in a February airstrike, just as negotiators need him most. WSJ
>
> Aramco Q1 profit jumped 25% as Hormuz risks pushed its East-West pipeline to full capacity. CEO Amin Nasser warned a swift reopening still wouldn't normalize oil markets quickly. RTRS
>
> Goldman expects S&P 500 buybacks to grow only 3% in 2026 as AI capex crowds out shareholder returns. Hyperscaler capex is on pace to equal 100% of cash flows from operations this year. GS

---

## Full Post Format
```
Morning Briefing — [Date]

**[Hook — one punchy sentence hitting the 2-3 biggest themes. Bold. No em dashes.]**

[Story 1 — biggest news. Fact. Brief context if needed. SOURCE]

[Story 2. SOURCE]

[Story 3. SOURCE]

[Story 4. SOURCE]

[Story 5. SOURCE]

[More if warranted]

📊 SPX 7,399 (+0.8%) · NDX 29,235 (+2.3%) · BTC $80,967 (+1.0%) · WTI $95 (+0.6%) · Gold $4,731 (+0.4%) · 10Y 4.36%
```

On weekends, append `(Fri close)` to the market line since index/commodity prices are Friday's close.

## Hook Rules
- One sentence packing the 2-3 biggest themes of the day
- Written like a Bloomberg headline, not an AI summary
- No em dashes. Use commas or periods.
- Bold in the final post
- Example: "Iran submitted its response to the US peace framework, the biggest diplomatic move in weeks, as a drone hits a ship near Qatar and the Supreme Leader hasn't been seen since a February airstrike."

## Source Tweet Workflow
The API returns `events[].source_signals[]` — the actual tweets and headlines used to build the briefing. These contain:
- Real numbers (`Aramco Q1 profit jumped 25%`)
- Direct quotes (`"We're starting to see risks of supply outages"`)
- The actual source handle (`@Reuters`, `Bloomberg/markets`, `@KobeissiLetter`)

Use these as the raw material for writing — not the AI-processed `events[].details` text. The details text is too analytical and sounds like an AI.

## Image Workflow
- Search for a direct .jpg/.jpeg image matching the top story
- Best sources: ABC News CDN (i.abcnewsfe.com), Al Jazeera CDN (aje.news)
- Reuters and AP News domains are blocked to the web crawler — don't try them
- Give Mason the direct CDN URL (not the article URL) to download and attach
- Verify it's openable before giving it to Mason

## Market Data — Weekend Handling
- Weekdays: FMP for indices/commodities, CoinGecko Pro for crypto
- Weekends: Hyperliquid for crypto (24/7 live prices + real 24h change), FMP for indices/commodities (shows Friday close — flagged in output)
- Watch Today: only shows events within 3 days. If nothing is within 3 days, section is omitted.

## APIs (all keys in .env)
| Key | Service | What it's used for |
|-----|---------|-------------------|
| `ANTHROPIC_API_KEY` | Anthropic | Claude (legacy pipeline only) |
| `FMP_API_KEY` | Financial Modeling Prep | Live market prices — `/stable/` endpoints only, NOT `/v3/` |
| `COINGECKO_API_KEY` | CoinGecko Pro | Crypto prices weekdays — `pro-api.coingecko.com` |
| `TWITTER_BEARER_TOKEN` | Twitter API v2 | Available, expensive — limit use |
| `DEFI_LLAMA_API_KEY` | DefiLlama | Available for DeFi/onchain data |
| `OPENAI_API_KEY` | OpenAI | Available if needed |

## FMP API Notes
- Base URL: `https://financialmodelingprep.com/stable`
- Quote endpoint: `/stable/quote?symbol=^GSPC&apikey=KEY` (single symbol only)
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
    market-data.ts                — FMP + CoinGecko + Hyperliquid price fetcher
    writer-agent.ts               — Claude Opus briefing writer (legacy pipeline only)
    reader-agent.ts               — Article extraction (legacy pipeline only)
    deduplicator.ts               — Story ranking (legacy pipeline only)
  output/
    graphic-generator.ts          — Not used in X post workflow
    script-generator.ts           — Not used in X post workflow
output/
  x-post.txt                      — Draft X post (rewrite from source tweets before using)
```

## Freeport API Response Shape
`data.briefing` from the API:
- `headline` — short title (used as basis for hook)
- `market_mood` — 'risk-on' | 'risk-off' | 'mixed' | 'quiet'
- `events[].summary` — short 1-sentence version (shown as bullets in app)
- `events[].details` — full 2-sentence AI-written text (too analytical for X post — use source tweets instead)
- `events[].source_signals[]` — raw tweets/headlines used to build the event. USE THESE.
- `watch_today[]` — upcoming economic events with `event`, `time`, `why_it_matters`

## What NOT to Do
- Do not use `events[].details` as the X post body — it sounds like AI
- Do not run the graphic generator or video pipeline for morning briefings
- Do not use `/v3/` FMP endpoints — legacy, not supported on this plan
- Do not try Reuters or AP News domains for image search — blocked to the crawler
- Do not post without Mason's manual review
