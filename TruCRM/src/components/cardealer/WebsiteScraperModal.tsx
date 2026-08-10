import React, { useEffect, useRef, useState } from 'react';
import { Globe, Search, X, Building2, Mail, Phone, Link2, Sparkles, Plus, Check, Loader2, List, Zap } from 'lucide-react';
import { CarDealership, ClassifiedSource } from '../../types/carDealer';
import { socket } from '../../lib/socket';
import { apiFetch } from '../../lib/api';

interface ScrapeResult {
  title: string;
  description: string;
  emails: string[];
  phones: string[];
  stockLinks: string[];
  url: string;
  fetchedAt: string;
  structured?: {
    name?: string;
    location?: string;
    brands?: string[];
    inventoryEstimate?: number | null;
    keyProducts?: string[];
  } | null;
  message?: string;
}

interface BatchItem {
  url: string;
  ok: boolean;
  error?: string;
  result?: ScrapeResult;
}

interface WebsiteScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDealer: (dealer: CarDealership) => void;
  existingDealerNames: string[];
}

const SAMPLE_BATCH = `Toyota Cape Town — https://www.exampletoyota.co.za
BMW Midrand — https://www.examplebmw.co.za
Used cars Durban — https://www.exampleusedcars.co.za`;

const dealerNameOf = (item: BatchItem) => {
  const r = item.result;
  return r?.structured?.name || r?.title || item.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
};

