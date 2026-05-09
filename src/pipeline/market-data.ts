import axios from 'axios';
import { MarketSnapshot, MarketPrice } from '../types';

// Yahoo Finance v8 chart API — no auth required
async function fetchYahoo(symbols: string[]): Promise<Record<string, MarketPrice>> {
  const results: Record<string, MarketPrice> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
        const { data } = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000,
        });
        const result = data?.chart?.result?.[0];
        if (!result) return;

        const meta = result.meta;
        const price = meta.regularMarketPrice as number;
        const prevClose = meta.chartPreviousClose as number;
        const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

        results[symbol] = {
          symbol,
          price,
          change_pct: Math.round(changePct * 100) / 100,
          label: symbol,
        };
      } catch {
        // silently skip failed symbols
      }
    })
  );

  return results;
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const indexSymbols = ['^GSPC', '^NDX', '^RUT', '^DJI', '^VIX', '^TNX'];
  const commoditySymbols = ['CL=F', 'BZ=F', 'GC=F', 'SI=F', 'NG=F'];
  const cryptoSymbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

  const allSymbols = [...indexSymbols, ...commoditySymbols, ...cryptoSymbols];
  const prices = await fetchYahoo(allSymbols);

  const labelMap: Record<string, string> = {
    '^GSPC': 'SPX',
    '^NDX': 'NDX',
    '^RUT': 'RUT',
    '^DJI': 'DJIA',
    '^VIX': 'VIX',
    '^TNX': 'US10Y',
    'CL=F': 'WTI',
    'BZ=F': 'Brent',
    'GC=F': 'Gold',
    'SI=F': 'Silver',
    'NG=F': 'Nat Gas',
    'BTC-USD': 'BTC',
    'ETH-USD': 'ETH',
    'SOL-USD': 'SOL',
  };

  function get(sym: string): MarketPrice {
    const p = prices[sym];
    return p
      ? { ...p, label: labelMap[sym] ?? sym }
      : { symbol: sym, price: 0, change_pct: 0, label: labelMap[sym] ?? sym };
  }

  return {
    indices: indexSymbols.map(get),
    commodities: commoditySymbols.map(get),
    crypto: cryptoSymbols.map(get),
    bonds: [get('^TNX')],
    fetchedAt: new Date().toISOString(),
  };
}

export function formatSnapshot(snap: MarketSnapshot): string {
  const fmt = (p: MarketPrice) => {
    const sign = p.change_pct >= 0 ? '+' : '';
    return `${p.label} ${p.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${sign}${p.change_pct.toFixed(2)}%`;
  };

  const lines = [
    '--- INDICES ---',
    snap.indices.map(fmt).join(' | '),
    '--- COMMODITIES ---',
    snap.commodities.map(fmt).join(' | '),
    '--- CRYPTO ---',
    snap.crypto.map(fmt).join(' | '),
  ];

  return lines.join('\n');
}
