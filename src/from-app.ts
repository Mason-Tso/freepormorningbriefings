import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { format } from 'date-fns';
import { fetchFreeportBriefing, FreeportBriefing, FreeportBriefingEvent } from './fetchers/freeport-api-fetcher';
import { fetchMarketSnapshot, formatSnapshotOneLiner } from './pipeline/market-data';

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}
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

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

function watchItemWithinDays(timeStr: string | undefined, days: number): boolean {
  if (!timeStr) return false;
  const match = timeStr.match(/([A-Za-z]+)\s+(\d+)/);
  if (!match) return false;
  const month = MONTH_MAP[match[1]];
  const day = parseInt(match[2]);
  if (month === undefined || isNaN(day)) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(now.getFullYear(), month, day);
  const diffDays = (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

function formatRawBriefing(briefing: FreeportBriefing): string {
  const lines: string[] = [briefing.headline, ''];

  for (const evt of briefing.events) {
    lines.push(`• ${evt.summary}`);
  }

  const upcomingWatches = (briefing.watch_today ?? []).filter((w) => watchItemWithinDays(w.time, 3));
  if (upcomingWatches.length > 0) {
    lines.push('');
    lines.push('Watch today:');
    for (const w of upcomingWatches) {
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
  const marketLine = formatSnapshotOneLiner(snapshot, isWeekend());
  const topEvents = briefing.events.slice(0, 4);

  const lines: string[] = [`Morning Briefing — ${date}`, ''];

  for (const evt of topEvents) {
    lines.push(pickEventText(evt));
    lines.push('');
  }

  lines.push(`📊 ${marketLine}`);

  const upcomingWatches = (briefing.watch_today ?? [])
    .filter((w) => watchItemWithinDays(w.time, 3))
    .slice(0, 2);
  if (upcomingWatches.length > 0) {
    lines.push('');
    lines.push('Watch today:');
    for (const w of upcomingWatches) {
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
