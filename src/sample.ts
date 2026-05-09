/**
 * SAMPLE RUN — May 8, 2026
 * Uses real market data from screenshots + search results. No API keys required.
 * Run: npx ts-node src/sample.ts
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { Briefing, MarketOverview } from './schemas';
import { MarketSnapshot } from './types';
import { generateBriefingGraphic } from './output/graphic-generator';
import { buildHiggsfieldPrompt } from './output/higgsfield-client';

mkdirSync('./output', { recursive: true });

// ─── MOCK MARKET DATA (May 8, 2026) ─────────────────────────────────────────
const SAMPLE_SNAPSHOT: MarketSnapshot = {
  indices: [
    { symbol: '^GSPC', price: 7376, change_pct: 0.65, label: 'SPX' },
    { symbol: '^NDX',  price: 29352, change_pct: 2.45, label: 'NDX' },
    { symbol: '^RUT',  price: 2842, change_pct: 0.63, label: 'RUT' },
    { symbol: '^DJI',  price: 49609, change_pct: 0.03, label: 'DJIA' },
    { symbol: '^VIX',  price: 17.19, change_pct: 0.64, label: 'VIX' },
    { symbol: '^TNX',  price: 4.37, change_pct: -0.59, label: 'US10Y' },
  ],
  commodities: [
    { symbol: 'CL=F', price: 92.52, change_pct: -2.60, label: 'WTI' },
    { symbol: 'BZ=F', price: 98.08, change_pct: -2.43, label: 'Brent' },
    { symbol: 'GC=F', price: 3318.0, change_pct: 0.40, label: 'Gold' },
    { symbol: 'SI=F', price: 33.12, change_pct: -0.30, label: 'Silver' },
    { symbol: 'NG=F', price: 3.94, change_pct: 1.05, label: 'Nat Gas' },
  ],
  crypto: [
    { symbol: 'BTC-USD', price: 80420, change_pct: 1.20, label: 'BTC' },
    { symbol: 'ETH-USD', price: 3612, change_pct: 1.80, label: 'ETH' },
    { symbol: 'SOL-USD', price: 174.30, change_pct: 6.40, label: 'SOL' },
  ],
  bonds: [
    { symbol: '^TNX', price: 4.37, change_pct: -0.59, label: 'US10Y' },
  ],
  fetchedAt: '2026-05-08T10:33:00Z',
};

// ─── MOCK BRIEFING (May 8, 2026) ────────────────────────────────────────────
const SAMPLE_BRIEFING: Briefing = {
  title: 'Morning Briefing — May 8, 2026',
  date: 'May 8, 2026',
  events: [
    {
      headline: 'Intel doubles in a month on Apple foundry partnership',
      summary: 'Apple confirmed it will use Intel fabs for future chips, ending years of TSMC exclusivity and validating Intel\'s turnaround narrative.',
      full_text: 'Intel confirmed a preliminary chip-making agreement with Apple, sending shares up 14% on the day and capping a 102% one-month run. The deal marks a structural shift — Apple diversifying away from TSMC and Intel proving its foundry business can win marquee clients, shifting investor perception from restructuring to growth.',
      tickers: ['INTC', 'AAPL', 'TSM'],
      sentiment: 'bullish',
      category: 'earnings',
    },
    {
      headline: 'BlackRock launches two tokenized money-market funds on-chain',
      summary: 'BlackRock and DTCC pushed tokenization live as NYSE and Nasdaq both secured SEC approval to trade tokenized equities and ETFs.',
      full_text: 'BlackRock filed to launch two tokenized money-market funds as institutional infrastructure for real-world assets goes live, lifting Coinbase +1.6% and Solana +6.4% on the narrative. The Senate Banking Committee\'s Clarity Act vote scheduled for May 14 gives this momentum regulatory tailwind — the bill divides digital asset oversight between the SEC and CFTC.',
      tickers: ['COIN', 'BTC', 'ETH', 'SOL'],
      sentiment: 'bullish',
      category: 'regulation',
    },
    {
      headline: 'Strong April jobs beat pushes back Fed cut bets to December',
      summary: '115,000 jobs added vs 65,000 expected, with unemployment steady at 4.3%. Markets now price the first Fed cut no earlier than December.',
      full_text: 'April payrolls printed at 115,000 — nearly double the 65,000 estimate — with unemployment holding at 4.3%, reinforcing the idea the labor market remains too tight for the Fed to ease. Rate futures shifted: December 2026 now prices the first 25bps cut, pushing back September expectations and keeping the dollar bid while long bonds sold off.',
      tickers: ['TLT', 'GLD', 'UUP'],
      sentiment: 'bearish',
      category: 'macro',
    },
    {
      headline: 'U.S. strike hits Iranian ship near Hormuz, oil whipsaws',
      summary: 'A U.S. airstrike near the Strait of Hormuz injured 6 and left 6 missing on an Iranian vessel. Oil spiked then reversed as shipping deal hopes held.',
      full_text: 'An Iranian port official confirmed a U.S. strike near the Strait of Hormuz that injured 6 and left 6 others missing, sending Brent briefly above $101 before talks of a shipping deal pulled crude back below $98. Citi flagged oil could rise further if diplomatic talks — currently "thorny" per Reuters — break down, keeping energy stocks in focus as a geopolitical hedge.',
      tickers: ['USO', 'XOM', 'CVX', 'BNO'],
      sentiment: 'bearish',
      category: 'geopolitics',
    },
    {
      headline: 'Circle prices first public earnings report as CRCL ahead of Clarity Act vote',
      summary: 'Circle Internet Group reports its first quarter as a public company on May 11, with stablecoin regulation potentially imminent.',
      full_text: 'Circle\'s first public earnings print on May 11 comes days before the Senate Banking Committee\'s Clarity Act vote on May 14, giving the report outsized narrative weight for the entire crypto-infrastructure sector. Watch USDC reserve yields and transaction volume trends — management commentary on institutional adoption and the regulatory tailwind will set the tone for COIN, HOOD, and MSTR.',
      tickers: ['CRCL', 'COIN', 'HOOD', 'MSTR'],
      sentiment: 'bullish',
      category: 'earnings',
    },
  ],
  watch_today: [
    {
      item: 'Circle (CRCL) Earnings — May 11',
      description: 'First public earnings print. Watch USDC reserve yield and transaction volume. Could move the entire crypto-infrastructure sector.',
    },
    {
      item: 'Senate Clarity Act Vote — May 14',
      description: 'SEC/CFTC jurisdiction split for digital assets. A yes vote is the biggest regulatory catalyst for crypto since the ETF approvals.',
    },
    {
      item: 'Fed Speakers This Week',
      description: 'Multiple Fed officials scheduled after the jobs beat. Any hawkish language re-prices cut expectations further out.',
    },
  ],
};

// ─── MOCK OVERVIEW ───────────────────────────────────────────────────────────
const SAMPLE_OVERVIEW: MarketOverview = {
  us_overview: 'NASDAQ +2.5% crushes S&P +0.6% as semis explode on the Intel-Apple foundry deal; Russell +0.6% trails the tech surge.',
  commodities: 'Brent briefly crossed $101 on renewed Hormuz tension after a U.S. strike near the strait, then retreated to $98 as shipping deal hopes held. WTI -2.6%. Natural gas +1.1%.',
  crypto: 'BlackRock tokenization going live lifts Solana +6.4% and Ethereum +1.8%. Bitcoin holds $80K quietly as institutional crypto narrative builds.',
  sector_rotation: 'Semiconductors and tech lead sharply. Energy mixed — geopolitical premium offset by Hormuz deal hopes. Financials flat. Bonds sold off on jobs beat; 10Y at 4.37%.',
};

// ─── GRWM SCRIPT (SAMPLE) ───────────────────────────────────────────────────
const SAMPLE_GRWM_SCRIPT = {
  hook: 'Intel just doubled in a month — here\'s why Apple is behind it.',
  body: [
    'Okay so while I do my eyeliner — Apple confirmed it\'s using Intel fabs for future chips. Like, TSMC exclusivity is over. Intel is up 14% today alone, and 102% in the last month. Wild.',
    'BlackRock just launched two money-market funds on the blockchain. The tokenization era is literally starting right now — Solana jumped 6.4% on the news, Coinbase is up too.',
    'Jobs report came in hot — 115,000 jobs added versus 65,000 expected. Good for the economy, bad if you were hoping for Fed rate cuts. Markets are now pricing December for the first cut.',
    'There was a U.S. military strike on an Iranian ship near the Strait of Hormuz. Oil spiked to $101, then pulled back on shipping deal talks. Keep watching this — Citi says oil could run higher.',
    'And Circle reports earnings on May 11, right before the Senate votes on the Clarity Act for crypto regulation. This is a huge week for the crypto space — CRCL, Coinbase, and Robinhood all in focus.',
  ],
  outro: 'All of this and more on the Freeport Markets app — link in bio. Let\'s go trade.',
  full_text: '',
  estimated_duration_secs: 68,
};
SAMPLE_GRWM_SCRIPT.full_text = [SAMPLE_GRWM_SCRIPT.hook, ...SAMPLE_GRWM_SCRIPT.body, SAMPLE_GRWM_SCRIPT.outro].join(' ');

// ─── GENERATE OUTPUTS ────────────────────────────────────────────────────────
console.log('\n=== Freeport Morning Briefing — SAMPLE OUTPUT ===');
console.log('Date: May 8, 2026');
console.log('Mode: Using hardcoded sample data (no API keys needed)\n');

// Generate SVG graphic
console.log('[1] Generating graphic...');
generateBriefingGraphic(SAMPLE_BRIEFING, SAMPLE_SNAPSHOT, './output/briefing-sample.svg');

// Generate Higgsfield prompt
const higgsfieldPrompt = buildHiggsfieldPrompt(SAMPLE_GRWM_SCRIPT);
writeFileSync('./output/higgsfield-prompt-sample.txt', higgsfieldPrompt, 'utf-8');

// Format X post text
const xPostLines = [
  `Morning Briefing — ${SAMPLE_BRIEFING.date}`,
  '',
  ...SAMPLE_BRIEFING.events.map((e) => `${e.headline}`),
  '',
  ...SAMPLE_BRIEFING.watch_today.map((w) => `📅 ${w.item}`),
];
const xPostText = xPostLines.join('\n');
writeFileSync('./output/briefing-sample.txt', xPostText, 'utf-8');

// Format market overview
const overviewText = [
  'MARKET UPDATES — May 8, 2026',
  '',
  SAMPLE_OVERVIEW.us_overview,
  '',
  SAMPLE_OVERVIEW.commodities,
  '',
  SAMPLE_OVERVIEW.crypto,
  '',
  SAMPLE_OVERVIEW.sector_rotation,
].join('\n');
writeFileSync('./output/overview-sample.txt', overviewText, 'utf-8');

// Format GRWM script
const scriptLines = [
  '=== GRWM SCRIPT — May 8, 2026 ===',
  '',
  '=== HOOK ===',
  SAMPLE_GRWM_SCRIPT.hook,
  '',
  '=== BODY ===',
  ...SAMPLE_GRWM_SCRIPT.body.map((b, i) => `[${i + 1}] ${b}`),
  '',
  '=== OUTRO ===',
  SAMPLE_GRWM_SCRIPT.outro,
  '',
  `--- Full script (~${SAMPLE_GRWM_SCRIPT.estimated_duration_secs}s) ---`,
  SAMPLE_GRWM_SCRIPT.full_text,
  '',
  '=== HIGGSFIELD VIDEO PROMPT ===',
  higgsfieldPrompt,
].join('\n');
writeFileSync('./output/grwm-script-sample.txt', scriptLines, 'utf-8');

// Save full JSON
writeFileSync('./output/result-sample.json', JSON.stringify({
  briefing: SAMPLE_BRIEFING,
  overview: SAMPLE_OVERVIEW,
  snapshot: SAMPLE_SNAPSHOT,
  grwm_script: SAMPLE_GRWM_SCRIPT,
}, null, 2), 'utf-8');

// ─── PRINT TO CONSOLE ────────────────────────────────────────────────────────
console.log('\n=== X POST TEXT ===');
console.log(xPostText);

console.log('\n=== MARKET OVERVIEW ===');
console.log(overviewText);

console.log('\n=== GRWM SCRIPT ===');
console.log(scriptLines);

console.log('\n=== OUTPUT FILES ===');
console.log('  output/briefing-sample.svg           — Graphic (open in browser)');
console.log('  output/briefing-sample.txt           — X post text');
console.log('  output/overview-sample.txt           — Market overview');
console.log('  output/grwm-script-sample.txt        — Full GRWM script + Higgsfield prompt');
console.log('  output/higgsfield-prompt-sample.txt  — Higgsfield video prompt (submit at cloud.higgsfield.ai)');
console.log('  output/result-sample.json            — Full JSON output');
console.log('\n✓ Sample complete. Open output/briefing-sample.svg in a browser to preview the graphic.\n');
