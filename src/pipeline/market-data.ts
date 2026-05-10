import axios from 'axios';
import { MarketSnapshot, MarketPrice } from '../types';

const FMP_STABLE = 'https://financialmodelingprep.com/stable';
const CG_BASE = 'https://pro-api.coingecko.com/api/v3';

interface FmpStableQuote {
  symbol: string;
  name?: string;
  price: number;
  changePercentage: number;
}

async function fetchFmpOne(symbol: string): Promise<FmpStableQuote | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;
  try {
    const { data } = await axios.get<FmpStableQuote[]>(`${FMP_STABLE}/quote`, {
      params: { symbol, apikey: apiKey },
      timeout: 8000,
    });
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchFmpMany(symbols: string[]): Promise<Record<string, FmpStableQuote>> {
  const results = await Promise.all(symbols.map((s) => fetchFmpOne(s)));
  const out: Record<string, FmpStableQuote> = {};
  for (let i = 0; i < symbols.length; i++) {
    const q = results[i];
    if (q) out[symbols[i]] = q;
  }
  return out;
}

async function fetchYahooFallback(symbols: string[]): Promise<Record<string, MarketPrice>> {
  const results: Record<string, MarketPrice> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
        const { data } = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000,
        });
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return;
        const price = meta.regularMarketPrice as number;
        const prev = meta.chartPreviousClose as number;
        results[symbol] = {
          symbol,
          price,
          change_pct: prev ? Math.round(((price - prev) / prev) * 10000) / 100 : 0,
          label: symbol,
        };
      } catch { /* skip */ }
    })
  );
  return results;
}

function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

// Hyperliquid perp mid prices — trades 24/7, used as weekend crypto fallback
async function fetchHyperliquid(): Promise<Record<string, MarketPrice>> {
  try {
    const { data: mids } = await axios.post<Record<string, string>>(
      'https://api.hyperliquid.xyz/info',
      { type: 'allMids' },
      { timeout: 8000 }
    );
    // Get 24h candle to calculate % change
    const coins: Array<{ hl: string; symbol: string; label: string }> = [
      { hl: 'BTC', symbol: 'BTCUSD', label: 'BTC' },
      { hl: 'ETH', symbol: 'ETHUSD', label: 'ETH' },
      { hl: 'SOL', symbol: 'SOLUSD', label: 'SOL' },
    ];
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    const results: Record<string, MarketPrice> = {};
    await Promise.all(
      coins.map(async ({ hl, symbol, label }) => {
        const price = parseFloat(mids[hl] ?? '0');
        if (!price) return;
        try {
          const { data: candles } = await axios.post<Array<{ o: string }>>(
            'https://api.hyperliquid.xyz/info',
            { type: 'candleSnapshot', req: { coin: hl, interval: '1d', startTime: yesterday, endTime: now } },
            { timeout: 8000 }
          );
          const open = parseFloat(candles?.[0]?.o ?? '0');
          const change_pct = open ? Math.round(((price - open) / open) * 10000) / 100 : 0;
          results[symbol] = { symbol, price, change_pct, label };
        } catch {
          results[symbol] = { symbol, price, change_pct: 0, label };
        }
      })
    );
    return results;
  } catch {
    return {};
  }
}

async function fetchCoinGecko(): Promise<Record<string, MarketPrice>> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const params: Record<string, string> = {
    ids: 'bitcoin,ethereum,solana',
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  };
  if (apiKey) params['x_cg_pro_api_key'] = apiKey;

  try {
    const { data } = await axios.get<Record<string, { usd: number; usd_24h_change: number }>>(
      `${CG_BASE}/simple/price`,
      { params, timeout: 10000 }
    );
    const map: Record<string, { symbol: string; label: string }> = {
      bitcoin: { symbol: 'BTCUSD', label: 'BTC' },
      ethereum: { symbol: 'ETHUSD', label: 'ETH' },
      solana: { symbol: 'SOLUSD', label: 'SOL' },
    };
    const results: Record<string, MarketPrice> = {};
    for (const [id, meta] of Object.entries(map)) {
      const coin = data[id];
      if (coin) {
        results[meta.symbol] = {
          symbol: meta.symbol,
          price: coin.usd,
          change_pct: Math.round((coin.usd_24h_change ?? 0) * 100) / 100,
          label: meta.label,
        };
      }
    }
    return results;
  } catch {
    return {};
  }
}

