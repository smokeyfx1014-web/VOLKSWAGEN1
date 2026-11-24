import type { CmsVehicle, DealershipId } from '../types/dealership.ts';

export interface ParsedAutoTraderVehicle {
  id: string;
  externalListingId: string;
  dealerId: string;
  homeDealershipId: DealershipId;
  title: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  price: number;
  priceFormatted: string;
  monthlyFrom: number;
  mileage: number;
  transmission: string;
  fuelType: string;
  category: 'New' | 'Used' | 'MasterCars';
  bodyStyle: 'Hatchbacks & Sedans' | 'SUVs' | 'Commercial';
  powerKw: string;
  fuelEconomy: string;
  colour: string;
  images: string[];
  canonicalUrl: string;
  source: 'autotrader';
}

const ALLOWED_AT_HOSTS = new Set(['www.autotrader.co.za', 'autotrader.co.za']);
const ALLOWED_IMG_FALLBACK = '/assets/aistudio/vwslider10_5974d4ed.jpg';

export function validateAutoTraderDealerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('AutoTrader URL must be a valid https:// URL.');
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_AT_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('AutoTrader URL must target https://www.autotrader.co.za.');
  }
  if (!parsed.pathname.startsWith('/dealer/')) {
    throw new Error('AutoTrader URL path must start with /dealer/.');
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

export function formatZarPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return 'POA';
  const rounded = Math.round(price);
  return `R ${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

export function estimateMonthlyFromPrice(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  // Standard South African 72-month / 11.25% indicative finance estimate with 10% deposit
  const principal = price * 0.9;
  const r = 0.1125 / 12;
  const n = 72;
  const factor = Math.pow(1 + r, n);
  const pmt = (principal * r * factor) / (factor - 1);
  return Math.max(0, Math.round(pmt / 10) * 10);
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;|\u00a0/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '));
}

export function inferBodyStyle(text: string): CmsVehicle['bodyStyle'] {
  const lower = text.toLowerCase();
  if (
    lower.includes('amarok') ||
    lower.includes('transporter') ||
    lower.includes('caddy') ||
    lower.includes('crafter') ||
    lower.includes('kombi') ||
    lower.includes('caravelle') ||
    lower.includes('super carry') ||
    lower.includes('double cab') ||
    lower.includes('single cab') ||
    lower.includes('extended cab') ||
    lower.includes('bakkie') ||
    lower.includes('panel van')
  ) {
    return 'Commercial';
  }
  if (
    lower.includes('t-cross') ||
    lower.includes('t cross') ||
    lower.includes('taigo') ||
    lower.includes('t-roc') ||
    lower.includes('t roc') ||
    lower.includes('tiguan') ||
    lower.includes('tayron') ||
    lower.includes('touareg') ||
    lower.includes('q2') ||
    lower.includes('q3') ||
    lower.includes('q5') ||
    lower.includes('q7') ||
    lower.includes('q8') ||
    lower.includes('beijing x55') ||
    lower.includes('b30') ||
    lower.includes('ertiga') ||
    lower.includes('ignis') ||
    lower.includes('suv') ||
    lower.includes('crossover') ||
    lower.includes('sportback')
  ) {
    return 'SUVs';
  }
  return 'Hatchbacks & Sedans';
}

function inferCategory(text: string, mileage: number, isCertified = false): CmsVehicle['category'] {
  const lower = text.toLowerCase();
  if (isCertified || lower.includes('mastercar')) return 'MasterCars';
  if (lower.includes('new car') || lower.includes('brand new') || (lower.includes('new') && mileage <= 50)) {
    return 'New';
  }
  if (lower.includes('volkswagen') && mileage > 50 && mileage <= 120000) return 'MasterCars';
  return 'Used';
}

function parseNumericPrice(raw: string): number {
  const normalized = raw.replace(/\u00a0/g, ' ');
  const match = normalized.match(/R\s*([\d\s,]+)/i) ?? normalized.match(/([\d\s,]{5,})/);
  if (!match) return 0;
  const digits = match[1].replace(/[^\d]/g, '');
  const val = Number(digits);
  return Number.isFinite(val) && val >= 20000 && val <= 25000000 ? val : 0;
}

function parseMileageKm(raw: string): number {
  const normalized = raw.replace(/\u00a0/g, ' ');
  const match = normalized.match(/([\d\s,]+)\s*km\b/i);
  if (!match) return 0;
  const digits = match[1].replace(/[^\d]/g, '');
  const val = Number(digits);
  return Number.isFinite(val) && val >= 0 && val <= 2000000 ? val : 0;
}

function sanitizeImageUrls(urls: string[], excludedUrls: Set<string> = new Set()): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const raw of urls) {
    const clean = raw.trim().replace(/^http:\/\//i, 'https://');
    if (
      clean.length < 10 ||
      clean.length > 500 ||
      excludedUrls.has(clean) ||
      clean.includes('/Fit160x120') ||
      clean.includes('logo') ||
      clean.includes('placeholder') ||
      clean.includes('sprite') ||
      clean.includes('loader-') ||
      clean.endsWith('.svg')
    ) {
      continue;
    }
    if ((clean.startsWith('https://') || clean.startsWith('/assets/')) && !seen.has(clean)) {
      seen.add(clean);
      valid.push(clean);
    }
    if (valid.length >= 10) break;
  }
  return valid.length > 0 ? valid : [ALLOWED_IMG_FALLBACK];
}

function parseTitleComponents(
  rawTitle: string,
  fallbackMake = 'Volkswagen'
): { year: number; make: string; model: string; variant: string } {
  const cleaned = decodeHtmlEntities(rawTitle);
  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  const withoutYear = cleaned.replace(/\b(19\d{2}|20\d{2})\b/, '').trim();
  const knownMakes = [
    'Volkswagen',
    'Audi',
    'Porsche',
    'Toyota',
    'Ford',
    'BMW',
    'Mercedes-Benz',
    'Hyundai',
    'Kia',
    'Suzuki',
    'BAIC',
    'Nissan',
    'Isuzu',
    'Mazda',
    'Renault',
    'Chery',
    'Haval',
    'GWM',
    'Omoda',
    'Jaecoo',
  ];

  let make = fallbackMake;
  let rest = withoutYear;
  for (const candidate of knownMakes) {
    const re = new RegExp(`^${candidate}\\b`, 'i');
    if (re.test(withoutYear)) {
      make = candidate;
      rest = withoutYear.replace(re, '').trim();
      break;
    }
  }
  if (!rest) {
    const tokens = withoutYear.split(/\s+/);
    if (tokens.length > 1) {
      make = tokens[0];
      rest = tokens.slice(1).join(' ');
    } else {
      rest = withoutYear || 'Polo Vivo';
    }
  }

  const parts = rest.split(/\s+/);
  const model = parts.slice(0, Math.min(2, parts.length)).join(' ').slice(0, 100);
  const variant = rest.slice(0, 140);
  return { year, make: make.slice(0, 60), model: model || rest, variant };
}

function buildParsedVehicle(params: {
  listingId: string;
  branchId: DealershipId;
  dealerId: string;
  title: string;
  make?: string;
  model?: string;
  variant?: string;
  year?: number;
  price?: number;
  monthlyFrom?: number;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  category?: 'New' | 'Used' | 'MasterCars';
  bodyStyle?: CmsVehicle['bodyStyle'];
  powerKw?: string;
  fuelEconomy?: string;
  colour?: string;
  images?: string[];
  excludedImageUrls?: Set<string>;
  canonicalUrl?: string;
  contextText?: string;
  isCertified?: boolean;
}): ParsedAutoTraderVehicle | null {
  const cleanId = params.listingId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56);
  const cleanTitle = decodeHtmlEntities(params.title || '').slice(0, 140);
  if (!cleanId || cleanTitle.length < 3) return null;

  const parsedTitle = parseTitleComponents(cleanTitle, params.make || 'Volkswagen');
  const year =
    params.year && params.year >= 1990 && params.year <= 2100 ? params.year : parsedTitle.year;
  const price = Math.max(0, Math.round(params.price ?? 0));
  const mileage = Math.max(0, Math.min(2000000, Math.round(params.mileage ?? 0)));
  const monthlyFrom =
    params.monthlyFrom && params.monthlyFrom > 0
      ? Math.round(params.monthlyFrom)
      : estimateMonthlyFromPrice(price);

  const combinedText = `${cleanTitle} ${params.variant ?? ''} ${params.contextText ?? ''}`;
  const transmission = (params.transmission || (/manual/i.test(combinedText) ? 'Manual' : 'Automatic'))
    .trim()
    .slice(0, 60);
  const fuelType = (
    params.fuelType ||
    (/diesel|tdi/i.test(combinedText)
      ? 'Diesel'
      : /hybrid/i.test(combinedText)
      ? 'Hybrid'
      : /electric|ev\b/i.test(combinedText)
      ? 'Electric'
      : 'Petrol')
  )
    .trim()
    .slice(0, 40);

  const category =
    params.category ?? inferCategory(combinedText, mileage, Boolean(params.isCertified));
  const bodyStyle = params.bodyStyle ?? inferBodyStyle(combinedText);
  const images = sanitizeImageUrls(params.images ?? [], params.excludedImageUrls);
  const canonicalUrl = (params.canonicalUrl || '').trim().slice(0, 400);

  return {
    id: `at_${cleanId}`,
    externalListingId: cleanId,
    dealerId: params.dealerId.trim().slice(0, 30),
    homeDealershipId: params.branchId,
    title: cleanTitle,
    make: (params.make || parsedTitle.make || 'Volkswagen').trim().slice(0, 60),
    model: (params.model || parsedTitle.model || cleanTitle).trim().slice(0, 100),
    variant: (params.variant || parsedTitle.variant || cleanTitle).trim().slice(0, 140),
    year,
    price,
    priceFormatted: formatZarPrice(price),
    monthlyFrom,
    mileage,
    transmission,
    fuelType,
    category,
    bodyStyle,
    powerKw: (params.powerKw || 'N/A').trim().slice(0, 40),
    fuelEconomy: (params.fuelEconomy || 'VW Spec').trim().slice(0, 40),
    colour: (params.colour || 'Dealership Stock').trim().slice(0, 60),
    images,
    canonicalUrl: canonicalUrl.startsWith('https://')
      ? canonicalUrl
      : canonicalUrl.startsWith('/')
      ? `https://www.autotrader.co.za${canonicalUrl}`
      : '',
    source: 'autotrader',
  };
}

