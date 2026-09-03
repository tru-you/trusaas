/**
 * Serper.dev SERP API client
 * Primary Google search provider for TruData.
 * Bright Data is the fallback when SERPER_API_KEY is not set.
 */

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerperResponse {
  organic: SerperResult[];
  searchParameters?: { q: string; gl: string; hl: string };
  credits?: number;
}

const SERPER_TIMEOUT_MS = 10000;

export function serperConfigured(): boolean {
  return !!process.env.SERPER_API_KEY;
}

export async function serperSearch(
  query: string,
  opts: { gl?: string; hl?: string; location?: string; num?: number } = {},
): Promise<SerperResponse> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY not configured');

  const body: Record<string, unknown> = {
    q: query,
    gl: opts.gl || 'za',
    hl: opts.hl || 'en',
    num: opts.num || 20,
  };
  if (opts.location) body.location = opts.location;

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Serper API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();

  // Normalize to our interface
  return {
    organic: (json.organic || []).map((r: any, i: number) => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
      position: r.position || i + 1,
    })),
    searchParameters: json.searchParameters,
    credits: json.credits,
  };
}

/**
 * Convert Serper organic results into the format that engine.ts parseSerpResults expects.
 * This bridges serper's response to the existing { organic_results: [...] } shape.
 */
export function toEngineFormat(serperResponse: SerperResponse): Record<string, any> {
  return {
    organic_results: serperResponse.organic.map(r => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    })),
  };
}
