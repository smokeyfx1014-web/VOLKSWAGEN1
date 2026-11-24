export type AssetAspectRatio = '16:9' | '4:3' | '3:2' | '16:10' | '1:1';

export type DealershipId = string;

export interface DealershipGroupProfile {
  id: 'main';
  groupName: string;
  legalEntity: string;
  fspNumber: string;
  complianceOfficer: string;
  complianceEmail: string;
  vwRoadsideTollFree: string;
  vwRoadsideCrossBorder: string;
  testDriveHoursSummary: string;
  groupLogoSrc: string;
  emblemLogoSrc: string;
  youtubeUrl: string;
  defaultBranchId: DealershipId;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface DealershipRecord {
  id: DealershipId;
  name: string;
  shortName: string;
  referenceCode?: string;
  legalEntity: string;
  fspNumber: string;
  domain: string;
  receptionNumber: string;
  whatsappNumber: string;
  email: string;
  physicalAddress: string;
  postalAddress: string;
  city: string;
  province: string;
  salesHours: string;
  serviceHours: string;
  roadsideAssist: string;
  vwFinancialServices: string;
  volkswagensure: string;
  mapEmbedUrl: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  autotraderDealerId: string;
  autotraderUrl: string;
  syncEnabled: boolean;
  archived?: boolean;
  sortOrder?: number;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface AssetSlotSpec {
  slotId: string;
  targetPath: string;
  aspectRatio: AssetAspectRatio;
  dimensions: string;
  subject: string;
  tone?: 'dark' | 'light';
  src?: string;
}

export interface HeroSlide {
  id: string;
  kicker: string;
  headline: string;
  subheadline: string;
  primaryCtaLabel: string;
  primaryCtaAction: 'explore-models' | 'book-test-drive' | 'finance';
  secondaryCtaLabel: string;
  secondaryCtaTarget: string;
  featuredModel: string;
  startingPrice: string;
  asset: AssetSlotSpec;
}

export type VehicleCategory = 'All' | 'Hatchbacks & Sedans' | 'SUVs' | 'Commercial';
export type StockCondition = 'All' | 'New' | 'Used' | 'MasterCars';
export type VehicleStatus = 'available' | 'reserved' | 'sold';

export interface MotoringArticle {
  id: string;
  category: string;
  publishedDate: string;
  readTime: string;
  title: string;
  excerpt: string;
  body: string[];
  featured?: boolean;
  asset: AssetSlotSpec;
}

export type VehicleSource = 'autotrader' | 'manual';

/** Master Group Stock Vehicle stored in /vehicles/{vehicleId} */
export interface CmsVehicle {
  id: string;
  title: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  price: number;
  priceFormatted?: string;
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
  homeDealershipId: DealershipId;
  status: VehicleStatus;
  source?: VehicleSource;
  externalListingId?: string;
  dealerId?: string;
  canonicalUrl?: string;
  lastSyncedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedBy: string;
}

export interface AutoTraderBranchSyncSummary {
  branchId: DealershipId;
  branchName: string;
  dealerId: string;
  skipped: boolean;
  skipReason?: string;
  pagesScraped: number;
  scrapedCount: number;
  addedCount: number;
  updatedCount: number;
  markedSoldCount: number;
  error?: string;
}

export interface AutoTraderSyncReport {
  syncedAtIso: string;
  mode: 'decodo' | 'json-import';
  branches: AutoTraderBranchSyncSummary[];
}

export type PromotionType = 'special' | 'event' | 'competition';
export type PromotionScope = 'MASTER' | 'BRANCH';

/** Scoped Special, Event, or Competition stored in /promotions/{promotionId} */
export interface CmsPromotion {
  id: string;
  title: string;
  type: PromotionType;
  description: string;
  imageUrl: string;
  mediaType?: 'image' | 'video';
  validUntil: string; // YYYY-MM-DD
  scope: PromotionScope;
  dealershipId: DealershipId | null;
  active: boolean;
  vehicleName: string;
  offerPrice: number;
  monthlyFrom: number;
  eventTime: string;
  location: string;
  updatedAt?: unknown;
  updatedBy: string;
}

export interface CmsNewsArticle {
  id: string;
  title: string;
  category: string;
  publishedDate: string;
  readTime: string;
  excerpt: string;
  bodyText: string;
  featured: boolean;
  archived: boolean;
  imageSrc: string;
  updatedAt?: unknown;
  updatedBy: string;
}

export type LeadSubmissionType =
  | 'test-drive'
  | 'service'
  | 'parts'
  | 'finance'
  | 'vehicle-inquiry'
  | 'contact'
  | 'event-rsvp'
  | 'competition-entry';

export interface CmsLeadSubmission {
  id: string;
  leadType: LeadSubmissionType;
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  details: string;
  submittedAtDealershipId: DealershipId;
  homeDealershipId: DealershipId | null;
  status: 'new' | 'contacted' | 'archived';
  createdAt?: unknown;
}

export type StaffRole = 'admin' | 'agent' | 'parts' | 'marketing' | 'service';

export interface StaffUserProfile {
  uid: string;
  fullName: string;
  phone: string;
  email: string;
  role: StaffRole;
  allocatedDealershipId: DealershipId | null;
  mustChangePassword: boolean;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
  updatedBy: string;
}

export type AppRoute =
  | '/'
  | '/vehicles'
  | '/specials'
  | '/test-drive'
  | '/aftersales'
  | '/service'
  | '/parts'
  | '/finance'
  | '/vw-alert'
  | '/news-events'
  | '/news'
  | '/contact'
  | '/privacy-policy'
  | '/terms'
  | '/sitemap'
  | '/admin';

export type ModalWorkflowType =
  | 'test-drive'
  | 'finance'
  | 'service'
  | 'parts'
  | 'vehicle-inquiry'
  | 'event-rsvp'
  | 'competition-entry'
  | 'contact'
  | 'news-reader'
  | 'legal'
  | null;

export interface ModalContextState {
  type: ModalWorkflowType;
  vehicleName?: string;
  vehiclePrice?: number;
  homeDealershipId?: DealershipId | null;
  dealSummary?: string;
  eventTitle?: string;
  competitionTitle?: string;
  article?: MotoringArticle;
  legalDoc?: 'popia' | 'paia' | 'terms' | 'mastercars';
  financePreset?: {
    vehiclePrice: number;
    depositPercent: number;
    balloonPercent: number;
    termMonths: number;
    monthlyEstimate: number;
  };
}
