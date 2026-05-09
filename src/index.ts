import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { format } from 'date-fns';
import { fetchAllSources } from './fetchers/source-orchestrator';
import { runReaderAgent } from './pipeline/reader-agent';
import { deduplicateAndRank } from './pipeline/deduplicator';
import { fetchMarketSnapshot, formatSnapshot, formatSnapshotOneLiner } from './pipeline/market-data';
import { runWriterAgent } from './pipeline/writer-agent';
import { Briefing, MarketOverview } from './schemas';
import { GenerationResult, MarketSnapshot } from './types';

async function run(): Promise<GenerationResult> {
  const date = format(new Date(), 'MMMM d, yyyy');
  console.log(`\n=== Freeport Morning Briefing ===`);
  console.log(`Date: ${date}\n`);

  mkdirSync('./output', { recursive: true });

  // Step 1: Fetch all sources (FMP news + RSS)
  console.log('[1/5] Fetching news sources...');
  const { articles, leadImage } = await fetchAllSources();

  // Step 2: Reader agent
  console.log('[2/5] Running reader agent...');
  const readerOutputs = await runReaderAgent(articles);

  // Step 3: Deduplicator
  console.log('[3/5] Deduplicating and ranking stories...');
  const rankedStories = deduplicateAndRank(readerOutputs);
  console.log(`  → ${rankedStories.length} unique stories ranked`);

  // Step 4: Market data (FMP + CoinGecko)
  console.log('[4/5] Fetching live market data...');
  const snapshot = await fetchMarketSnapshot();

  // Step 5: Writer agent
  console.log('[5/5] Generating briefing with Claude...');
  const { briefing, overview } = await runWriterAgent(rankedStories, snapshot, new Date().toISOString());

  return finalize(briefing, overview, snapshot, date, leadImage);
}

async function finalize(
  briefing: Briefing,
  overview: MarketOverview,
  snapshot: MarketSnapshot,
  date: string,
  leadImage: string | null
): Promise<GenerationResult> {
  const xPost = formatXPost(briefing, snapshot);
  writeFileSync('./output/x-post.txt', xPost, 'utf-8');

  const overviewText = [
    'MARKET UPDATES',
    '',
    overview.us_overview,
    '',
    overview.commodities,
    '',
    overview.crypto,
    '',
    overview.sector_rotation,
  ].join('\n');
  writeFileSync('./output/overview.txt', overviewText, 'utf-8');

  if (leadImage) {
    writeFileSync('./output/lead-image-url.txt', leadImage, 'utf-8');
  }

  writeFileSync('./output/result.json', JSON.stringify({ briefing, overview, snapshot }, null, 2), 'utf-8');

  console.log('\n=== Output files ===');
  console.log('  output/x-post.txt        — Copy/paste to X');
  if (leadImage) {
    console.log('  output/lead-image-url.txt — Download + attach this image when posting:');
    console.log(`    ${leadImage}`);
  }
  console.log('  output/overview.txt      — Market overview');
  console.log('  output/result.json       — Full structured data');

  console.log('\n=== X Post Preview ===\n');
  console.log(xPost);

  return {
    date,
    briefing_text: xPost,
    market_overview: overviewText,
    graphic_svg: '',
    grwm_script: undefined as any,
    higgsfield_video_url: undefined,
  };
}

function formatXPost(briefing: Briefing, snapshot: MarketSnapshot): string {
  const marketLine = formatSnapshotOneLiner(snapshot);

  const lines: string[] = [
    `Morning Briefing — ${briefing.date}`,
    '',
    briefing.theme,
    '',
  ];

  for (const event of briefing.events) {
    lines.push(event.full_text);
    lines.push('');
  }

  lines.push(`📊 ${marketLine}`);
  lines.push('');

  if (briefing.watch_today.length > 0) {
    lines.push('Watch today:');
    for (const w of briefing.watch_today) {
      lines.push(`  · ${w.item} — ${w.description}`);
    }
    lines.push('');
  }

  lines.push('Track it all in real time — download Freeport Markets.');

  return lines.join('\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