export const WebsiteScraperModal: React.FC<WebsiteScraperModalProps> = ({
  isOpen,
  onClose,
  onImportDealer,
  existingDealerNames,
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [url, setUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  // Batch state
  const [batchResults, setBatchResults] = useState<BatchItem[]>([]);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [importedUrls, setImportedUrls] = useState<string[]>([]);
  const batchResultsRef = useRef<BatchItem[]>([]);
  const doneRef = useRef(0);

  // Live batch progress via Socket.IO
  useEffect(() => {
    if (!isOpen) return;
    const onProgress = (payload: any) => {
      if (payload?.event !== 'done' || !payload?.url) return;
      const item: BatchItem = {
        url: payload.url,
        ok: payload.ok === true,
        error: payload.error,
        result: undefined,
      };
      doneRef.current += 1;
      const existing = batchResultsRef.current.some((r) => r.url === payload.url);
      const next = existing
        ? batchResultsRef.current.map((r) => (r.url === payload.url ? item : r))
        : [...batchResultsRef.current, item];
      batchResultsRef.current = next;
      setBatchResults(next);
      setBatchDone(doneRef.current);
    };
    socket.on('scrape:progress', onProgress);
    return () => {
      socket.off('scrape:progress', onProgress);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const resetAll = () => {
    setUrl('');
    setBatchText('');
    setResult(null);
    setError(null);
    setImported(false);
    setBatchResults([]);
    setBatchDone(0);
    setBatchTotal(0);
    setImportedUrls([]);
    batchResultsRef.current = [];
    doneRef.current = 0;
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsScraping(true);
    setError(null);
    setResult(null);
    setImported(false);

    try {
      const res = await apiFetch('/api/cardealer/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Failed to scrape website.');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server.');
    } finally {
      setIsScraping(false);
    }
  };

  const parseBatchUrls = (): string[] =>
    batchText
      .split('\n')
      .map((l) => {
        const m = l.match(/(https?:\/\/[^\s]+)/i);
        return m ? m[1].replace(/[,;]+$/, '') : '';
      })
      .filter(Boolean);

  const handleBatchScrape = async () => {
    const urls = parseBatchUrls();
    if (urls.length === 0) {
      setError('No valid URLs found. Paste one URL per line (optionally prefixed by a name).');
      return;
    }
    setIsScraping(true);
    setError(null);
    setBatchResults([]);
    setBatchDone(0);
    setBatchTotal(urls.length);
    setImportedUrls([]);

    try {
      const res = await apiFetch('/api/cardealer/scrape-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, socketId: socket.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Batch scrape failed.');
        setBatchTotal(0);
        return;
      }
      const items: BatchItem[] = (data.results || []).map((r: any) => ({
        url: r.url,
        ok: r.ok,
        error: r.error,
        result: r.ok ? r : undefined,
      }));
      batchResultsRef.current = items;
      setBatchResults(items);
      const doneCount = items.filter((i) => i.ok || i.error).length;
      doneRef.current = doneCount;
      setBatchDone(doneCount);
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server.');
    } finally {
      setIsScraping(false);
    }
  };

  const importBatchItem = (item: BatchItem) => {
    const name = dealerNameOf(item);
    if (existingDealerNames.includes(name)) {
      setError(`${name} is already indexed.`);
      return;
    }
    const newDealer: CarDealership = {
      id: `scraped-${Date.now()}`,
      name,
      status: 'identified',
      source: 'google',
      location: item.result?.structured?.location || 'Unknown',
      address: item.url,
      phone: item.result?.phones?.[0] || '',
      email: item.result?.emails?.[0] || '',
      contactPerson: 'Found via website scrape',
      inventoryCount: item.result?.structured?.inventoryEstimate || 0,
      avgVehiclePrice: 0,
      rating: 0,
      reviewsCount: 0,
      website: item.url,
      franchiseMakes: item.result?.structured?.brands || [],
      notes: `Scraped from ${item.url}. ${item.result?.description || ''}`.trim(),
    };
    onImportDealer(newDealer);
    setImportedUrls((prev) => [...prev, item.url]);
  };

  const importAll = () => {
    batchResults
      .filter((i) => i.ok && !existingDealerNames.includes(dealerNameOf(i)))
      .forEach(importBatchItem);
  };

  const successfulCount = batchResults.filter((i) => i.ok).length;
  const alreadyImported = batchResults.filter((i) => i.ok && importedUrls.includes(i.url)).length;

  const stockLinkHost = (() => {
    try {
      return new URL(result?.url || '').hostname;
    } catch {
      return '';
    }
  })();

  return (
    <div className="fixed inset-0 bg-[rgba(10,20,32,0.40)] backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[rgba(10,20,32,0.08)] w-full max-w-3xl max-h-[90vh] overflow-y-auto text-[#1A2332]">
        <div className="sticky top-0 bg-white p-5 border-b border-[rgba(10,20,32,0.08)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1A2332] flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#0E9D98]" />
              Prospect Website Scraper
            </h3>
            <p className="text-xs text-[#6B7685] mt-0.5">
              Scrape one site, or paste your whole list of dealers for a wide scrape.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetAll} className="p-1.5 text-[#6B7685] hover:text-[#1A2332] bg-[#EFEDE8]/60 rounded-lg" title="Reset">
              <Sparkles className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-[#6B7685] hover:text-[#1A2332] bg-[#EFEDE8]/60 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode switcher */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode('single')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'single' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-[#EFEDE8] text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Single site
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'batch' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-[#EFEDE8] text-[#6B7685] hover:text-[#1A2332]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Wide scrape (list)
            </button>
          </div>

          {/* SINGLE MODE */}
          {mode === 'single' && (
            <form onSubmit={handleScrape} className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(10,20,32,0.50)]" />
                <input
                  type="url"
                  required
                  placeholder="https://www.dealership.co.za"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <button
                type="submit"
                disabled={isScraping || !url.trim()}
                className="px-4 py-2.5 bg-[#0E9D98] hover:bg-[#14B8A6] text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 shadow-md shadow-cyan-600/20"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Scrape
                  </>
                )}
              </button>
            </form>
          )}

          {/* BATCH MODE */}
          {mode === 'batch' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#6B7685] flex items-center gap-1.5">
                    <List className="w-3.5 h-3.5" />
                    Dealer list — one per line
                  </label>
                  <button
                    type="button"
                    onClick={() => setBatchText(SAMPLE_BATCH)}
                    className="text-[11px] text-[#0E9D98] hover:text-[#0E9D98]"
                  >
                    Insert example
                  </button>
                </div>
                <textarea
                  rows={6}
                  placeholder={'Toyota Cape Town — https://www.dealership.co.za\nBMW Midrand — https://www.dealership2.co.za'}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(10,20,32,0.08)] bg-[#FAFAF8] text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] text-sm font-mono focus:ring-2 focus:ring-cyan-500/30 resize-y"
                />
                <p className="text-[11px] text-[rgba(10,20,32,0.50)] mt-1">
                  {parseBatchUrls().length} valid URL{parseBatchUrls().length === 1 ? '' : 's'} detected. Name labels before the URL are kept for the imported dealer.
                </p>
              </div>

              <button
                onClick={handleBatchScrape}
                disabled={isScraping || parseBatchUrls().length === 0}
                className="w-full py-3 bg-[#0E9D98] hover:bg-[#14B8A6] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-cyan-600/20"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wide scraping {batchTotal} sites…
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Wide scrape all {parseBatchUrls().length}
                  </>
                )}
              </button>

              {batchTotal > 0 && batchDone < batchTotal && (
                <div className="p-3 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)]">
                  <p className="text-xs text-[#6B7685] mb-2">
                    Processing {batchDone}/{batchTotal}…
                  </p>
                  <div className="h-1.5 bg-[#EFEDE8] rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 transition-all" style={{ width: `${(batchDone / batchTotal) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl text-xs text-rose-300">{error}</div>
          )}

          {/* SINGLE RESULT */}
          {mode === 'single' && result && (
            <div className="space-y-4">
              <div className="p-4 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-[#1A2332] text-sm">{result.structured?.name || result.title}</p>
                      <p className="text-[11px] text-[#6B7685] font-mono mt-0.5">{result.url}</p>
                      {result.description && (
                        <p className="text-xs text-[#6B7685] mt-2 line-clamp-3">{result.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {result.structured && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[rgba(10,20,32,0.08)]">
                    {result.structured.location && (
                      <div>
                        <span className="text-[10px] text-[rgba(10,20,32,0.50)] uppercase tracking-wider">Location</span>
                        <p className="text-xs font-semibold text-[#1A2332]">{result.structured.location}</p>
                      </div>
                    )}
                    {result.structured.inventoryEstimate != null && (
                      <div>
                        <span className="text-[10px] text-[rgba(10,20,32,0.50)] uppercase tracking-wider">Inventory estimate</span>
                        <p className="text-xs font-semibold text-[#1A2332]">~{result.structured.inventoryEstimate} units</p>
                      </div>
                    )}
                    {result.structured.brands && result.structured.brands.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-[10px] text-[rgba(10,20,32,0.50)] uppercase tracking-wider">Brands</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {result.structured.brands.map((b) => (
                            <span
                              key={b}
                              className="px-2 py-0.5 bg-[rgba(14,157,152,0.08)] text-[#0E9D98] border border-[rgba(14,157,152,0.20)] rounded-md text-[11px] font-semibold"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[rgba(10,20,32,0.08)]">
                  <div>
                    <span className="text-[10px] text-[rgba(10,20,32,0.50)] uppercase tracking-wider flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Emails found
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {result.emails?.length ? (
                        result.emails.map((em) => (
                          <p key={em} className="text-xs text-[#0E9D98] font-mono truncate">{em}</p>
                        ))
                      ) : (
                        <p className="text-xs text-[rgba(10,20,32,0.40)]">None found</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[rgba(10,20,32,0.50)] uppercase tracking-wider flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Numbers found
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {result.phones?.length ? (
                        result.phones.map((ph) => (
                          <p key={ph} className="text-xs text-[#334155] font-mono">{ph}</p>
                        ))
                      ) : (
                        <p className="text-xs text-[rgba(10,20,32,0.40)]">None found</p>
                      )}
                    </div>
                  </div>
                </div>

                {result.stockLinks && result.stockLinks.length > 0 && (
                  <div className="pt-3 border-t border-[rgba(10,20,32,0.08)]">
                    <span className="text-[10px] text-[rgba(10,20,32,0.50)] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Stock / inventory pages
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {result.stockLinks.slice(0, 5).map((l) => (
                        <a
                          key={l}
                          href={`${stockLinkHost}${l}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-white text-[#334155] border border-[rgba(10,20,32,0.08)] rounded-md text-[11px] font-mono hover:border-cyan-700 hover:text-[#0E9D98] transition-colors"
                        >
                          {l}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {result.message && (
                  <p className="text-[11px] text-amber-400/90 pt-2 border-t border-[rgba(10,20,32,0.08)]">{result.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setResult(null)} className="px-4 py-2 text-[#6B7685] hover:text-[#1A2332] text-xs font-semibold">
                  New scrape
                </button>
                <button
                  onClick={() => {
                    const name = result.structured?.name || result.title;
                    if (existingDealerNames.includes(name)) {
                      setError(`${name} is already indexed.`);
                      return;
                    }
                    const newDealer: CarDealership = {
                      id: `scraped-${Date.now()}`,
                      name,
                      status: 'identified',
                      source: 'google',
                      location: result.structured?.location || 'Unknown',
                      address: result.url,
                      phone: result.phones?.[0] || '',
                      email: result.emails?.[0] || '',
                      contactPerson: 'Found via website scrape',
                      inventoryCount: result.structured?.inventoryEstimate || 0,
                      avgVehiclePrice: 0,
                      rating: 0,
                      reviewsCount: 0,
                      website: result.url,
                      franchiseMakes: result.structured?.brands || [],
                      notes: `Scraped from ${result.url} on ${new Date(result.fetchedAt).toLocaleDateString()}. ${result.description || ''}`.trim(),
                    };
                    onImportDealer(newDealer);
                    setImported(true);
                  }}
                  disabled={imported}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md shadow-emerald-600/20"
                >
                  {imported ? (
                    <>
                      <Check className="w-4 h-4" />
                      Added to Market Intel
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Index as dealership
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* BATCH RESULTS */}
          {mode === 'batch' && batchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#6B7685]">
                  {successfulCount} scraped · {batchResults.length - successfulCount} failed · {alreadyImported} imported
                </p>
                <button
                  onClick={importAll}
                  disabled={importedUrls.length >= successfulCount}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 shadow-md shadow-emerald-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Import all ({successfulCount - alreadyImported})
                </button>
              </div>

              <div className="space-y-2">
                {batchResults.map((item) => {
                  const name = dealerNameOf(item);
                  const isImported = importedUrls.includes(item.url);
                  return (
                    <div
                      key={item.url}
                      className={`p-3.5 rounded-xl border ${
                        item.ok ? 'bg-[#FAFAF8] border-[rgba(10,20,32,0.08)]' : 'bg-[#FAFAF8]/60 border-[rgba(10,20,32,0.08)]/60 opacity-70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1A2332] truncate">{item.ok ? name : item.url}</p>
                          <p className="text-[11px] text-[rgba(10,20,32,0.50)] font-mono truncate mt-0.5">{item.url}</p>
                          {item.ok && (
                            <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-[#6B7685]">
                              {item.result?.structured?.location && <span>📍 {item.result.structured.location}</span>}
                              {item.result?.structured?.inventoryEstimate != null && (
                                <span>~{item.result.structured.inventoryEstimate} units</span>
                              )}
                              {item.result?.structured?.brands && item.result.structured.brands.length > 0 && (
                                <span>{item.result.structured.brands.join(', ')}</span>
                              )}
                              {item.result?.emails?.[0] && <span className="text-[#0E9D98]">{item.result.emails[0]}</span>}
                              {item.result?.phones?.[0] && <span>{item.result.phones[0]}</span>}
                            </div>
                          )}
                          {!item.ok && <p className="text-[11px] text-rose-400 mt-1">{item.error}</p>}
                        </div>
                        {item.ok &&
                          (isImported ? (
                            <span className="px-2 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-md text-[11px] font-semibold shrink-0 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Added
                            </span>
                          ) : (
                            <button
                              onClick={() => importBatchItem(item)}
                              className="px-2.5 py-1 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#1A2332] rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Import
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
