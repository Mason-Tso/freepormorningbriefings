import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { format } from 'date-fns';
import { fetchFreeportBriefing, FreeportBriefing, FreeportBriefingEvent } from './fetchers/freeport-api-fetcher';
import { fetchMarketSnapshot, formatSnapshotOneLiner } from './pipeline/market-data';
import { MarketSnapshot } from './types';

async function run() {
  const date = format(new Date(), 'MMMM d, yyyy');
  console.log(`\n=== Freeport Morning Briefing (from app) ===`);
  console.log(`Date: ${date}\n`);

  mkdirSync('./output', { recursive: true });

  console.log('[1/2] Fetching live briefing from Freeport API...');
  const briefing = await fetchFreeportBriefing();
  console.log(`  → ${briefing.events.length} events, mood: ${briefing.market_mood}`);

  console.log('[2/2] Fetching live market data...');
  const snapshot = await fetchMarketSnapshot();

  console.log('\n=== Raw Briefing ===\n');
  console.log(formatRawBriefing(briefing));

  const xPost = formatXPost(briefing, snapshot, date);
  writeFileSync('./output/x-post.txt', xPost, 'utf-8');

  console.log('\n=== X Post (output/x-post.txt) ===\n');
  console.log(xPost);
  console.log('\n→ Saved to output/x-post.txt');
}

function formatRawBriefing(briefing: FreeportBriefing): string {
  const lines: string[] = [briefing.headline, ''];

  for (const evt of briefing.events) {
    lines.push(`• ${evt.summary}`);
  }

  if (briefing.watch_today?.length > 0) {
    lines.push('');
    lines.push('Watch today:');
    for (const w of briefing.watch_today) {
      const label = w.time ? `${w.event} (${w.time})` : w.event;
      lines.push(`  · ${label}`);
    }
  }

  return lines.join('\n');
}

function cleanText(text: string): string {
  return text
    .replace(/\s*—\s*/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickEventText(evt: FreeportBriefingEvent): string {
  // details = original full 2-sentence writer output
  // text/summary = short 1-sentence version (text is backfilled from summary at API layer)
  return cleanText(evt.details || evt.text || evt.summary);
}

function formatXPost(briefing: FreeportBriefing, snapshot: MarketSnapshot, date: string): string {
  const marketLine = formatSnapshotOneLiner(snapshot);
  const topEvents = briefing.events.slice(0, 4);

  const lines: string[] = [`Morning Briefing — ${date}`, ''];

  for (const evt of topEvents) {
    lines.push(pickEventText(evt));
    lines.push('');
  }

  lines.push(`📊 ${marketLine}`);

  if (briefing.watch_today?.length > 0) {
    lines.push('');
    lines.push('Watch today:');
    for (const w of briefing.watch_today.slice(0, 2)) {
      const label = w.time ? `${w.event} (${w.time})` : w.event;
      lines.push(`  · ${label}`);
    }
  }

  return lines.join('\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
