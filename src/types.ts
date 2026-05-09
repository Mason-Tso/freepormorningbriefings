export interface MarketPrice {
  symbol: string;
  price: number;
  change_pct: number;
  label: string;
}

export interface MarketSnapshot {
  indices: MarketPrice[];
  commodities: MarketPrice[];
  crypto: MarketPrice[];
  bonds: MarketPrice[];
  fetchedAt: string;
}

export interface GRWMScript {
  hook: string;
  body: string[];
  outro: string;
  full_text: string;
  estimated_duration_secs: number;
}

export interface GenerationResult {
  date: string;
  briefing_text: string;
  market_overview: string;
  graphic_svg: string;
  grwm_script: GRWMScript;
  higgsfield_video_url?: string;
}