interface AutoTraderEmbeddedResult {
  listingId?: number | string;
  canonicalUrl?: string;
  imageUrl?: string;
  adCardGalleryImageUrls?: string[];
  dealerLogoImageUrl?: string;
  makeModel?: string;
  make?: string;
  model?: string;
  variant?: string;
  makeModelLongVariant?: string;
  newUsedDescription?: string;
  isCommercial?: boolean;
  isDemo?: boolean;
  isCertifiedUsedCar?: boolean;
  registrationYear?: number;
  price?: string | number;
  isPOA?: boolean;
  summaryIcons?: Array<{ text?: string }>;
}

interface AutoTraderDealerProfilePayload {
  id?: number | string;
  logoUrl?: string;
  searchViewModel?: {
    results?: {
      pageNumber?: number;
      pageCount?: number;
      results?: AutoTraderEmbeddedResult[];
    };
  };
}

function extractBalancedJsonFromHtmlMarker(
  html: string,
  marker: string
): AutoTraderDealerProfilePayload | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
    } else {
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1)) as AutoTraderDealerProfilePayload;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

function extractDealerProfilePayload(html: string): AutoTraderDealerProfilePayload | null {
  return (
    extractBalancedJsonFromHtmlMarker(html, 'Features_Dealer_Views_Desktop_DealerProfile') ??
    extractBalancedJsonFromHtmlMarker(html, 'Features_Dealer_Views_Mobile_DealerProfile') ??
    extractBalancedJsonFromHtmlMarker(html, 'Features_Dealer_Views_')
  );
}

