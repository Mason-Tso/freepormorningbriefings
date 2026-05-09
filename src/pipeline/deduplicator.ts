import { ReaderOutput, RankedStory } from '../schemas';

const NOISE_GATE = 3;
const MAX_STORIES = 12;
const JACCARD_THRESHOLD = 0.4;

// Newsletter/high-signal sources get a boost
const BOOSTED_SOURCES = ['ZeroHedge', 'KobeissiLetter', 'TheBlock', 'Blockworks'];

function sourceWeight(source: string): number {
  if (BOOSTED_SOURCES.some((s) => source.includes(s))) return 3;
  if (source.includes('Reuters') || source.includes('Bloomberg') || source.includes('WSJ')) return 2;
  return 1;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split('-'));
  const setB = new Set(b.split('-'));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function sharedEntityCount(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  return [...wordsA].filter((w) => wordsB.has(w)).length;
}

interface StoryGroup {
  fingerprint: string;
  items: ReaderOutput[];
  sources: string[];
}

export function deduplicateAndRank(items: ReaderOutput[]): RankedStory[] {
  // Filter noise
  const filtered = items.filter((i) => i.importance >= NOISE_GATE && i.category !== 'price_action');

  // Group by fingerprint
  const groups = new Map<string, StoryGroup>();

  for (const item of filtered) {
    const fp = item.story_fingerprint;

    // Check if this fingerprint merges with an existing one (Jaccard similarity)
    let mergedKey: string | null = null;
    for (const [key] of groups) {
      if (jaccardSimilarity(key, fp) >= JACCARD_THRESHOLD) {
        mergedKey = key;
        break;
      }
    }

    const key = mergedKey ?? fp;
    if (!groups.has(key)) {
      groups.set(key, { fingerprint: key, items: [], sources: [] });
    }
    const group = groups.get(key)!;
    group.items.push(item);
  }

  // Entity-based merge pass: same category + 2+ shared entities
  const groupList = [...groups.values()];
  const merged = new Set<number>();

  for (let i = 0; i < groupList.length; i++) {
    if (merged.has(i)) continue;
    for (let j = i + 1; j < groupList.length; j++) {
      if (merged.has(j)) continue;
      const a = groupList[i];
      const b = groupList[j];
      const sameCategory = a.items[0]?.category === b.items[0]?.category;
      const sharedEntities =
        sharedEntityCount(a.items[0]?.headline_fact ?? '', b.items[0]?.headline_fact ?? '') >= 2;

      if (sameCategory && sharedEntities) {
        a.items.push(...b.items);
        merged.add(j);
      }
    }
  }

  const finalGroups = groupList.filter((_, i) => !merged.has(i));

  // Score and rank
  const ranked: RankedStory[] = finalGroups.map((group) => {
    const topItem = group.items.reduce((a, b) => (a.importance > b.importance ? a : b));
    const sourceCounts = group.items.length;

    // Score = avg importance * source weight bonus
    const avgImportance =
      group.items.reduce((s, i) => s + i.importance, 0) / group.items.length;
    const srcBoost = Math.log2(sourceCounts + 1);
    const score = avgImportance * (1 + srcBoost);

    return {
      fingerprint: group.fingerprint,
      headline_fact: topItem.headline_fact,
      tickers: [...new Set(group.items.flatMap((i) => i.tickers))],
      sentiment: topItem.sentiment,
      category: topItem.category,
      importance: topItem.importance,
      source_count: sourceCounts,
      score,
      sources: [...new Set(group.items.map((_, idx) => group.items[idx]?.story_fingerprint ?? ''))],
    };
  });

  return ranked.sort((a, b) => b.score - a.score).slice(0, MAX_STORIES);
}
