import 'dotenv/config';
import { mkdirSync } from 'fs';
import { writeFileSync } from 'fs';
import { format } from 'date-fns';
import { fetchAllSources } from './fetchers/source-orchestrator';
import { runReaderAgent } from './pipeline/reader-agent';
import { deduplicateAndRank } from './pipeline/deduplicator';
import { fetchMarketSnapshot } from './pipeline/market-data';
import { runWriterAgent } from './pipeline/writer-agent';
import { formatSnapshot } from './pipeline/market-data';
import { generateBriefingGraphic } from './output/graphic-generator';
import { generateGRWMScript, formatScriptForDisplay } from './output/script-generator';
import { generateGRWMVideo, buildHiggsfieldPrompt } from './output/higgsfield-client';
import { Briefing, MarketOverview } from './schemas';
import { GenerationResult, MarketSnapshot } from './types';

async function run(): Promise<GenerationResult> {
  const date = format(new Date(), 'MMMM d, yyyy');
  console.log(`\n=== Freeport Morning Briefing Generator ===`);
  console.log(`Date: ${date}\n`);

  mkdirSync('./output', { recursive: true });

  // Step 1: Fetch all sources
  console.log('[1/5] Fetching news sources...');
  const articles = await fetchAllSources();

  // Step 2: Reader agent — extract structured facts
  console.log('[2/5] Running reader agent...');
  const readerOutputs = await runReaderAgent(articles);

  // Step 3: Deduplicator — rank stories
  console.log('[3/5] Deduplicating and ranking stories...');
  const rankedStories = deduplicateAndRank(readerOutputs);
  console.log(`  → ${rankedStories.length} unique stories ranked`);

  // Step 4: Market data
  console.log('[4/5] Fetching live market data...');
  const snapshot = await fetchMarketSnapshot();

  // Step 5: Writer agent — generate briefing
  console.log('[5/5] Generating briefing with Claude...');
  const { briefing, overview } = await runWriterAgent(rankedStories, snapshot, new Date().toISOString());

  return finalize(briefing, overview, snapshot, date);
}

async function finalize(
  briefing: Briefing,
  overview: MarketOverview,
  snapshot: MarketSnapshot,
  date: string
): Promise<GenerationResult> {
  // Generate graphic (Claude Opus designs HTML, Puppeteer renders PNG)
  console.log('\n[Output] Generating graphic...');
  const { html: graphicSvg } = await generateBriefingGraphic(briefing, snapshot, './output/briefing');

  // Format briefing as X post text
  const briefingText = formatBriefingAsXPost(briefing);
  writeFileSync('./output/briefing.txt', briefingText, 'utf-8');

  // Format market overview
  const overviewText = `MARKET UPDATES\n\n${overview.us_overview}\n\n${overview.commodities}\n\n${overview.crypto}\n\n${overview.sector_rotation}`;
  writeFileSync('./output/overview.txt', overviewText, 'utf-8');

  // Generate GRWM script
  console.log('[Output] Generating GRWM script...');
  const grwmScript = await generateGRWMScript(briefing);
  const scriptText = formatScriptForDisplay(grwmScript);
  writeFileSync('./output/grwm-script.txt', scriptText, 'utf-8');

  // Generate Higgsfield video prompt (always useful to have)
  const videoPrompt = buildHiggsfieldPrompt(grwmScript);
  writeFileSync('./output/higgsfield-prompt.txt', videoPrompt, 'utf-8');

  // Attempt Higgsfield video generation (if API key present)
  let videoUrl = '';
  if (process.env.HIGGSFIELD_API_KEY) {
    console.log('[Output] Generating Higgsfield video...');
    try {
      videoUrl = await generateGRWMVideo(grwmScript);
      if (videoUrl) writeFileSync('./output/video-url.txt', videoUrl, 'utf-8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[video] Skipped: ${msg}`);
    }
  } else {
    console.log('[Output] Skipping video (no HIGGSFIELD_API_KEY). Prompt saved to output/higgsfield-prompt.txt');
  }

  // Save full JSON
  const result: GenerationResult = {
    date,
    briefing_text: briefingText,
    market_overview: overviewText,
    graphic_svg: graphicSvg,
    grwm_script: grwmScript,
    higgsfield_video_url: videoUrl || undefined,
  };

  writeFileSync('./output/result.json', JSON.stringify({ briefing, overview, grwmScript, videoUrl }, null, 2), 'utf-8');

  console.log('\n=== Output files ===');
  console.log('  output/briefing.png     — Graphic for X post (attach to tweet)')
  console.log('  output/briefing.html    — Open in browser to preview');
  console.log('  output/briefing.txt     — Briefing text for X post');
  console.log('  output/overview.txt     — Market overview text');
  console.log('  output/grwm-script.txt  — Video script');
  console.log('  output/higgsfield-prompt.txt — Higgsfield video prompt');
  if (videoUrl) console.log(`  output/video-url.txt    — ${videoUrl}`);
  console.log('\n=== Briefing Preview ===');
  console.log(briefingText);

  return result;
}

function formatBriefingAsXPost(briefing: Briefing): string {
  const lines: string[] = [
    `Morning Briefing — ${briefing.date}`,
    '',
    ...briefing.events.map((e) => `${e.headline}`),
    '',
    ...briefing.watch_today.map((w) => `📅 ${w.item}: ${w.description}`),
  ];
  return lines.join('\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
