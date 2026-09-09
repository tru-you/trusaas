var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// serper.ts
var serper_exports = {};
__export(serper_exports, {
  serperConfigured: () => serperConfigured,
  serperSearch: () => serperSearch,
  toEngineFormat: () => toEngineFormat
});
function serperConfigured() {
  return !!process.env.SERPER_API_KEY;
}
async function serperSearch(query, opts = {}) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("SERPER_API_KEY not configured");
  const body = {
    q: query,
    gl: opts.gl || "za",
    hl: opts.hl || "en",
    num: opts.num || 20
  };
  if (opts.location) body.location = opts.location;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SERPER_TIMEOUT_MS)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Serper API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return {
    organic: (json.organic || []).map((r, i) => ({
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
      position: r.position || i + 1
    })),
    searchParameters: json.searchParameters,
    credits: json.credits
  };
}
function toEngineFormat(serperResponse) {
  return {
    organic_results: serperResponse.organic.map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet
    }))
  };
}
var SERPER_TIMEOUT_MS;
var init_serper = __esm({
  "serper.ts"() {
    SERPER_TIMEOUT_MS = 1e4;
  }
});

// fsbo-extractor.ts
var fsbo_extractor_exports = {};
__export(fsbo_extractor_exports, {
  extractFsboLeads: () => extractFsboLeads
});
function formatZar(amount) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0
  }).format(amount);
}
async function extractFsboLeads(suburb, city = "", maxResults = 8) {
  const cleanSuburb = suburb.split(",")[0].trim();
  const serpApiKey = process.env.SERP_API_KEY || process.env.BRIGHTDATA_API_KEY || "";
  const serpZone = process.env.SERP_ZONE || "serp";
  const liveLeads = [];
  if (process.env.SERPER_API_KEY && liveLeads.length < maxResults) {
    try {
      const { serperSearch: serperSearch2 } = await Promise.resolve().then(() => (init_serper(), serper_exports));
      const queries = [
        `${cleanSuburb} property for sale private seller`,
        `${cleanSuburb} property for sale owner Gumtree`,
        `${cleanSuburb} house for sale private seller South Africa`
      ];
      for (const q of queries) {
        if (liveLeads.length >= maxResults) break;
        const result = await serperSearch2(q, { gl: "za", num: 20 });
        for (const r of result.organic) {
          if (liveLeads.length >= maxResults) break;
          const title = String(r.title || "");
          const snippet = String(r.snippet || "");
          const link = String(r.link || "");
          const priceMatch = `${title} ${snippet}`.match(/R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,8})/i);
          if (!priceMatch) continue;
          const rawPrice = parseInt(priceMatch[1].replace(/[^\d]/g, ""), 10);
          if (rawPrice < 15e4 || rawPrice > 1e8) continue;
          const isGumtree = link.includes("gumtree.co.za");
          const isPrivateProp = link.includes("privateproperty.co.za");
          const portal = isGumtree ? "Gumtree Private" : isPrivateProp ? "Private Property (Direct)" : "Direct Classifieds";
          const phoneMatch = `${title} ${snippet}`.match(/(?:\+?27|0)\s?(?:[678]\d{1})\s?\d{3}\s?\d{4}/);
          const phone = phoneMatch ? phoneMatch[0] : "Inquire via portal";
          const cleanPhone = phoneMatch ? phoneMatch[0].replace(/[^\d]/g, "").replace(/^0/, "27") : "";
          const whatsAppUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : link;
          if (liveLeads.some((l) => l.sourceUrl === link || l.headline === title)) continue;
          liveLeads.push({
            id: `live-fsbo-${import_crypto.default.randomUUID().slice(0, 8)}`,
            headline: title.replace(/[-|]\s*(Gumtree|Private Property|Property24).*$/i, "").trim(),
            suburb: cleanSuburb,
            city: city || "South Africa",
            askingPrice: rawPrice,
            formattedPrice: formatZar(rawPrice),
            ownerName: "Private Seller",
            phone,
            whatsAppUrl,
            daysListed: null,
            portalSource: portal,
            sourceUrl: link,
            propertyType: /apartment|flat/i.test(title) ? "Apartment" : "House / Property",
            source: "serp"
          });
        }
      }
    } catch (err) {
      console.warn("[FSBO-Extractor] Serper.dev note:", err?.message || err);
    }
  }
  if (liveLeads.length < maxResults && serpApiKey) {
    try {
      const q = `"${cleanSuburb}" property for sale "private seller" OR "by owner"`;
      const googleUrl = `https://www.google.co.za/search?q=${encodeURIComponent(q)}&gl=za&hl=en&num=15&brd_json=1`;
      const res = await import_axios2.default.post("https://api.brightdata.com/request", {
        zone: serpZone,
        url: googleUrl,
        format: "raw"
      }, {
        headers: {
          Authorization: `Bearer ${serpApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 1e4
      });
      const body = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      const organic = body?.organic_results || body?.organic || [];
      for (const item of Array.isArray(organic) ? organic : []) {
        if (liveLeads.length >= maxResults) break;
        const title = String(item?.title || "");
        const snippet = String(item?.snippet || item?.description || "");
        const link = String(item?.link || item?.url || "");
        const priceMatch = `${title} ${snippet}`.match(/R\s?(\d{1,3}(?:[ ,]\d{3})+|\d{5,8})/i);
        if (!priceMatch) continue;
        const rawPrice = parseInt(priceMatch[1].replace(/[^\d]/g, ""), 10);
        if (rawPrice < 25e4 || rawPrice > 1e8) continue;
        const isGumtree = link.includes("gumtree.co.za");
        const portal = isGumtree ? "Gumtree Private" : "Private Property (Direct)";
        const phoneMatch = snippet.match(/(?:\+?27|0)\s?(?:[678]\d{1})\s?\d{3}\s?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : "Contact via portal";
        const cleanPhone = phoneMatch ? phoneMatch[0].replace(/[^\d]/g, "").replace(/^0/, "27") : "";
        const whatsAppUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : link;
        liveLeads.push({
          id: `live-fsbo-${import_crypto.default.randomUUID().slice(0, 8)}`,
          headline: title.replace(/[-|]\s*(Gumtree|Private Property).*$/i, "").trim(),
          suburb: cleanSuburb,
          city: city || "South Africa",
          askingPrice: rawPrice,
          formattedPrice: formatZar(rawPrice),
          ownerName: "Private Seller",
          phone,
          whatsAppUrl,
          daysListed: null,
          portalSource: portal,
          sourceUrl: link,
          propertyType: /apartment|flat/i.test(title) ? "Apartment" : "House / Property",
          source: "serp"
        });
      }
    } catch (err) {
      console.warn("[FSBO-Extractor] SERP search note:", err?.message || err);
    }
  }
  const finalLeads = liveLeads.slice(0, maxResults);
  const avgPrice = finalLeads.length > 0 ? Math.round(finalLeads.reduce((acc, l) => acc + l.askingPrice, 0) / finalLeads.length) : 0;
  return {
    suburb: cleanSuburb,
    city: city || "South Africa",
    count: finalLeads.length,
    leads: finalLeads,
    averageAskingPrice: avgPrice,
    scannedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var import_axios2, import_crypto;
var init_fsbo_extractor = __esm({
  "fsbo-extractor.ts"() {
    import_axios2 = __toESM(require("axios"));
    import_crypto = __toESM(require("crypto"));
  }
});

// legacy-finder/detector.ts
function auditWebsite(url, html, headers, loadTimeMs, currency = "R") {
  const $ = cheerio2.load(html);
  const defects = [];
  let deduction = 0;
  const rawHtml = html.toLowerCase();
  const isHttps = url.startsWith("https://");
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  const hasViewportMeta = viewport.includes("width=device-width") || viewport.includes("initial-scale");
  if (!hasViewportMeta) {
    deduction += 35;
    defects.push({
      id: "NO_VIEWPORT",
      category: "MOBILE",
      severity: "CRITICAL",
      title: "Missing Mobile Viewport Tag (Broken on Mobile)",
      description: "The website does not declare a responsive viewport. Mobile visitors see a shrunken, non-scrollable desktop page requiring pinch-to-zoom.",
      agencyPitchAngle: "Over 65% of local commercial search traffic is on mobile. This site is actively losing high-intent client calls every single day."
    });
  }
  const hasFrames = $("frameset, frame").length > 0;
  const hasFlash = rawHtml.includes(".swf") || $("object, embed").length > 0;
  if (hasFrames || hasFlash) {
    deduction += 25;
    defects.push({
      id: "OBSOLETE_FRAMES_FLASH",
      category: "OBSOLETE_TECH",
      severity: "CRITICAL",
      title: "Obsolete Legacy Architecture (Frames or Flash)",
      description: "The site utilizes deprecated HTML frames or Flash elements that are completely blocked by modern iOS, Android, and Chromium browsers.",
      agencyPitchAngle: "Major browsers refuse to render these components. A modern clean HTML5/React/WordPress rebuild is mandatory."
    });
  }
  if (!isHttps) {
    deduction += 25;
    defects.push({
      id: "NO_SSL",
      category: "SECURITY",
      severity: "CRITICAL",
      title: "No SSL / Unencrypted HTTP Protocol",
      description: 'The website serves unencrypted HTTP traffic. Google Chrome and Safari flag the domain with an intimidating "Not Secure" warning in the address bar.',
      agencyPitchAngle: "Visitors immediately bounce when seeing browser security warnings. Immediate trust failure."
    });
  }
  let cms = "Custom HTML / PHP";
  if (rawHtml.includes("/wp-content/") || rawHtml.includes("wp-json")) {
    cms = "WordPress";
    if (rawHtml.includes("twentyten") || rawHtml.includes("twentyeleven") || rawHtml.includes("wp-content/themes/default")) {
      cms = "Legacy WordPress (< v4.5)";
      deduction += 15;
      defects.push({
        id: "LEGACY_WP",
        category: "OBSOLETE_TECH",
        severity: "HIGH",
        title: "Severely Outdated WordPress Installation",
        description: "Running an obsolete theme and core version with known security vulnerabilities and unpatched CVEs.",
        agencyPitchAngle: "High vulnerability to automated malware and defacement bots. Urgent upgrade required."
      });
    }
  } else if (rawHtml.includes("/media/system/js/") || rawHtml.includes("joomla")) {
    cms = "Joomla (Legacy)";
    deduction += 20;
    defects.push({
      id: "LEGACY_JOOMLA",
      category: "OBSOLETE_TECH",
      severity: "HIGH",
      title: "Outdated Joomla CMS Architecture",
      description: "The site is built on an unmaintained legacy Joomla installation that is incompatible with modern PHP 8+ hosting.",
      agencyPitchAngle: "Host is likely running insecure legacy PHP. Perfect candidate for a high-value redesign."
    });
  } else if (rawHtml.includes("wix.com") || rawHtml.includes("wixsite")) {
    cms = "Wix (Basic)";
  } else if (rawHtml.includes("squarespace")) {
    cms = "Squarespace";
  }
  const usesOutdatedJQuery = /jquery[.-](1\.[0-8]\.[0-9]+)/i.test(rawHtml);
  if (usesOutdatedJQuery) {
    deduction += 10;
    defects.push({
      id: "OLD_JQUERY",
      category: "OBSOLETE_TECH",
      severity: "MEDIUM",
      title: "Vulnerable JavaScript Libraries (jQuery 1.x)",
      description: "Using ancient jQuery versions with cross-site scripting (XSS) vulnerabilities and slow execution.",
      agencyPitchAngle: "Causes script errors on modern iOS/macOS Safari."
    });
  }
  const hasSchemaOrg = $('script[type="application/ld+json"]').length > 0 || $("[itemscope]").length > 0;
  if (!hasSchemaOrg) {
    deduction += 10;
    defects.push({
      id: "NO_SCHEMA",
      category: "SEO",
      severity: "HIGH",
      title: "Missing Schema.org LocalBusiness Structured Data",
      description: "The site lacks structured data markup, preventing Google from generating rich snippets, operating hours, and local map highlights.",
      agencyPitchAngle: "Outranked on Google Maps by local competitors with Schema-optimized pages."
    });
  }
  const metaDesc = $('meta[name="description"]').attr("content");
  const hasMetaDescription = !!metaDesc && metaDesc.length > 20;
  if (!hasMetaDescription) {
    deduction += 8;
    defects.push({
      id: "NO_META_DESC",
      category: "SEO",
      severity: "MEDIUM",
      title: "Missing or Broken Meta Description",
      description: "Search results show messy scrapings of navigation text instead of an engaging, high-converting snippet.",
      agencyPitchAngle: "Substantial click-through rate (CTR) deficit on Google organic listings."
    });
  }
  const estimatedLoadSeconds = parseFloat((loadTimeMs / 1e3).toFixed(2));
  if (loadTimeMs > 4500) {
    deduction += 15;
    defects.push({
      id: "SLOW_LCP",
      category: "PERFORMANCE",
      severity: "HIGH",
      title: `Slow Page Load Speed (${estimatedLoadSeconds}s)`,
      description: "Exceeds Google Core Web Vitals threshold (>2.5s). High bounce rate and search rank penalty.",
      agencyPitchAngle: "53% of mobile visits are abandoned if a site takes longer than 3 seconds to load."
    });
  }
  const hasGoogleAnalyticsOrPixel = rawHtml.includes("gtag") || rawHtml.includes("google-analytics") || rawHtml.includes("fbq(") || rawHtml.includes("googletagmanager");
  if (!hasGoogleAnalyticsOrPixel) {
    deduction += 8;
    defects.push({
      id: "NO_ANALYTICS",
      category: "SEO",
      severity: "MEDIUM",
      title: "Zero Tracking or Conversion Analytics",
      description: "The business has no Google Analytics or Meta Pixel tracking, flying blind on marketing ROI.",
      agencyPitchAngle: "They have no idea where their customers are coming from or which campaigns work."
    });
  }
  const score = Math.max(15, Math.min(98, 100 - deduction));
  let estimatedPitchValue = `${currency} 25,000 - ${currency} 40,000`;
  if (currency === "\xA3") {
    estimatedPitchValue = score < 40 ? "\xA32,500 - \xA34,500" : "\xA31,500 - \xA32,800";
  } else {
    estimatedPitchValue = score < 40 ? "R 35,000 - R 55,000" : "R 22,000 - R 38,000";
  }
  const techStack = {
    cms,
    server: headers["server"] || "Standard Cloud",
    hasViewportMeta,
    isSslValid: isHttps,
    usesOutdatedJQuery,
    hasFlashOrFrames: hasFrames || hasFlash,
    hasSchemaOrg,
    hasMetaDescription,
    hasGoogleAnalyticsOrPixel,
    estimatedLoadSeconds
  };
  return {
    score,
    defects,
    techStack,
    estimatedPitchValue
  };
}
var cheerio2;
var init_detector = __esm({
  "legacy-finder/detector.ts"() {
    cheerio2 = __toESM(require("cheerio"));
  }
});

// legacy-finder/contacts.ts
function extractPhones(text, html, country = "za") {
  const phones = /* @__PURE__ */ new Set();
  const telRegex = /href=["']tel:([^"']+)["']/gi;
  let match;
  while ((match = telRegex.exec(html)) !== null) {
    const raw = match[1].replace(/[\s\-\(\)\.]/g, "");
    if (raw.length >= 9 && raw.length <= 15) {
      phones.add(formatPhone(raw, country));
    }
  }
  const zaPattern = /(?:(?:\+27|0027)\s*\(?0?\)?|0)\s*[1-8](?:[\s\-]?[0-9]){8}/g;
  const ukPattern = /(?:(?:\+44|0044)\s*\(?0?\)?|0)\s*[1-9](?:[\s\-]?[0-9]){9}/g;
  const pattern = country === "uk" ? ukPattern : zaPattern;
  const textMatches = text.match(pattern) || [];
  textMatches.forEach((p) => {
    const clean = p.replace(/[\s\-\(\)\.]/g, "");
    if (clean.length >= 9 && clean.length <= 14) {
      phones.add(formatPhone(clean, country));
    }
  });
  return Array.from(phones).slice(0, 6);
}
function formatPhone(phone, country) {
  let p = phone.replace(/[^\d+]/g, "");
  if (country === "za") {
    if (p.startsWith("0") && p.length === 10) {
      return `+27 ${p.slice(1, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
    }
    if (p.startsWith("27") && p.length === 11) {
      return `+27 ${p.slice(2, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
    }
    if (p.startsWith("+27") && p.length === 12) {
      return `+27 ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8)}`;
    }
  } else if (country === "uk") {
    if (p.startsWith("0") && p.length === 11) {
      return `+44 ${p.slice(1, 5)} ${p.slice(5)}`;
    }
  }
  return p;
}
function extractEmails(text, html) {
  const emails = /* @__PURE__ */ new Set();
  const mailtoRegex = /href=["']mailto:([^"'\?]+)/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].trim().toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const textMatches = text.match(emailPattern) || [];
  textMatches.forEach((e) => {
    const email = e.trim().toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  });
  return Array.from(emails).slice(0, 6);
}
function isValidEmail(email) {
  if (!email || email.length > 80 || email.length < 5) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;
  for (const blacklisted of EMAIL_BLACKLIST) {
    if (email.includes(blacklisted)) return false;
  }
  return true;
}
function extractWhatsAppLinks(html) {
  const links = /* @__PURE__ */ new Set();
  const waRegex = /(https?:\/\/(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/)[0-9+]+)/gi;
  let match;
  while ((match = waRegex.exec(html)) !== null) {
    links.add(match[1]);
  }
  return Array.from(links);
}
function parseContactPage($, country = "za") {
  const text = $("body").text();
  const html = $.html();
  const phones = extractPhones(text, html, country);
  const emails = extractEmails(text, html);
  const whatsAppLinks = extractWhatsAppLinks(html);
  const socialLinks = {};
  $('a[href*="facebook.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && !href.includes("sharer") && !socialLinks.facebook) socialLinks.facebook = href;
  });
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && !socialLinks.instagram) socialLinks.instagram = href;
  });
  $('a[href*="linkedin.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && !socialLinks.linkedin) socialLinks.linkedin = href;
  });
  $('a[href*="google.com/maps"], a[href*="maps.google.com"], a[href*="goo.gl/maps"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && !socialLinks.googleMaps) socialLinks.googleMaps = href;
  });
  let address;
  $('[class*="address"], [class*="location"], [itemprop="address"], address').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (t.length > 10 && t.length < 200 && !address) {
      address = t;
    }
  });
  const contactPagesFound = [];
  $('a[href*="contact"], a[href*="about"], a[href*="reach"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && !contactPagesFound.includes(href)) {
      contactPagesFound.push(href);
    }
  });
  return {
    phones,
    whatsAppLinks,
    emails,
    address,
    contactPagesFound: contactPagesFound.slice(0, 4),
    socialLinks
  };
}
var EMAIL_BLACKLIST;
var init_contacts = __esm({
  "legacy-finder/contacts.ts"() {
    EMAIL_BLACKLIST = [
      "example.com",
      "domain.com",
      "email.com",
      "yoursite.com",
      "company.com",
      "sentry.io",
      "wixpress.com",
      "wordpress.org",
      "cloudflare.com",
      "googleapis.com",
      "schema.org",
      "w3.org",
      "jquery.com",
      "bootstrap.com",
      "fontawesome.com"
    ];
  }
});

// legacy-finder/crawler.ts
var crawler_exports = {};
__export(crawler_exports, {
  crawlLegacySites: () => crawlLegacySites
});
async function crawlLegacySites(request) {
  const { city, industry, country = "za", maxResults = 10 } = request;
  const currency = country === "uk" ? "\xA3" : "R";
  const query = `${industry} in ${city}`;
  console.log(`[LegacyFinder] Starting crawl for: "${query}" (${country.toUpperCase()})`);
  const candidateDomains = await discoverBusinessDomains(industry, city, country, maxResults * 3);
  console.log(`[LegacyFinder] Discovered ${candidateDomains.length} candidate business domains.`);
  const targets = [];
  const CONCURRENCY = 5;
  const candidates = candidateDomains.slice(0, maxResults * 3);
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    if (targets.length >= maxResults) break;
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(
        (domainInfo) => auditDomain(domainInfo.domain, domainInfo.title, city, industry, currency, country)
      )
    );
    for (const r of results) {
      if (targets.length >= maxResults) break;
      if (r.status === "fulfilled" && r.value) {
        targets.push(r.value);
      }
    }
  }
  const criticalDefectsFound = targets.reduce((sum, t) => sum + t.defects.filter((d) => d.severity === "CRITICAL").length, 0);
  const avgScore = targets.length > 0 ? Math.round(targets.reduce((sum, t) => sum + t.readinessScore, 0) / targets.length) : 35;
  return {
    query,
    city,
    industry,
    totalFound: targets.length,
    criticalDefectsFound,
    averageReadinessScore: avgScore,
    targets,
    scannedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function discoverBusinessDomains(industry, city, country, limit) {
  const domains = [];
  const queryStr = `${industry} ${city} contact`;
  const serpApiKey = process.env.SERP_API_KEY || process.env.BRIGHTDATA_API_KEY || "";
  const serpZone = process.env.SERP_ZONE || "serp_api1";
  const googleDomain = country === "uk" ? "google.co.uk" : "google.co.za";
  const gl = country === "uk" ? "gl=gb" : "gl=za";
  if (process.env.SERPER_API_KEY && domains.length < limit) {
    try {
      const { serperSearch: serperSearch2 } = await Promise.resolve().then(() => (init_serper(), serper_exports));
      const result = await serperSearch2(queryStr, {
        gl: country === "uk" ? "gb" : "za",
        num: 20
      });
      for (const r of result.organic) {
        if (domains.length >= limit) break;
        if (r.link.startsWith("http")) {
          try {
            const u = new URL(r.link);
            const domain = u.hostname.replace(/^www\./, "").toLowerCase();
            const isDirectory = DIRECTORY_DOMAINS.some((d) => domain.includes(d));
            if (!isDirectory && !domains.some((d) => d.domain === domain)) {
              domains.push({ domain, title: r.title || domain });
            }
          } catch {
          }
        }
      }
    } catch (err) {
      console.warn("[LegacyFinder] Serper.dev note:", err.message);
    }
  }
  if (!process.env.SERPER_API_KEY && serpApiKey && domains.length < limit) {
    try {
      const googleUrl = `https://www.${googleDomain}/search?q=${encodeURIComponent(queryStr)}&${gl}&num=20&brd_json=1`;
      const res = await import_axios3.default.post("https://api.brightdata.com/request", {
        zone: serpZone,
        url: googleUrl,
        format: "raw"
      }, {
        headers: {
          "Authorization": `Bearer ${serpApiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 12e3
      });
      const body = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
      const organic = body?.organic_results || body?.organic || [];
      for (const r of Array.isArray(organic) ? organic : []) {
        if (domains.length >= limit) break;
        const link = String(r?.link || r?.url || "");
        const title = String(r?.title || "");
        if (link.startsWith("http")) {
          try {
            const u = new URL(link);
            const domain = u.hostname.replace(/^www\./, "").toLowerCase();
            const isDirectory = DIRECTORY_DOMAINS.some((d) => domain.includes(d));
            if (!isDirectory && !domains.some((d) => d.domain === domain)) {
              domains.push({ domain, title: title || domain });
            }
          } catch {
          }
        }
      }
    } catch (err) {
      console.warn("[LegacyFinder] Bright Data SERP note:", err.message);
    }
  }
  if (domains.length < 3) {
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryStr)}`;
      const res = await import_axios3.default.get(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        },
        timeout: 6e3
      });
      const $ = cheerio3.load(res.data);
      $(".result__body, .result").each((_, el) => {
        if (domains.length >= limit) return;
        const title = $(el).find(".result__title, a.result__url").text().trim();
        let rawUrl = $(el).find("a.result__url, .result__title a").attr("href") || "";
        if (rawUrl.includes("uddg=")) {
          const match = rawUrl.match(/uddg=([^&]+)/);
          if (match) rawUrl = decodeURIComponent(match[1]);
        }
        try {
          if (rawUrl.startsWith("http")) {
            const u = new URL(rawUrl);
            const domain = u.hostname.replace(/^www\./, "").toLowerCase();
            const isDirectory = DIRECTORY_DOMAINS.some((d) => domain.includes(d));
            if (!isDirectory && !domains.some((d) => d.domain === domain)) {
              domains.push({ domain, title: title || domain });
            }
          }
        } catch (e) {
        }
      });
    } catch (err) {
      console.warn("[LegacyFinder] HTML search fallback note:", err.message);
    }
  }
  return domains;
}
async function auditDomain(domain, rawTitle, city, industry, currency, country) {
  const t0 = Date.now();
  let activeUrl = `https://${domain}`;
  let html = "";
  let headers = {};
  let loadTimeMs = 2500;
  try {
    const res = await import_axios3.default.get(activeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 7e3,
      maxRedirects: 3
    });
    html = res.data;
    headers = res.headers;
    loadTimeMs = Date.now() - t0;
  } catch (err) {
    try {
      const httpUrl = `http://${domain}`;
      const res = await import_axios3.default.get(httpUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 7e3
      });
      activeUrl = httpUrl;
      html = res.data;
      headers = res.headers;
      loadTimeMs = Date.now() - t0;
    } catch (httpErr) {
      return null;
    }
  }
  if (!html || typeof html !== "string" || html.length < 200) {
    return null;
  }
  const $ = cheerio3.load(html);
  let businessName = $("title").text().trim().split(/[-|–•]/)[0].trim() || rawTitle || domain;
  if (businessName.length > 50) businessName = businessName.slice(0, 50);
  const contacts = parseContactPage($, country);
  const audit = auditWebsite(activeUrl, html, headers, loadTimeMs, currency);
  if (contacts.phones.length === 0 && contacts.contactPagesFound.length > 0) {
    try {
      const contactUrl = new URL(contacts.contactPagesFound[0], activeUrl).toString();
      const contactRes = await import_axios3.default.get(contactUrl, { timeout: 4e3 });
      if (typeof contactRes.data === "string") {
        const $c = cheerio3.load(contactRes.data);
        const contactPageInfo = parseContactPage($c, country);
        if (contactPageInfo.phones.length > 0) contacts.phones = contactPageInfo.phones;
        if (contactPageInfo.emails.length > 0) contacts.emails = contactPageInfo.emails;
        if (contactPageInfo.address && !contacts.address) contacts.address = contactPageInfo.address;
      }
    } catch (e) {
    }
  }
  return {
    id: import_crypto2.default.randomUUID(),
    domain,
    url: activeUrl,
    businessName,
    city,
    industry,
    readinessScore: audit.score,
    defects: audit.defects,
    techStack: audit.techStack,
    contacts,
    estimatedPitchValue: audit.estimatedPitchValue,
    discoveredAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var import_axios3, cheerio3, import_crypto2, DIRECTORY_DOMAINS;
var init_crawler = __esm({
  "legacy-finder/crawler.ts"() {
    import_axios3 = __toESM(require("axios"));
    cheerio3 = __toESM(require("cheerio"));
    import_crypto2 = __toESM(require("crypto"));
    init_detector();
    init_contacts();
    DIRECTORY_DOMAINS = [
      "google.com",
      "google.co.za",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "yellowpages.co.za",
      "snupit.co.za",
      "sayellow.com",
      "gumtree.co.za",
      "property24.com",
      "privateproperty.co.za",
      "autotrader.co.za",
      "cars.co.za",
      "yell.com",
      "checkatrade.com",
      "wikipedia.org",
      "tripadvisor.co.za",
      "hellopeter.com",
      "cylex.net.za"
    ];
  }
});

// webapp/server.ts
var fs4 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var import_express = __toESM(require("express"));

// engine.ts
var import_axios = __toESM(require("axios"));
var cheerio = __toESM(require("cheerio"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var CANONICAL_MAKES = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "land rover": "Land Rover",
  landrover: "Land Rover",
  "alfa romeo": "Alfa Romeo",
  alfa: "Alfa Romeo"
};
function urlMake(make) {
  return CANONICAL_MAKES[String(make).toLowerCase().trim()] || String(make);
}
var USER_AGENT = process.env.SCRAPER_USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
var REQUEST_TIMEOUT = Number(process.env.SCRAPER_TIMEOUT_MS) || 8e3;
var CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1e3;
var MAX_RETRIES = Number(process.env.SCRAPER_MAX_RETRIES) || 2;
var WORKER_URLS = (process.env.SCRAPER_SERVICE_URLS || process.env.SCRAPER_SERVICE_URL || process.env.TRUCRM_SCRAPER_URL || "").split(",").map((u) => u.trim()).filter(Boolean);
var workerIndex = 0;
var WORKER_TIMEOUT_MS = Number(process.env.SCRAPER_WORKER_TIMEOUT_MS) || 3e4;
var DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-ZA,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache"
};
var DEALER_FINAL_THRESHOLD = Math.max(3, Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20);
var MIN_HTTP_LISTINGS = Number(process.env.SCRAPER_MIN_HTTP_LISTINGS) || 8;
var CLASSIFIEDS_PAGES = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
var SERP_TRIGGER_MAX = Math.max(0, Number(process.env.SERP_TRIGGER_MAX) || 6);
var TOTAL_BUDGET_MS = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 2e4;
function getSerpApiUrl() {
  return process.env.SERP_API_URL || "";
}
function getSerpApiKey() {
  return process.env.SERP_API_KEY || "";
}
function getSerpZone() {
  return process.env.SERP_ZONE || "serp";
}
function getSerpProvider() {
  if (process.env.SERPER_API_KEY) return "serper";
  const url = getSerpApiUrl();
  return (process.env.SERP_PROVIDER || (url.includes("brightdata") ? "brightdata" : url.includes("serpapi") ? "serpapi" : "")).toLowerCase();
}
var SERP_TIMEOUT_MS = 12e3;
function getBdApiKey() {
  return process.env.BRIGHTDATA_API_KEY || process.env.SERP_API_KEY || "";
}
function getUnlockerZone() {
  return process.env.UNLOCKER_ZONE || process.env.BRIGHTDATA_UNLOCKER_ZONE || "unlocker";
}
function isUnlockerEnabled() {
  return /^(1|true|yes)$/i.test(process.env.SCRAPER_UNLOCKER_ENABLED || "");
}
var UNLOCKER_TIMEOUT_MS = 2e4;
async function fetchWithRetry(url, config, retries = MAX_RETRIES) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await import_axios.default.get(url, config);
      return res.data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}
function num(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var MODEL_NOISE_RE = /(?:\b(?:touring|tourer|flagship|executive|luxury|limited|edition|baseline|elegance|comfort|urban|ambition|advance|style|storage|extras|bluemotion|facelift|fl|lci|plus|pack|line|se)\b)/gi;
function modelCore(text) {
  const s = String(text || "").trim().toLowerCase();
  if (!s || s === "any" || s === "-") return "";
  return s.replace(/[-_]/g, " ").replace(MODEL_NOISE_RE, " ").replace(/\s+/g, " ").trim();
}
var MAKE_ALIASES = {
  vw: ["volkswagen"],
  volkswagen: ["vw"],
  "mercedes-benz": ["mercedes", "benz", "merc"],
  mercedes: ["mercedes-benz", "benz", "merc"],
  merc: ["mercedes-benz", "mercedes", "benz"],
  "land rover": ["landrover", "landie", "range rover"],
  landrover: ["land rover", "range rover"],
  "alfa romeo": ["alfa"],
  alfa: ["alfa romeo"],
  bmw: ["b.m.w."],
  chevy: ["chevrolet"],
  chevrolet: ["chevy"],
  gwm: ["great wall", "great wall motors"]
};
function makeVariants(make) {
  const m = String(make).toLowerCase().trim();
  return [m, ...MAKE_ALIASES[m] || []];
}
var YEAR_TOLERANCE = Number(process.env.SCRAPER_YEAR_TOLERANCE) || 1;
function titleMentionsVehicle(title, make, model, year, match, opts) {
  const t = String(title || "");
  const y = parseInt(String(year), 10);
  const tolerance = opts?.yearTolerance ?? YEAR_TOLERANCE;
  if (Number.isFinite(y) && y >= 1990 && y <= 2100) {
    const ym = t.match(/\b(?:19|20)\d{2}\b/);
    if (ym && Math.abs(parseInt(ym[0], 10) - y) > tolerance) return false;
  }
  const makeOk = makeVariants(make).some((kw) => new RegExp(escapeRegex(kw), "i").test(t));
  const q = modelCore(model);
  const modelOk = !q || modelCore(t).includes(q);
  const searchDisp = (match || opts?.variant || model || "").match(/\b(\d\.\d)\b/)?.[1];
  if (searchDisp) {
    const titleDisp = t.match(/\b(\d\.\d)\b/)?.[1];
    if (titleDisp && titleDisp !== searchDisp) return false;
  }
  const isPerfSearch = /\b(gti|gtd|rs\b|amg\b|type[- ]?r|golf[- ]?r\b)\b/i.test(`${model} ${opts?.variant || ""} ${match || ""}`);
  if (!isPerfSearch) {
    const isPerfTitle = /\b(gti|gtd|rs\b|amg\b|type[- ]?r|golf[- ]?r\b)\b/i.test(t);
    if (isPerfTitle) return false;
  }
  if (opts?.variant) {
    const vWords = String(opts.variant).toLowerCase().split(/[\s\-_/]+/).filter((w) => w.length >= 2);
    const keyTokens = vWords.filter((w) => /^(?:\d\.\d|gti|gtd|tdi|tsi|tfsi|amg|4x4|4wd|gd-6|d-4d|v6|v8)$/i.test(w));
    if (keyTokens.length > 0) {
      const lowerTitle = t.toLowerCase();
      const hasKeyToken = keyTokens.some((tok) => lowerTitle.includes(tok));
      if (!hasKeyToken) return false;
    }
  }
  const matchOk = !match || new RegExp(escapeRegex(String(match)), "i").test(t);
  return makeOk && modelOk && matchOk;
}
var CIRCUIT_BREAKER_THRESHOLD = 3;
var CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1e3;
var workerFailCount = 0;
var workerCircuitOpenUntil = 0;
async function renderViaWorker(url, maxMs) {
  if (WORKER_URLS.length === 0) return null;
  if (Date.now() < workerCircuitOpenUntil) return null;
  const timeoutMs = Math.max(1, Math.min(WORKER_TIMEOUT_MS, maxMs ?? WORKER_TIMEOUT_MS));
  for (let attempt = 0; attempt < WORKER_URLS.length; attempt++) {
    const worker = WORKER_URLS[workerIndex++ % WORKER_URLS.length];
    try {
      const res = await fetch(`${worker.replace(/\/$/, "")}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body?.ok && typeof body.html === "string") {
        workerFailCount = 0;
        return body.html;
      }
    } catch (err) {
      console.warn(`[scraper] headless render failed on ${worker} for ${url}:`, err?.message || err);
    }
  }
  workerFailCount++;
  if (workerFailCount >= CIRCUIT_BREAKER_THRESHOLD) {
    workerCircuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(`[scraper] circuit breaker open \u2014 skipping headless for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1e3}s`);
  }
  return null;
}
async function brightDataFetch(targetUrl, zone, country, timeoutMs) {
  const apiKey = getBdApiKey();
  if (!apiKey) return null;
  try {
    const res = await fetch(getSerpApiUrl() || "https://api.brightdata.com/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url: targetUrl, format: "raw", country }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) {
      console.warn(`[scraper] brightDataFetch HTTP ${res.status} on ${targetUrl}`);
      return null;
    }
    const text = await res.text();
    if (text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        const maybe = parsed?.body ?? parsed?.html ?? parsed?.result;
        if (typeof maybe === "string" && maybe.length > 0) return maybe;
      } catch {
      }
    }
    return text;
  } catch (err) {
    console.warn("[scraper] brightDataFetch failed:", err?.message || err);
    return null;
  }
}
function unlockerConfigured() {
  return isUnlockerEnabled() && !!getBdApiKey();
}
async function renderViaUnlocker(url, country, maxMs) {
  if (!unlockerConfigured()) return null;
  console.log(`[scraper] Attempting Bright Data unlocker for: ${url}`);
  return brightDataFetch(url, getUnlockerZone(), country, Math.max(1, Math.min(UNLOCKER_TIMEOUT_MS, maxMs ?? UNLOCKER_TIMEOUT_MS)));
}
function serpConfigured() {
  return !!process.env.SERPER_API_KEY || !!getSerpApiKey() && (getSerpProvider() === "brightdata" || getSerpProvider() === "serpapi");
}
function parseSerpResults(json, make, model, year, cfg) {
  if (!json || typeof json !== "object") return [];
  const out = [];
  const consider = (title, snippet, structuredPrice) => {
    const text = `${String(title || "")} ${String(snippet || "")}`.trim();
    if (!text) return;
    if (!titleMentionsVehicle(text, make, model, year)) return;
    let price = typeof structuredPrice === "number" ? jsonPrice(structuredPrice, cfg) : null;
    if (price == null) {
      const allPrices = extractPricesFromText(text, cfg);
      if (allPrices.length === 1) {
        price = allPrices[0];
      } else if (allPrices.length > 1) {
        const sorted = [...allPrices].sort((a, b) => a - b);
        price = sorted[Math.floor(sorted.length / 2)];
      }
    }
    if (price != null) out.push({ price });
  };
  const organic = json.organic_results || json.organic || [];
  for (const r of Array.isArray(organic) ? organic : []) {
    consider(r?.title, r?.snippet ?? r?.description ?? r?.desc);
  }
  const shopping = json.shopping_results || json.shopping || [];
  for (const r of Array.isArray(shopping) ? shopping : []) {
    consider(r?.title, r?.snippet ?? r?.description, r?.extracted_price ?? r?.price);
  }
  const seen = /* @__PURE__ */ new Set();
  return out.filter((l) => seen.has(l.price) ? false : (seen.add(l.price), true));
}
async function fetchSerpListings(make, model, year, cfg) {
  if (!serpConfigured()) return [];
  const isHousing = cfg.id.startsWith("housing");
  const q = isHousing ? `${make} ${model === "property" ? "" : model} property for sale South Africa price` : `${year} ${make} ${model} for sale ${cfg.googleQuerySuffix} price`;
  try {
    let json = null;
    if (process.env.SERPER_API_KEY) {
      const { serperSearch: serperSearch2, toEngineFormat: toEngineFormat2 } = await Promise.resolve().then(() => (init_serper(), serper_exports));
      const glCode = cfg.googleGl?.replace("gl=", "") || "za";
      const result = await serperSearch2(q, { gl: glCode, num: 20 });
      json = toEngineFormat2(result);
    } else if (getSerpProvider() === "brightdata") {
      const googleUrl = `https://${cfg.googleDomain}/search?q=${encodeURIComponent(q)}&${cfg.googleGl}&num=20&brd_json=1`;
      const res = await fetch(getSerpApiUrl() || "https://api.brightdata.com/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${getSerpApiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ zone: getSerpZone(), url: googleUrl, format: "raw" }),
        signal: AbortSignal.timeout(SERP_TIMEOUT_MS)
      });
      if (!res.ok) return [];
      const body = await res.text();
      try {
        json = JSON.parse(body);
      } catch {
        return [];
      }
    } else {
      const base = getSerpApiUrl() || "https://serpapi.com/search.json";
      const url = `${base}?engine=google&google_domain=${cfg.googleDomain}&${cfg.googleGl}&num=20&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(getSerpApiKey())}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(SERP_TIMEOUT_MS) });
      if (!res.ok) return [];
      json = await res.json();
    }
    return parseSerpResults(json, make, model, year, cfg);
  } catch (err) {
    console.warn("[scraper] SERP layer failed:", err?.message || err);
    return [];
  }
}
function priceScanRe(cfg) {
  return new RegExp(`${escapeRegex(cfg.currency)}\\s?(\\d{1,3}(?:[ ,]\\d{3})+|\\d{5,7})`, "g");
}
function priceReg(cfg) {
  return new RegExp(`${escapeRegex(cfg.currency)}\\s?(\\d{1,3}(?:[ ,]\\d{3})+|\\d{4,7})`);
}
function priceFromText(text, cfg) {
  const m = String(text).match(priceReg(cfg));
  if (!m) return null;
  const val = parseInt(m[1].replace(/[^\d]/g, ""), 10);
  return val >= cfg.minPrice && val <= cfg.maxPrice ? val : null;
}
function jsonPrice(v, cfg) {
  let n;
  if (typeof v === "number") n = v;
  else {
    const s = String(v ?? "").trim();
    const clean = s.replace(/,/g, "").replace(/[^\d.]/g, "");
    n = parseFloat(clean);
  }
  return Number.isFinite(n) && n >= cfg.minPrice && n <= cfg.maxPrice ? Math.round(n) : null;
}
function extractPricesFromText(text, cfg) {
  const prices = [];
  const re = priceScanRe(cfg);
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = parseInt(m[1].replace(/[^\d]/g, ""), 10);
    if (val >= cfg.minPrice && val <= cfg.maxPrice) prices.push(val);
  }
  return prices;
}
function extractJsonLd(html, cfg) {
  const $ = cheerio.load(html);
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text() || $(el).text();
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const node of jsonLdNodes(parsed)) {
      const types = [].concat(node["@type"] || []);
      const offer = node.offers && (Array.isArray(node.offers) ? node.offers[0] : node.offers);
      if (!types.some((t) => VEHICLE_TYPE_RE.test(String(t))) && !offer) continue;
      const price = num(offer?.price ?? offer?.lowPrice ?? node.price);
      if (price == null || price < cfg.minPrice || price > cfg.maxPrice) continue;
      const odo = node.mileageFromOdometer;
      let km = num(odo && typeof odo === "object" ? odo.value : odo);
      const unit = odo && typeof odo === "object" ? String(odo.unitCode || "") : "";
      const miles = /^smi$/i.test(unit) || !unit && cfg.distanceUnit === "mi";
      if (km != null && miles) km = km * 1.60934;
      out.push({
        price: Math.round(price),
        km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0
      });
    }
  });
  return out;
}
function jsonLdNodes(root) {
  const out = [];
  const visit = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    out.push(n);
    if (Array.isArray(n["@graph"])) n["@graph"].forEach(visit);
  };
  visit(root);
  return out;
}
var VEHICLE_TYPE_RE = /car|vehicle|motorcycle|product/i;
function yearTolerant(cfg, title, make, model, year, match, opts) {
  const fn = cfg.titleMatch || titleMentionsVehicle;
  return fn(title, make, model, year, match, opts);
}
function extractCardListings(html, make, model, year, cfg, opts) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const selectCards = () => {
    const anchors = $('a[class*="result-tile"], a[class*="vehicle-card"], a[class*="listing-card"], a[class*="VehicleCard"]');
    if (anchors.length) return anchors;
    return $('[class*="VehicleCard_vehicleCard"], [class*="vehicleCard"], [class*="listing-card"]');
  };
  const cards = selectCards();
  cards.each((_, el) => {
    const $c = $(el);
    const cardText = $c.text().replace(/\s+/g, " ").trim();
    if (cardText.length < 8) return;
    if (!yearTolerant(cfg, cardText, make, model, year, void 0, { yearTolerance: opts?.yearTolerance ?? 1, variant: opts?.variant })) return;
    const priceEl = $c.find('[class^="e-price__"], [class*="price"]').first();
    const price = priceEl.length ? num(priceEl.text()) : priceFromText(cardText, cfg);
    if (price == null || price < cfg.minPrice || price > cfg.maxPrice) return;
    const odoMatch = cardText.match(/(\d{1,3}(?:[ ,]\d{3})*)\s?(km|mi(?:les)?\b)/i);
    let km = odoMatch ? num(odoMatch[1]) ?? void 0 : void 0;
    if (km != null && odoMatch && /^mi/i.test(odoMatch[2])) km = Math.round(km * 1.60934);
    const key = `${Math.round(price)}|${km ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0 });
  });
  return out;
}
function extractNextDataListings(html, make, model, year, cfg, opts) {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").contents().text() || $("#__NEXT_DATA__").text();
  if (!raw) return [];
  let root;
  try {
    root = JSON.parse(raw);
  } catch {
    return [];
  }
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const visit = (n) => {
    if (n == null) return;
    if (typeof n === "string") {
      const s = n.trim();
      if ((s[0] === "{" || s[0] === "[") && s.includes('"price"')) {
        try {
          visit(JSON.parse(s));
        } catch {
        }
      }
      return;
    }
    if (typeof n !== "object") return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    const price = typeof n.price === "number" ? n.price : null;
    if (price != null && price >= cfg.minPrice && price <= cfg.maxPrice && (n.make || n.model || n.title)) {
      const yr = n.year ?? n.modelYear ?? n.vehicleYear;
      const variantText = [n.variant, n.variantName, n.derivative, n.trim, n.subTitle, n.subtitle, n.badge, n.engine, n.summary].filter(Boolean).join(" ");
      const title = `${n.title || `${yr ?? ""} ${n.make ?? ""} ${n.model ?? ""}`} ${variantText}`.trim();
      if (yearTolerant(cfg, title, make, model, year, void 0, { yearTolerance: opts?.yearTolerance ?? 1, variant: opts?.variant })) {
        const key = `${n.reference ?? n.id ?? ""}|${price}`;
        if (!seen.has(key)) {
          seen.add(key);
          let km = num(n.mileage ?? n.km ?? n.odometer);
          if (km != null && cfg.distanceUnit === "mi") km = km * 1.60934;
          out.push({ price: Math.round(price), km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0 });
        }
      }
    }
    for (const k of Object.keys(n)) visit(n[k]);
  };
  visit(root);
  return out;
}
function adjustForMileage(listings, targetKm) {
  const raw = listings.map((l) => l.price);
  if (!targetKm || !Number.isFinite(targetKm) || targetKm <= 0) return raw;
  const withKm = listings.filter((l) => typeof l.km === "number");
  if (withKm.length < 3) return raw;
  const mx = withKm.reduce((s, l) => s + l.km, 0) / withKm.length;
  const my = withKm.reduce((s, l) => s + l.price, 0) / withKm.length;
  let numr = 0, den = 0;
  for (const l of withKm) {
    numr += (l.km - mx) * (l.price - my);
    den += (l.km - mx) ** 2;
  }
  let slope = den ? numr / den : 0;
  const medPrice = median(withKm.map((l) => l.price)) ?? my;
  const defaultSlope = -(medPrice * 0.03) / 2e4;
  const rel = medPrice > 0 ? slope / medPrice : 0;
  if (!(rel < -1e-6 && rel > -15e-6)) slope = defaultSlope;
  return listings.map((l) => {
    if (typeof l.km !== "number") return l.price;
    const adj = l.price + slope * (targetKm - l.km);
    return Math.round(Math.min(l.price * 1.2, Math.max(l.price * 0.8, adj)));
  });
}
function iqrFilter(prices) {
  if (prices.length < 4) return prices;
  const s = [...prices].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const filtered = s.filter((v) => v >= lo && v <= hi);
  return filtered.length >= 2 ? filtered : s;
}
function robustAverage(prices) {
  if (!prices.length) return null;
  const s = iqrFilter(prices);
  if (s.length <= 12) {
    const mid = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
  }
  const trim = Math.max(1, Math.floor(s.length * 0.1));
  const core = s.slice(trim, s.length - trim);
  return Math.round(core.reduce((a, b) => a + b, 0) / core.length);
}
function expandDealerUrl(source, make, model, year, page = 1) {
  const m = encodeURIComponent(make);
  const mo = encodeURIComponent(model);
  const y = String(year);
  const base = source.url.replace(/\{make\}/g, m).replace(/\{model\}/g, mo).replace(/\{year\}/g, y);
  if (page <= 1) return base;
  const param = source.pageParam || "page";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${page}`;
}
function loadDealerSources(cfg) {
  try {
    const p = cfg?.priceSourcesPath || process.env.PRICE_SOURCES_PATH || import_path.default.join(process.cwd(), "data", "price-sources.json");
    if (!import_fs.default.existsSync(p)) return [];
    const raw = import_fs.default.readFileSync(p, "utf-8").replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.dealers) ? parsed.dealers : [];
    return list.filter((d) => d && d.enabled !== false).filter((d) => d && typeof d.url === "string" && /^https?:\/\//i.test(d.url)).map((d) => ({
      name: String(d.name || d.url),
      url: d.url,
      match: typeof d.match === "string" ? d.match : void 0,
      cardSelector: typeof d.cardSelector === "string" ? d.cardSelector : void 0,
      enabled: d.enabled !== false,
      pages: typeof d.pages === "number" && d.pages >= 1 ? Math.round(d.pages) : void 0,
      pageParam: typeof d.pageParam === "string" ? d.pageParam : void 0,
      json: d.json && typeof d.json === "object" && typeof d.json.url === "string" ? d.json : void 0
    }));
  } catch (err) {
    console.warn("[scraper] could not read dealer price sources:", err?.message || err);
    return [];
  }
}
function extractDealerPrices(html, source, make, model, year, cfg) {
  const $ = cheerio.load(html);
  const prices = [];
  const cardSelector = source.cardSelector || 'article, .vehicle, .stock-item, .listing, [class*="card"], [class*="vehicle"]';
  $(cardSelector).each((_, el) => {
    const $el = $(el);
    const title = $el.find('h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text() || $el.text();
    if (!titleMentionsVehicle(title, make, model, year, source.match)) return;
    const val = priceFromText($el.text(), cfg);
    if (val !== null) prices.push(val);
  });
  return prices;
}
function jsonListingArray(body, cfg) {
  if (Array.isArray(body)) return body;
  let node = body;
  for (const key of (cfg.resultsPath || "results").split(".").filter(Boolean)) {
    if (node == null) return [];
    node = node[key];
  }
  return Array.isArray(node) ? node : [];
}
async function fetchJsonDealerPrices(source, make, model, year, cfg) {
  const jcfg = source.json;
  const url = new URL(jcfg.url);
  for (const [k, rawV] of Object.entries(jcfg.params || {})) {
    const v = rawV.replace(/\{make\}/g, urlMake(make)).replace(/\{model\}/g, String(model)).replace(/\{year\}/g, String(year));
    url.searchParams.set(k, v);
  }
  const headers = {
    ...DEFAULT_HEADERS,
    "Accept-Language": cfg.acceptLanguage,
    Accept: "application/json"
  };
  if (jcfg.auth) {
    const aRes = await fetchWithRetry(jcfg.auth.url, { timeout: REQUEST_TIMEOUT, headers });
    const aBody = typeof aRes === "string" ? JSON.parse(aRes) : aRes;
    let tok = aBody;
    for (const k of (jcfg.auth.tokenPath || "Data.AuthToken").split(".").filter(Boolean)) {
      tok = tok?.[k];
    }
    if (typeof tok === "string" && tok) headers[jcfg.auth.tokenHeader || "Authorization-Token"] = tok;
    for (const [k, v] of Object.entries(jcfg.auth.headers || {})) headers[k] = v;
  }
  const res = await fetchWithRetry(url.toString(), { timeout: REQUEST_TIMEOUT, headers });
  const body = typeof res === "string" ? JSON.parse(res) : res;
  const items = jsonListingArray(body, jcfg);
  const listings = [];
  for (const item of items) {
    const itemMake = String(item[jcfg.makeField || "make"] ?? "").toLowerCase();
    const itemModel = String(item[jcfg.modelField || "model"] ?? "").toLowerCase();
    const itemTitle = String(item[jcfg.titleField || "title"] ?? "").toLowerCase();
    const itemYear = Number(item[jcfg.yearField || "year"] ?? NaN);
    const makeOk = makeVariants(make).some((kw) => itemMake.includes(kw));
    const q = modelCore(String(model));
    const modelOk = !q || modelCore(itemModel).includes(q) || modelCore(itemTitle).includes(q);
    const qYear = parseInt(year, 10);
    const yearOk = !Number.isFinite(itemYear) || !Number.isFinite(qYear) || Math.abs(itemYear - qYear) <= YEAR_TOLERANCE;
    if (!makeOk || !modelOk || !yearOk) continue;
    const val = jsonPrice(item[jcfg.priceField || "price"], cfg);
    if (val === null) continue;
    const kmRaw = jcfg.kmField ? item[jcfg.kmField] : item.mileage ?? item.km ?? item.odometer;
    const km = num(kmRaw);
    listings.push({ price: val, km: km != null && km > 0 && km < 1e6 ? Math.round(km) : void 0 });
  }
  const seen = /* @__PURE__ */ new Set();
  return listings.filter((l) => {
    const k = `${l.price}|${l.km ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
async function fetchPageForParsing(url, cfg) {
  const rendered = await renderViaWorker(url);
  if (rendered) return rendered;
  const unlocked = await renderViaUnlocker(url, cfg.country);
  if (unlocked) return unlocked;
  try {
    return await fetchWithRetry(url, {
      timeout: REQUEST_TIMEOUT,
      headers: { ...DEFAULT_HEADERS, "Accept-Language": cfg.acceptLanguage }
    });
  } catch (err) {
    console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
    return null;
  }
}
function buildSourcesFor(cfg) {
  return cfg.classifieds.map((s) => ({
    ...s,
    fetchConfig: { ...s.fetchConfig, headers: { ...DEFAULT_HEADERS, "Accept-Language": cfg.acceptLanguage } }
  }));
}

// markets/sa.ts
var AUTO_SELECTORS = '[class^="e-price__"]';
var CARSSELECTORS = ".vehicle-price";
var sa = {
  id: "za",
  currency: "R",
  country: "za",
  distanceUnit: "km",
  googleDomain: "google.co.za",
  googleGl: "gl=za&hl=en",
  googleQuerySuffix: "South Africa",
  minPrice: 1e4,
  maxPrice: 5e7,
  acceptLanguage: "en-ZA,en;q=0.9",
  classifieds: [
    {
      name: "AutoTrader",
      url: (make, model, year) => `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&minYear=${year}&maxYear=${year}`,
      fetchConfig: {},
      selectors: (process.env.SCRAPER_AUTOTRADER_SELECTORS || AUTO_SELECTORS).split(",")
    },
    {
      name: "Cars.co.za",
      url: (make, model, year) => `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
      fetchConfig: {},
      selectors: (process.env.SCRAPER_CARSCOZA_SELECTORS || CARSSELECTORS).split(",")
    }
  ],
  searchUrl: (make, model, year) => `https://www.autotrader.co.za/cars-for-sale?make=${encodeURIComponent(urlMake(make))}&model=${encodeURIComponent(model)}&minYear=${year}&maxYear=${year}`,
  secondaryUrl: (make, model, year) => `https://www.cars.co.za/usedcars/${encodeURIComponent(urlMake(make))}/${encodeURIComponent(model)}/?Year=${year}`,
  secondarySourceName: "Cars.co.za"
};

// markets/uk.ts
var import_path2 = __toESM(require("path"));
var slug = (s) => encodeURIComponent(String(s).toLowerCase().trim().replace(/\s+/g, "-"));
var uk = {
  id: "uk",
  currency: "\xA3",
  country: "gb",
  googleDomain: "google.co.uk",
  googleGl: "gl=gb&hl=en",
  googleQuerySuffix: "United Kingdom",
  minPrice: 1e3,
  maxPrice: 3e6,
  acceptLanguage: "en-GB,en;q=0.9",
  distanceUnit: "mi",
  /* Market-scoped dealer layer: the default price-sources.json holds SA
   * dealers whose rand prices would poison a £ pool. UK gets its own file
   * (absent until we onboard UK dealer groups = empty layer, classifieds
   * only). */
  priceSourcesPath: import_path2.default.join(process.cwd(), "data", "price-sources-uk.json"),
  classifieds: [
    {
      name: "cinch",
      url: (make, model) => `https://www.cinch.co.uk/used-cars/${slug(urlMake(make))}/${slug(model)}/`,
      fetchConfig: {},
      /* Fallback only — cinch parses via __NEXT_DATA__. */
      selectors: '[data-testid*="price"], [class*="price"]'.split(",")
    }
  ],
  searchUrl: (make, model) => `https://www.cinch.co.uk/used-cars/${slug(urlMake(make))}/${slug(model)}/`
};

// markets/housing.ts
function propertyTitleMatch(title, _make, model, _year) {
  const t = String(title || "").toLowerCase();
  const modelTerm = String(model || "").toLowerCase().trim();
  if (modelTerm && modelTerm !== "all") {
    const typeOk = /(apartment|flat|house|villa|townhouse|unit|sectional|cluster)/.test(t);
    const typeMatch = modelTerm === "apartment" || modelTerm === "flat" ? /(apartment|flat)/.test(t) : modelTerm === "house" || modelTerm === "villa" ? /(house|villa|home|townhouse|cluster)/.test(t) : true;
    if (!typeOk || !typeMatch) return false;
  } else if (!/(apartment|flat|house|villa|townhouse|unit|sectional|plot|land|property)/.test(t)) {
    return false;
  }
  return /\b\d{1,4}\b/.test(t);
}
var housingZa = {
  id: "housing-za",
  currency: "R",
  country: "za",
  googleDomain: "google.co.za",
  googleGl: "gl=za&hl=en",
  googleQuerySuffix: "property for sale",
  minPrice: 3e5,
  maxPrice: 2e8,
  acceptLanguage: "en-ZA,en;q=0.9",
  titleMatch: propertyTitleMatch,
  classifieds: [
    {
      name: "Private Property",
      url: (_make, _model, _year) => `https://www.privateproperty.co.za/for-sale`,
      fetchConfig: {},
      selectors: '.property-price, .price, [class*="price"], [class*="Price"]'.split(",")
    },
    {
      name: "Property24",
      url: (_make, _model, _year) => `https://www.property24.com/for-sale`,
      fetchConfig: {},
      selectors: '.p24_price, .p24_listingTilePrice, [class*="price"], [class*="Price"]'.split(",")
    }
  ],
  searchUrl: (_make, _model, _year) => `https://www.property24.com/for-sale`
};

// index.ts
var markets = { za: sa, uk, housingZa };
var ALLOWED_MARKETS = (process.env.MARKETS || "").split(",").map((s) => s.trim()).filter(Boolean);
var filteredMarkets = ALLOWED_MARKETS.length ? Object.fromEntries(Object.entries(markets).filter(([id]) => ALLOWED_MARKETS.includes(id))) : markets;
var DEFAULT_MARKET = sa;
var CACHE_TTL_MS2 = Number(process.env.SCRAPER_CACHE_TTL_MS) || 15 * 60 * 1e3;
var TOTAL_BUDGET_MS2 = Number(process.env.SCRAPER_TOTAL_BUDGET_MS) || 2e4;
var MIN_DEALER_LISTINGS = Number(process.env.SCRAPER_MIN_DEALER_LISTINGS) || 3;
var DEALER_FINAL_THRESHOLD2 = Number(process.env.SCRAPER_DEALER_FINAL_THRESHOLD) || 20;
var CLASSIFIEDS_PAGES2 = Math.max(1, Number(process.env.SCRAPER_CLASSIFIEDS_PAGES) || 3);
var SERP_TRIGGER_MAX2 = Number(process.env.SERP_TRIGGER_MAX) || 6;
var cache = /* @__PURE__ */ new Map();
function cacheKey(marketId, make, model, year, vin, dealerSlug, mileage) {
  return `${marketId}|${(dealerSlug || "default").toLowerCase()}|${make.toLowerCase()}|${model.toLowerCase()}|${year}|${(vin || "novin").toUpperCase()}|${mileage != null && Number.isFinite(mileage) ? Math.round(mileage) : "nomileage"}`;
}
function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS2) {
    cache.delete(key);
    return null;
  }
  return e.data;
}
var MAX_CACHE_SIZE = Number(process.env.SCRAPER_MAX_CACHE_SIZE) || 500;
function cachePut(key, data) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}
async function mapPool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}
function pageUrl(src, make, model, year, page) {
  const base = src.url(make, model, year);
  if (page <= 1) return base;
  const param = src.pageParam || "page";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${param}=${page}`;
}
function classifiedParser(cfg, make, model, year, variant) {
  return (html, selectors) => {
    const opts = variant ? { variant } : void 0;
    const nd = extractNextDataListings(html, make, model, year, cfg, opts);
    if (nd.length) return nd;
    const cards = extractCardListings(html, make, model, year, cfg, opts);
    if (cards.length) return cards;
    const jl = extractJsonLd(html, cfg).filter((l) => {
      return true;
    });
    if (jl.length) return jl;
    return [];
  };
}
async function fetchValuation(make, model, year, opts = {}, market = DEFAULT_MARKET) {
  const cfg = market;
  const baseModel = modelCore(model);
  const variant = opts.variant || "";
  const targetKm = Number(opts.mileage);
  const cacheModel = variant ? `${model} ${variant}` : model;
  const key = cacheKey(cfg.id, make, cacheModel, year, opts.vin, opts.dealerSlug, targetKm);
  const cached = cacheGet(key);
  if (cached) return cached;
  const y = String(year);
  const deadline = Date.now() + TOTAL_BUDGET_MS2;
  const budgetLeft = () => deadline - Date.now();
  const dealers = loadDealerSources(cfg);
  const jsonDealers = dealers.filter((d) => !!d.json);
  const htmlDealers = dealers.filter((d) => !d.json);
  const collect = async (d) => {
    try {
      const listings = d.json ? await fetchJsonDealerPrices(d, make, baseModel, y, cfg) : await (async () => {
        const pages = Math.max(1, d.pages ?? 2);
        const found = [];
        for (let p = 1; p <= pages; p++) {
          if (budgetLeft() <= 0) break;
          const url = expandDealerUrl(d, make, baseModel, y, p);
          let html = null;
          let prices2 = [];
          try {
            html = await fetchPageForParsing(url, cfg);
          } catch (err) {
            console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
          }
          if (html) prices2 = extractDealerPrices(html, d, make, baseModel, y, cfg);
          if (prices2.length === 0) break;
          found.push(...prices2);
        }
        return [...new Set(found)].map((price) => ({ price }));
      })();
      const prices = listings.map((l) => l.price);
      return {
        name: `Dealer \xB7 ${d.name}`,
        count: prices.length,
        avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null,
        listings
      };
    } catch (err) {
      console.warn(`[scraper] dealer ${d.name} failed:`, err?.message || err);
      return { name: `Dealer \xB7 ${d.name}`, count: 0, avg: null, listings: [] };
    }
  };
  const jsonResults = await Promise.all(jsonDealers.map(collect));
  const jsonListings = jsonResults.flatMap((r) => r.listings);
  let htmlResults = [];
  if (jsonListings.length < MIN_DEALER_LISTINGS && htmlDealers.length) {
    htmlResults = await mapPool(htmlDealers, 2, collect);
  }
  const dealerResults = [...jsonResults, ...htmlResults];
  const dealerListings = dealerResults.flatMap((r) => r.listings);
  const dealerSources = dealerResults.map(({ name, count, avg }) => ({ name, count, avg }));
  const kmOf = (ls) => median(ls.map((l) => l.km).filter((k) => typeof k === "number"));
  if (dealerListings.length >= DEALER_FINAL_THRESHOLD2) {
    const adjusted = adjustForMileage(dealerListings, targetKm);
    const data2 = {
      averageRetailPrice: robustAverage(adjusted),
      listingsFound: adjusted.length,
      fallbackRequired: false,
      sources: dealerSources,
      currency: cfg.currency,
      distanceUnit: cfg.distanceUnit,
      mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && dealerListings.some((l) => typeof l.km === "number"),
      sampleMedianKm: kmOf(dealerListings)
    };
    cachePut(key, data2);
    return data2;
  }
  const sources = buildSourcesFor(cfg);
  const parse = classifiedParser(cfg, make, baseModel, y, variant);
  const perSource = await Promise.all(
    sources.map(async (src) => {
      const acc = [];
      for (let p = 1; p <= CLASSIFIEDS_PAGES2; p++) {
        if (budgetLeft() <= 0) break;
        const url = pageUrl(src, make, baseModel, y, p);
        let listings = [];
        try {
          const html = await fetchPageForParsing(url, cfg);
          if (html) listings = parse(html, src.selectors);
        } catch (err) {
          console.warn(`[scraper] http fetch failed for ${url}:`, err?.message || err);
        }
        if (listings.length === 0) break;
        acc.push(...listings);
      }
      const seen = /* @__PURE__ */ new Set();
      const deduped = acc.filter((l) => {
        const k = `${l.price}|${l.km ?? ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { name: src.name, listings: deduped };
    })
  );
  const classifiedListings = [];
  const sourcesOutput = [];
  for (const { name, listings } of perSource) {
    classifiedListings.push(...listings);
    const prices = listings.map((l) => l.price);
    sourcesOutput.push({ name, count: prices.length, avg: prices.length ? Math.round(prices.reduce((s, v) => s + v, 0) / prices.length) : null });
  }
  let serpListings = [];
  const serpModel = variant ? `${baseModel} ${variant}` : baseModel;
  if (dealerListings.length + classifiedListings.length < SERP_TRIGGER_MAX2 && serpConfigured()) {
    serpListings = await fetchSerpListings(make, serpModel, y, cfg);
    if (serpListings.length) {
      sourcesOutput.push({ name: "Google (SERP)", count: serpListings.length, avg: Math.round(serpListings.reduce((s, l) => s + l.price, 0) / serpListings.length) });
    }
  }
  const combined = [...dealerListings, ...classifiedListings, ...serpListings];
  const crossSeen = /* @__PURE__ */ new Set();
  const allListings = combined.filter((l) => {
    const k = `${l.price}|${l.km ?? ""}`;
    if (crossSeen.has(k)) return false;
    crossSeen.add(k);
    return true;
  });
  const finalSources = [...dealerSources, ...sourcesOutput];
  const searchUrl = cfg.searchUrl(make, baseModel, y);
  const carsUrl = cfg.secondarySourceName && sources.some((s) => s.name === cfg.secondarySourceName) ? cfg.secondaryUrl?.(make, baseModel, y) : void 0;
  function calcConfidenceScore(prices) {
    const n = prices.length;
    if (n === 0) return 0;
    if (n === 1) return 30;
    const avg = prices.reduce((a, b) => a + b, 0) / n;
    const variance = prices.reduce((a, b) => a + (b - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0.5;
    const base = n >= 15 ? 85 : n >= 5 ? 70 : 45;
    const penalty = Math.min(20, Math.round(cv * 80));
    return Math.max(15, Math.min(99, base - penalty + (n >= 20 ? 5 : 0)));
  }
  function calcPriceRange(prices) {
    if (!prices.length) return { low: null, high: null };
    const sorted = [...prices].sort((a, b) => a - b);
    return { low: sorted[0], high: sorted[sorted.length - 1] };
  }
  if (allListings.length === 0) {
    const data2 = {
      averageRetailPrice: null,
      tradeEstimate: null,
      priceRange: { low: null, high: null },
      confidenceScore: 0,
      listingsFound: 0,
      fallbackRequired: true,
      currency: cfg.currency,
      distanceUnit: cfg.distanceUnit,
      searchUrl,
      carsUrl,
      sources: finalSources,
      mileageAdjusted: false,
      sampleMedianKm: null
    };
    cachePut(key, data2);
    return data2;
  }
  const adjustedAll = adjustForMileage(allListings, targetKm);
  const avgRetail = robustAverage(adjustedAll);
  const range = calcPriceRange(adjustedAll);
  const confidence = calcConfidenceScore(adjustedAll);
  const tradeEst = avgRetail != null ? Math.round(avgRetail * 0.85) : null;
  const data = {
    averageRetailPrice: avgRetail,
    tradeEstimate: tradeEst,
    priceRange: range,
    confidenceScore: confidence,
    listingsFound: adjustedAll.length,
    fallbackRequired: dealerListings.length < MIN_DEALER_LISTINGS,
    searchUrl,
    carsUrl,
    sources: finalSources,
    currency: cfg.currency,
    distanceUnit: cfg.distanceUnit,
    mileageAdjusted: Number.isFinite(targetKm) && targetKm > 0 && allListings.some((l) => typeof l.km === "number"),
    sampleMedianKm: kmOf(allListings)
  };
  cachePut(key, data);
  return data;
}

// ../tru-arbitrage/src/engine/catalogue.ts
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

// ../tru-arbitrage/src/engine/tu-matcher.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var catalogue = null;
function resolveCataloguePath() {
  const candidates = [
    path3.join(__dirname, "..", "data", "tu-variants.json"),
    path3.join(__dirname, "..", "..", "data", "tu-variants.json"),
    path3.join(process.cwd(), "data", "tu-variants.json")
  ];
  for (const c of candidates) {
    if (fs2.existsSync(c)) return c;
  }
  return null;
}
function loadCatalogue() {
  if (catalogue) return catalogue;
  const dataPath = resolveCataloguePath();
  if (!dataPath) {
    console.warn("[tu-matcher] tu-variants.json not found in any known location \u2014 TU matching disabled");
    catalogue = {};
    return catalogue;
  }
  try {
    catalogue = JSON.parse(fs2.readFileSync(dataPath, "utf-8"));
    const totalVariants = Object.values(catalogue).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[tu-matcher] Loaded ${totalVariants} variants across ${Object.keys(catalogue).length} makes (${dataPath})`);
  } catch (err) {
    console.error("[tu-matcher] Failed to load tu-variants.json:", err?.message);
    catalogue = {};
  }
  return catalogue;
}

// ../tru-arbitrage/src/engine/catalogue.ts
var SPECIALTY_MODEL_CATEGORY = {
  BICYCLE: "specialty",
  "BOAT/JETSKI": "marine",
  CARAVAN: "caravans",
  GENERATOR: "specialty",
  "GOLF CART": "specialty",
  TRAILER: "caravans",
  "YELLOW METAL": "agri"
};
var MOTO_BODIES = /* @__PURE__ */ new Set(["R/D", "O/F", "S/S", "3/W", "4/W", "6/W", "ATV"]);
var MOTO_AXLES = /* @__PURE__ */ new Set(["1X1", "2X1"]);
var AGRI_MAKES = /* @__PURE__ */ new Set([
  "JOHN DEERE",
  "KUBOTA",
  "CATERPILLAR",
  "MASSEY FERGUSON",
  "NEW HOLLAND",
  "AGCO ALLIS (AGROTEC)",
  "BELARUS",
  "CLAAS",
  "LANDINI",
  "VALTRA (VALMET)",
  "CASE INTERNATIONAL",
  "ANGLO INTERNATIONAL"
]);
var TRUCK_MAKES = /* @__PURE__ */ new Set([
  "SCANIA",
  "IVECO",
  "HINO",
  "UD TRUCKS",
  "TATA",
  "ASHOK LEYLAND",
  "SHACMAN",
  "LEYLAND",
  "MACK",
  "INTERNATIONAL",
  "FREIGHTLINER",
  "PETERBILT",
  "WESTERN STAR",
  "FUSO",
  "FOTON",
  "GOLDEN DRAGON"
]);
var TRUCK_BODIES = /* @__PURE__ */ new Set(["C/C", "T/T", "C/M", "TIP", "B/S", "D/S", "P/V", "REF", "F/C", "M/X"]);
var TRUCK_AXLES = /* @__PURE__ */ new Set(["3X2", "6X2", "6X4", "6X6", "8X4", "8X8"]);
var MARINE_BODIES = /* @__PURE__ */ new Set(["B/J"]);
var CARAVAN_BODIES = /* @__PURE__ */ new Set(["C/V", "T/F", "R/V"]);
var SPECIALTY_BODIES = /* @__PURE__ */ new Set(["G/E", "G/C", "B/C"]);
var AGRI_BODIES = /* @__PURE__ */ new Set(["Y/M"]);
function classify(v) {
  const make = String(v.mk || "").toUpperCase().trim();
  const body = String(v.b || "").toUpperCase().trim();
  const axle = String(v.ax || "").toUpperCase().trim();
  if (make === "SPECIALTY") {
    return SPECIALTY_MODEL_CATEGORY[String(v.md || "").toUpperCase()] || "specialty";
  }
  if (make === "MULTIPLE MOTORCYCLE MANUFACTURERS") return "moto";
  if (MOTO_BODIES.has(body) || MOTO_AXLES.has(axle)) return "moto";
  if (AGRI_MAKES.has(make)) return "agri";
  if (TRUCK_MAKES.has(make) || TRUCK_BODIES.has(body) || TRUCK_AXLES.has(axle)) return "trucks";
  if (MARINE_BODIES.has(body)) return "marine";
  if (CARAVAN_BODIES.has(body)) return "caravans";
  if (SPECIALTY_BODIES.has(body)) return "specialty";
  if (AGRI_BODIES.has(body)) return "agri";
  return "cars";
}
var index = null;
function resolveYearsPath() {
  const candidates = [
    path4.join(__dirname, "..", "data", "tu-years.json"),
    path4.join(__dirname, "..", "..", "data", "tu-years.json"),
    path4.join(process.cwd(), "data", "tu-years.json")
  ];
  for (const c of candidates) {
    if (fs3.existsSync(c)) return c;
  }
  return null;
}
function loadYearsOverlay() {
  const out = /* @__PURE__ */ new Map();
  const p = resolveYearsPath();
  if (!p) return out;
  try {
    const raw = JSON.parse(fs3.readFileSync(p, "utf-8"));
    for (const [mmCode, years] of Object.entries(raw)) {
      if (Array.isArray(years) && years.length) out.set(mmCode, years.map(Number).filter(Boolean));
    }
  } catch (err) {
    console.warn("[catalogue] Failed to load tu-years.json overlay:", err?.message);
  }
  return out;
}
function buildIndex() {
  if (index) return;
  const cat = loadCatalogue();
  const yearsOverlay = loadYearsOverlay();
  const map = /* @__PURE__ */ new Map();
  for (const [make, variants] of Object.entries(cat)) {
    const mkEntry = { models: /* @__PURE__ */ new Map() };
    map.set(make, mkEntry);
    for (const v of variants) {
      const category = classify(v);
      const modelKey = String(v.md || "").trim() || String(v.v || "").trim();
      if (!modelKey) continue;
      let list = mkEntry.models.get(modelKey);
      if (!list) {
        list = [];
        mkEntry.models.set(modelKey, list);
      }
      list.push({
        mmCode: v.c,
        make,
        model: modelKey,
        variant: v.v,
        cc: v.cc,
        kw: v.kw,
        fuel: v.f,
        body: v.b,
        axle: v.ax,
        newListPrice: v.nl,
        latestYear: v.y,
        years: yearsOverlay.get(v.c) || derivedYears(v.y),
        category
      });
    }
  }
  index = map;
  if (yearsOverlay.size) {
    const total = [...map.values()].reduce((acc, m) => acc + [...m.models.values()].reduce((a, xs) => a + xs.length, 0), 0);
    console.log(`[catalogue] Indexed ${total} variants across ${map.size} makes (${yearsOverlay.size} mmCodes have real year ranges)`);
  } else {
    console.warn("[catalogue] tu-years.json overlay not found \u2014 variant years are derived windows. Run `npm run catalogue:refresh` for real intro/discon ranges.");
  }
}
function derivedYears(latestYear) {
  const y = Number(latestYear) || (/* @__PURE__ */ new Date()).getFullYear();
  return y >= 1996 ? [y - 1, y] : [y];
}
function ensureIndex() {
  buildIndex();
  return index;
}
function listMakes(category) {
  const idx = ensureIndex();
  const out = [];
  for (const [make, mkEntry] of idx) {
    if (!category) {
      out.push(make);
      continue;
    }
    for (const variants of mkEntry.models.values()) {
      if (variants.some((v) => v.category === category)) {
        out.push(make);
        break;
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
function listModels(category, make) {
  const idx = ensureIndex();
  const mkEntry = idx.get(String(make || "").toUpperCase());
  if (!mkEntry) return [];
  const out = [];
  for (const [model, variants] of mkEntry.models) {
    if (!category || variants.some((v) => v.category === category)) out.push(model);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
function listVariants(category, make, model) {
  const idx = ensureIndex();
  const mkEntry = idx.get(String(make || "").toUpperCase());
  if (!mkEntry) return [];
  const variants = mkEntry.models.get(String(model || ""));
  if (!variants) return [];
  const filtered = category ? variants.filter((v) => v.category === category) : variants;
  return filtered.map((v) => ({ ...v, years: [...v.years].sort((a, b) => b - a) })).sort((a, b) => a.variant.localeCompare(b.variant));
}

// webapp/server.ts
for (const envPath of [
  path5.join(__dirname, "..", ".env"),
  path5.join(__dirname, ".env"),
  path5.join(process.cwd(), ".env")
]) {
  if (fs4.existsSync(envPath)) {
    try {
      const lines = fs4.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [k, ...v] = trimmed.split("=");
        const key = k.trim();
        const val = v.join("=").trim().replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {
    }
  }
}
var PORT = Number(process.env.PORT || 4300);
var API_KEY = process.env.API_KEY || "";
var LABELS = {
  za: "South Africa \u2014 cars",
  us: "United States \u2014 cars",
  uk: "United Kingdom \u2014 cars",
  housingZa: "South Africa \u2014 property"
};
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "64kb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
if (API_KEY) {
  const checkAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${API_KEY}`) return res.status(401).json({ error: "Unauthorized" });
    next();
  };
  app.use("/api/valuation", checkAuth);
  app.use("/api/fsbo", checkAuth);
  app.use("/api/agency/crawl", checkAuth);
}
var hits = /* @__PURE__ */ new Map();
var THROTTLE_WINDOW = 6e4;
var THROTTLE_MAX = 12;
setInterval(() => {
  const cutoff = Date.now() - THROTTLE_WINDOW;
  for (const [ip, e] of hits) {
    if (e.ts < cutoff) hits.delete(ip);
  }
}, 5 * 6e4).unref();
function throttled(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.ts > THROTTLE_WINDOW) {
    hits.set(ip, { n: 1, ts: now });
    return false;
  }
  e.n++;
  return e.n > THROTTLE_MAX;
}
app.get("/api/markets", (_req, res) => {
  res.json(Object.keys(filteredMarkets).map((id) => ({ id, label: LABELS[id] || id })));
});
app.get("/api/catalogue/makes", (req, res) => {
  try {
    res.json({ makes: listMakes("cars") });
  } catch {
    res.json({ makes: ["Toyota", "Volkswagen", "Ford", "BMW", "Mercedes-Benz", "Hyundai", "Nissan", "Audi", "Kia", "Isuzu", "Mazda", "Renault", "Suzuki", "Havill", "Chery"] });
  }
});
app.get("/api/catalogue/models", (req, res) => {
  try {
    const make = String(req.query.make || "").trim();
    if (!make) return res.status(400).json({ error: "make is required" });
    res.json({ models: listModels("cars", make) });
  } catch {
    res.json({ models: [] });
  }
});
app.get("/api/catalogue/variants", (req, res) => {
  try {
    const make = String(req.query.make || "").trim();
    const model = String(req.query.model || "").trim();
    if (!make || !model) return res.status(400).json({ error: "make and model are required" });
    res.json({ variants: listVariants("cars", make, model) });
  } catch {
    res.json({ variants: [] });
  }
});
app.post(["/api/valuation", "/valuation", "/scraper/valuation", "/api/scraper/valuation"], async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests \u2014 slow down." });
  try {
    const { make, model, variant, year, mileage, market, location } = req.body || {};
    if (!make || !model || !year) {
      return res.status(400).json({ error: "make, model, and year are required" });
    }
    const cfg = filteredMarkets[market || "za"] || markets.za;
    const m = cfg.id === "housingZa" ? location || make : make;
    const data = await fetchValuation(String(m), String(model), String(year), {
      mileage: Number(mileage) || void 0,
      variant: variant ? String(variant) : void 0
    }, cfg);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || "Valuation failed" });
  }
});
app.post("/api/fsbo", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests \u2014 slow down." });
  try {
    const { suburb, city, limit } = req.body || {};
    if (!suburb) return res.status(400).json({ error: "suburb is required" });
    const { extractFsboLeads: extractFsboLeads2 } = await Promise.resolve().then(() => (init_fsbo_extractor(), fsbo_extractor_exports));
    const cleanLimit = Math.min(25, Math.max(1, Number(limit) || 8));
    const data = await extractFsboLeads2(String(suburb).trim(), String(city || "").trim(), cleanLimit);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || "FSBO extraction failed" });
  }
});
app.post("/api/agency/crawl", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString();
  if (throttled(ip)) return res.status(429).json({ error: "Too many requests \u2014 slow down." });
  try {
    const { city = "Durban", industry = "plumbers", country = "za", limit = 10 } = req.body || {};
    const { crawlLegacySites: crawlLegacySites2 } = await Promise.resolve().then(() => (init_crawler(), crawler_exports));
    const data = await crawlLegacySites2({
      city: String(city).trim(),
      industry: String(industry).trim(),
      country: country === "uk" ? "uk" : "za",
      maxResults: Math.min(25, Math.max(1, Number(limit) || 10))
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err?.message || "Legacy site crawl failed" });
  }
});
app.use(import_express.default.static(__dirname));
var server = app.listen(PORT, () => console.log(`market value on http://localhost:${PORT}`));
process.on("SIGTERM", () => {
  console.log("[scraper] SIGTERM received, draining...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 1e4);
});