function toPrice(q: FmpStableQuote, label: string): MarketPrice {
  return { symbol: q.symbol, price: q.price, change_pct: q.changePercentage, label };
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const indexSymbols = ['^GSPC', '^NDX', '^DJI', '^RUT', '^VIX', '^TNX'];
  const commSymbols = ['CLUSD', 'BZUSD', 'GCUSD', 'SIUSD', 'NGUSD'];
  const weekend = isWeekend();

  // On weekends use Hyperliquid for crypto (24/7 live prices + real 24h change)
  // CoinGecko is fallback if Hyperliquid fails
  const [fmpIndexes, fmpComm, hlCrypto, cgCrypto] = await Promise.all([
    fetchFmpMany(indexSymbols),
    fetchFmpMany(commSymbols),
    weekend ? fetchHyperliquid() : Promise.resolve({} as Record<string, MarketPrice>),
    fetchCoinGecko(),
  ]);
  const cryptoPrices = weekend && Object.keys(hlCrypto).length > 0 ? hlCrypto : cgCrypto;

  const indexLabels: Record<string, string> = {
    '^GSPC': 'SPX', '^NDX': 'NDX', '^DJI': 'DJIA', '^RUT': 'RUT', '^VIX': 'VIX', '^TNX': 'US10Y',
  };
  const commLabels: Record<string, string> = {
    'CLUSD': 'WTI', 'BZUSD': 'Brent', 'GCUSD': 'Gold', 'SIUSD': 'Silver', 'NGUSD': 'Nat Gas',
  };

  // Build index map, fall back to Yahoo for any missing
  const indexMap: Record<string, MarketPrice> = {};
  for (const sym of indexSymbols) {
    const q = fmpIndexes[sym];
    if (q) indexMap[sym] = toPrice(q, indexLabels[sym]);
  }

  const missingIndexes = indexSymbols.filter((s) => !indexMap[s]);
  if (missingIndexes.length > 0) {
    const fallback = await fetchYahooFallback(missingIndexes);
    for (const [sym, p] of Object.entries(fallback)) {
      indexMap[sym] = { ...p, label: indexLabels[sym] ?? sym };
    }
  }

  // Commodity map
  const commMap: Record<string, MarketPrice> = {};
  for (const sym of commSymbols) {
    const q = fmpComm[sym];
    if (q) commMap[sym] = toPrice(q, commLabels[sym]);
  }

  const missingComm = ['CL=F', 'BZ=F', 'GC=F', 'SI=F', 'NG=F'].filter((_, i) => !commMap[commSymbols[i]]);
  if (missingComm.length > 0) {
    const fallback = await fetchYahooFallback(missingComm);
    const yahooMap: Record<string, string> = { 'CL=F': 'CLUSD', 'BZ=F': 'BZUSD', 'GC=F': 'GCUSD', 'SI=F': 'SIUSD', 'NG=F': 'NGUSD' };
    for (const [ySym, fmpSym] of Object.entries(yahooMap)) {
      if (!commMap[fmpSym] && fallback[ySym]) {
        commMap[fmpSym] = { ...fallback[ySym], label: commLabels[fmpSym] };
      }
    }
  }

  const empty = (sym: string, label: string): MarketPrice => ({ symbol: sym, price: 0, change_pct: 0, label });

  return {
    indices: ['^GSPC', '^NDX', '^DJI', '^RUT', '^VIX'].map((s) => indexMap[s] ?? empty(s, indexLabels[s])),
    commodities: commSymbols.map((s) => commMap[s] ?? empty(s, commLabels[s])),
    crypto: ['BTCUSD', 'ETHUSD', 'SOLUSD'].map((s) => cryptoPrices[s] ?? empty(s, s.replace('USD', ''))),
    bonds: [indexMap['^TNX'] ?? empty('^TNX', 'US10Y')],
    fetchedAt: new Date().toISOString(),
  };
}

export function formatSnapshot(snap: MarketSnapshot): string {
  const fmt = (p: MarketPrice) => {
    const sign = p.change_pct >= 0 ? '+' : '';
    const price =
      p.price > 1000
        ? p.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : p.price.toFixed(2);
    return `${p.label} ${price} ${sign}${p.change_pct.toFixed(2)}%`;
  };
  return [
    '--- INDICES ---',
    snap.indices.map(fmt).join(' | '),
    `US10Y ${snap.bonds[0]?.price.toFixed(3) ?? 'N/A'}% (${snap.bonds[0]?.change_pct >= 0 ? '+' : ''}${snap.bonds[0]?.change_pct.toFixed(2)}%)`,
    '--- COMMODITIES ---',
    snap.commodities.map(fmt).join(' | '),
    '--- CRYPTO (24h) ---',
    snap.crypto.map(fmt).join(' | '),
  ].join('\n');
}

export function formatSnapshotOneLiner(snap: MarketSnapshot, weekend = false): string {
  const key = [
    snap.indices.find((i) => i.label === 'SPX'),
    snap.indices.find((i) => i.label === 'NDX'),
    snap.crypto.find((i) => i.label === 'BTC'),
    snap.commodities.find((i) => i.label === 'WTI'),
    snap.commodities.find((i) => i.label === 'Gold'),
    snap.bonds[0],
  ].filter((p): p is MarketPrice => !!p && p.price > 0);

  return key
    .map((p) => {
      const sign = p.change_pct >= 0 ? '+' : '';
      const price =
        p.label === 'BTC'
          ? `$${p.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          : p.label === 'WTI' || p.label === 'Gold'
          ? `$${p.price.toFixed(0)}`
          : p.label === 'US10Y'
          ? `${p.price.toFixed(2)}%`
          : p.price.toLocaleString('en-US', { maximumFractionDigits: 0 });
      return `${p.label} ${price} (${sign}${p.change_pct.toFixed(1)}%)`;
    })
    .join('  ·  ') + (weekend ? '  (indices/commodities: Fri close)' : '');
}