export function extractAutoTraderPaginationInfo(html: string): {
  pageNumber: number;
  pageCount: number;
} {
  const payload = extractDealerProfilePayload(html);
  const pageNumber = Number(payload?.searchViewModel?.results?.pageNumber || 1);
  const pageCount = Number(payload?.searchViewModel?.results?.pageCount || 1);
  return {
    pageNumber: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    pageCount: Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1,
  };
}

function parseFromEmbeddedDealerProfile(
  html: string,
  branch: { id: DealershipId; autotraderDealerId: string }
): ParsedAutoTraderVehicle[] {
  const payload = extractDealerProfilePayload(html);
  const rawResults = payload?.searchViewModel?.results?.results;
  if (!Array.isArray(rawResults) || rawResults.length === 0) return [];

  const dealerLogoBase = payload?.logoUrl?.trim();
  const parsed: ParsedAutoTraderVehicle[] = [];
  const seen = new Set<string>();

  for (const r of rawResults) {
    const listingId = r.listingId ? String(r.listingId) : '';
    if (!listingId || seen.has(listingId)) continue;
    // Skip placeholder skeleton rows that have no vehicle data or price
    if (!r.makeModel && !r.makeModelLongVariant && !r.price) continue;

    const iconTexts = (r.summaryIcons ?? [])
      .map((icon) => decodeHtmlEntities(icon?.text || ''))
      .filter(Boolean);
    const iconsJoined = iconTexts.join(' ');
    const mileage = parseMileageKm(iconsJoined);

    const transmission = iconTexts.find((t) => /^(Automatic|Manual)$/i.test(t));
    const fuelType = iconTexts.find((t) => /^(Petrol|Diesel|Hybrid|Electric)$/i.test(t));
    const year = typeof r.registrationYear === 'number' ? r.registrationYear : undefined;

    const makeModel = decodeHtmlEntities(
      r.makeModel || `${r.make ?? ''} ${r.model ?? ''}`
    ).trim();
    const variant = decodeHtmlEntities(r.variant || '').trim();
    const title = [year ? String(year) : '', makeModel, variant].filter(Boolean).join(' ');

    const rawPrice =
      r.isPOA === true
        ? 0
        : typeof r.price === 'number'
        ? r.price
        : parseNumericPrice(String(r.price ?? ''));

    const excludedImgs = new Set<string>();
    if (dealerLogoBase) excludedImgs.add(dealerLogoBase);
    if (r.dealerLogoImageUrl) excludedImgs.add(r.dealerLogoImageUrl.trim());

    const images = [
      ...(Array.isArray(r.adCardGalleryImageUrls) ? r.adCardGalleryImageUrls : []),
      ...(r.imageUrl ? [r.imageUrl] : []),
    ];

    const built = buildParsedVehicle({
      listingId,
      branchId: branch.id,
      dealerId: branch.autotraderDealerId || (payload?.id ? String(payload.id) : ''),
      title,
      make: r.make,
      model: r.model,
      variant,
      year,
      price: rawPrice,
      mileage,
      transmission,
      fuelType,
      images,
      excludedImageUrls: excludedImgs,
      canonicalUrl: r.canonicalUrl,
      contextText: `${r.newUsedDescription ?? ''} ${iconsJoined} ${r.isCommercial ? 'commercial' : ''}`,
      isCertified: Boolean(r.isCertifiedUsedCar),
    });

    if (built) {
      seen.add(listingId);
      parsed.push(built);
    }
  }

  return parsed;
}

