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
  defaultNotifyEmail?: string;
  primarySiteUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpFrom?: string;
  smtpPassEnvKey?: string;
  licenceScannerEnabled?: boolean;
  autotraderSyncDefault?: boolean;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface SystemStatusResponse {
  runtime: 'vercel' | 'node';
  ephemeralStorage: boolean;
  port: number;
  appUrlConfigured: boolean;
  appUrlValue: string;
  firebase: {
    projectId: string;
    firestoreDatabaseId: string;
    authDomain: string;
  };
  apis: {
    gemini: {
      configured: boolean;
      envVar: string;
      label: string;
    };
    decodo: {
      configured: boolean;
      envVar: string;
      label: string;
    };
    globalSmtp: {
      configured: boolean;
      envVar: string;
      host: string;
      port: number;
      user: string;
      from: string;
      defaultNotify: string;
    };
  };
  branches: Array<{
    branchId: string;
    branchName: string;
    branchPassKey: string;
    branchSecretConfigured: boolean;
    effectiveReady: boolean;
    configuredHost: string;
    configuredPort: number;
    configuredUser: string;
    configuredFrom: string;
  }>;
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
  salesNotifyEmail?: string;
  serviceNotifyEmail?: string;
  partsNotifyEmail?: string;
  financeNotifyEmail?: string;
  generalNotifyEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpFrom?: string;
  defaultNotifyEmail?: string;
  smtpPassEnvKey?: string;
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
export type StockCondition = 'All' | 'New' | 'Demo' | 'MasterCars' | 'Used';
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
  category: 'New' | 'Demo' | 'MasterCars' | 'Used';
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
  | 'spotter'
  | 'finance'
  | 'vehicle-inquiry'
  | 'contact'
  | 'event-rsvp'
  | 'competition-entry'
  | 'job-application';

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

export type JobApplicationMode = 'internal' | 'external';
export type JobEmploymentType = 'Full-Time' | 'Part-Time' | 'Apprenticeship' | 'Fixed-Term';
export type JobApplicationStatus =
  | 'new'
  | 'shortlisted'
  | 'interview'
  | 'rejected'
  | 'archived';

export interface CareerDocumentRef {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CmsJobOpening {
  id: string;
  title: string;
  department: string;
  dealershipId: DealershipId | null;
  locationLabel: string;
  employmentType: JobEmploymentType;
  closingDate: string; // YYYY-MM-DD
  summary: string;
  responsibilities: string;
  requirements: string;
  applicationMode: JobApplicationMode;
  externalApplyUrl: string;
  requiresLicence: boolean;
  licenceDescription: string;
  active: boolean;
  updatedAt?: unknown;
  updatedBy: string;
}

export interface CmsJobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  branchId: DealershipId | null;
  fullName: string;
  email: string;
  phone: string;
  idNumber: string;
  cityOrSuburb: string;
  yearsExperience: number;
  highestQualification: string;
  driversLicenceCode: string;
  coverNote: string;
  resumeDoc: CareerDocumentRef;
  qualificationDoc: CareerDocumentRef;
  idCopyDoc: CareerDocumentRef;
  licenceDoc: CareerDocumentRef | null;
  status: JobApplicationStatus;
  createdAt?: unknown;
}

export type StaffRole =
  | 'admin'
  | 'branch_admin'
  | 'it_manager'
  | 'it_agent'
  | 'agent'
  | 'parts'
  | 'marketing'
  | 'service';

export type EscalatableStaffRole =
  | 'branch_admin'
  | 'agent'
  | 'parts'
  | 'service'
  | 'marketing';

export interface ActiveStaffEscalation {
  ticketId: string;
  grantedRole: EscalatableStaffRole;
  dealershipId: DealershipId | null;
  expiresAt: unknown;
  grantedBy: string;
}

export type ItTicketStatus =
  | 'open'
  | 'approved_temporary'
  | 'resolved'
  | 'rejected'
  | 'revoked';

export interface ItEscalationTicket {
  id: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail: string;
  requesterBranchId: DealershipId;
  targetDealershipId: DealershipId | null;
  requestedRole: EscalatableStaffRole;
  requestedDurationMinutes: number;
  title: string;
  reason: string;
  status: ItTicketStatus;
  reviewNote: string;
  reviewedByUid: string | null;
  reviewedByName: string | null;
  approvedAt: unknown | null;
  expiresAt: unknown | null;
  resolvedAt: unknown | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffUserProfile {
  uid: string;
  fullName: string;
  phone: string;
  email: string;
  role: StaffRole;
  allocatedDealershipId: DealershipId | null;
  mustChangePassword: boolean;
  active: boolean;
  activeEscalation?: ActiveStaffEscalation | null;
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
  | '/careers'
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