export function parseAutoTraderHtml(
  html: string,
  branch: { id: DealershipId; autotraderDealerId: string }
): ParsedAutoTraderVehicle[] {
  if (!html || typeof html !== 'string') return [];

  // Primary Strategy: Parse structured DealerProfile JSON embedded by AutoTrader
  const fromEmbeddedJson = parseFromEmbeddedDealerProfile(html, branch);
  if (fromEmbeddedJson.length > 0) {
    return fromEmbeddedJson;
  }

  // Fallback Strategy: Parse full <a ...>...</a> tile cards cleanly from HTML
  const byListingId = new Map<string, ParsedAutoTraderVehicle>();
  const linkRegex =
    /<a\b[^>]*href=["'](https?:\/\/(?:www\.)?autotrader\.co\.za)?(\/car-for-sale\/[^"'#?]+\/(\d{6,12}))(?:[?#][^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const pathPart = match[2];
    const listingId = match[3];
    const anchorInner = match[4] ?? '';
    if (!listingId || byListingId.has(listingId)) continue;

    const cardText = stripTags(anchorInner);
    const makeModelMatch = anchorInner.match(/e-make-model-title[^>]*>([^<]+)</i);
    const variantMatch = anchorInner.match(/e-variant-title[^>]*>([^<]+)</i);
    const priceTagMatch = anchorInner.match(/e-price__[^>]*>([^<]+)</i);

    let title = [
      makeModelMatch ? decodeHtmlEntities(makeModelMatch[1]) : '',
      variantMatch ? decodeHtmlEntities(variantMatch[1]) : '',
    ]
      .filter(Boolean)
      .join(' ');

    if (!title || title.length < 4) {
      const slugParts = pathPart
        .replace(/^\/car-for-sale\//i, '')
        .split('/')
        .slice(0, 2)
        .join(' ')
        .replace(/-/g, ' ');
      const yearHint = cardText.match(/\b(19\d{2}|20\d{2})\b/)?.[1] ?? '';
      title = `${yearHint} ${slugParts}`.trim();
    }

    const imgUrls: string[] = [];
    const imgMatches = anchorInner.matchAll(
      /(?:src|data-src)=["'](https:\/\/img\.autotrader\.co\.za\/[^"'\s]+)["']/gi
    );
    for (const im of imgMatches) {
      if (im[1] && !im[1].includes('/Fit160x120')) {
        imgUrls.push(im[1]);
      }
    }

    const price = parseNumericPrice(priceTagMatch?.[1] ?? cardText);
    const mileage = parseMileageKm(cardText);

    const parsed = buildParsedVehicle({
      listingId,
      branchId: branch.id,
      dealerId: branch.autotraderDealerId,
      title,
      variant: variantMatch ? decodeHtmlEntities(variantMatch[1]) : undefined,
      price,
      mileage,
      images: imgUrls,
      canonicalUrl: pathPart,
      contextText: cardText,
    });

    if (parsed) {
      byListingId.set(listingId, parsed);
    }
  }

  return Array.from(byListingId.values());
}

export function normalizeAutoTraderJsonInput(
  rawInput: string,
  defaultBranchId: DealershipId,
  defaultDealerId: string
): { vehicles: ParsedAutoTraderVehicle[]; errors: string[] } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { vehicles: [], errors: ['Paste AutoTrader JSON or Decodo scrape output first.'] };
  }

  // If raw HTML was pasted directly, parse it cleanly
  if (trimmed.startsWith('<')) {
    const parsedHtml = parseAutoTraderHtml(trimmed, {
      id: defaultBranchId,
      autotraderDealerId: defaultDealerId,
    });
    if (parsedHtml.length === 0) {
      return {
        vehicles: [],
        errors: ['No AutoTrader vehicle listings were found in the pasted HTML.'],
      };
    }
    return { vehicles: parsedHtml, errors: [] };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch (err) {
    return {
      vehicles: [],
      errors: [err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON payload.'],
    };
  }

  // Handle Decodo API wrapper: { results: [{ content: "<html>..." }] }
  if (
    parsedJson &&
    typeof parsedJson === 'object' &&
    !Array.isArray(parsedJson) &&
    Array.isArray((parsedJson as { results?: unknown[] }).results)
  ) {
    const decodoResults = (parsedJson as { results: { content?: string }[] }).results;
    const htmlJoined = decodoResults.map((r) => r?.content ?? '').join('\n');
    if (htmlJoined.length > 0) {
      const fromDecodo = parseAutoTraderHtml(htmlJoined, {
        id: defaultBranchId,
        autotraderDealerId: defaultDealerId,
      });
      if (fromDecodo.length > 0) {
        return { vehicles: fromDecodo, errors: [] };
      }
    }
  }

  const rawArray = Array.isArray(parsedJson)
    ? parsedJson
    : parsedJson && typeof parsedJson === 'object'
    ? (parsedJson as { vehicles?: unknown[]; listings?: unknown[]; items?: unknown[] }).vehicles ??
      (parsedJson as { listings?: unknown[] }).listings ??
      (parsedJson as { items?: unknown[] }).items ??
      [parsedJson]
    : [];

  const vehicles: ParsedAutoTraderVehicle[] = [];
  const errors: string[] = [];

  rawArray.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`Row ${index + 1}: Expected a JSON object.`);
      return;
    }
    const row = entry as Record<string, unknown>;
    const rawId =
      row.externalListingId ??
      row.listingId ??
      (typeof row.id === 'string' ? row.id.replace(/^at_/i, '') : row.id) ??
      `manual-${Date.now()}-${index + 1}`;
    const listingId = String(rawId).trim();
    const title = String(
      row.title ?? `${row.year ?? row.registrationYear ?? ''} ${row.makeModel ?? `${row.make ?? 'Volkswagen'} ${row.model ?? ''}`} ${row.variant ?? ''}`
    ).trim();
    const price =
      typeof row.price === 'number'
        ? row.price
        : parseNumericPrice(String(row.price ?? row.priceFormatted ?? '0'));
    const mileage =
      typeof row.mileage === 'number'
        ? row.mileage
        : parseMileageKm(String(row.mileage ?? '0'));
    const branchCandidate = String(row.homeDealershipId ?? defaultBranchId).trim();
    const branchId: DealershipId = /^[a-zA-Z0-9_-]{1,64}$/.test(branchCandidate)
      ? branchCandidate
      : defaultBranchId;

    const imagesRaw = Array.isArray(row.adCardGalleryImageUrls)
      ? row.adCardGalleryImageUrls.map((item) => String(item))
      : Array.isArray(row.images)
      ? row.images.map((item) => String(item))
      : typeof row.imageUrl === 'string'
      ? [row.imageUrl]
      : typeof row.image === 'string'
      ? [row.image]
      : [];

    const categoryRaw = String(row.category ?? '');
    const category: 'New' | 'Used' | 'MasterCars' | undefined =
      categoryRaw === 'New' || categoryRaw === 'Used' || categoryRaw === 'MasterCars'
        ? categoryRaw
        : undefined;

    const bodyRaw = String(row.bodyStyle ?? '');
    const bodyStyle: CmsVehicle['bodyStyle'] | undefined =
      bodyRaw === 'Hatchbacks & Sedans' || bodyRaw === 'SUVs' || bodyRaw === 'Commercial'
        ? bodyRaw
        : undefined;

    const built = buildParsedVehicle({
      listingId,
      branchId,
      dealerId: String(row.dealerId ?? defaultDealerId),
      title,
      make: typeof row.make === 'string' ? row.make : undefined,
      model: typeof row.model === 'string' ? row.model : undefined,
      variant: typeof row.variant === 'string' ? row.variant : undefined,
      year:
        typeof row.year === 'number'
          ? row.year
          : typeof row.registrationYear === 'number'
          ? row.registrationYear
          : Number(row.year) || undefined,
      price,
      monthlyFrom: typeof row.monthlyFrom === 'number' ? row.monthlyFrom : undefined,
      mileage,
      transmission: typeof row.transmission === 'string' ? row.transmission : undefined,
      fuelType: typeof row.fuelType === 'string' ? row.fuelType : undefined,
      category,
      bodyStyle,
      powerKw: typeof row.powerKw === 'string' ? row.powerKw : undefined,
      fuelEconomy: typeof row.fuelEconomy === 'string' ? row.fuelEconomy : undefined,
      colour: typeof row.colour === 'string' ? row.colour : undefined,
      images: imagesRaw,
      canonicalUrl: typeof row.canonicalUrl === 'string' ? row.canonicalUrl : undefined,
    });

    if (!built) {
      errors.push(`Row ${index + 1}: Missing valid listingId or vehicle title.`);
    } else {
      vehicles.push(built);
    }
  });

  return { vehicles, errors };
}
