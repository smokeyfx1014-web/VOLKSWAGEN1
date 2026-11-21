export type AssetAspectRatio = '16:9' | '4:3' | '3:2' | '16:10' | '1:1';

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
export type StockCondition = 'All' | 'New' | 'MasterCars' | 'Demo';

export interface VehicleModel {
  id: string;
  name: string;
  category: Exclude<VehicleCategory, 'All'>;
  condition: Exclude<StockCondition, 'All'>;
  variant: string;
  year: number;
  mileageKm: number;
  priceFrom: number;
  monthlyFrom: number;
  powerKw: string;
  transmission: string;
  fuelEconomy: string;
  inStock: boolean;
  isSpecial: boolean;
  specialOfferSummary?: string;
  specialValidUntil?: string;
  asset: AssetSlotSpec;
}

export interface MasterCarListing {
  id: string;
  title: string;
  year: number;
  mileageKm: number;
  price: number;
  monthlyEstimate: number;
  transmission: string;
  fuelType: string;
  colour: string;
  bodyType: 'Hatchback' | 'SUV' | 'Commercial';
  condition: 'MasterCars' | 'Demo';
  asset: AssetSlotSpec;
}

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

export type AppRoute =
  | '/'
  | '/vehicles'
  | '/specials'
  | '/test-drive'
  | '/service'
  | '/parts'
  | '/finance'
  | '/vw-alert'
  | '/news'
  | '/contact'
  | '/privacy-policy'
  | '/terms'
  | '/sitemap';

export type ModalWorkflowType =
  | 'test-drive'
  | 'finance'
  | 'service'
  | 'parts'
  | 'vehicle-inquiry'
  | 'contact'
  | 'news-reader'
  | 'legal'
  | null;

export interface ModalContextState {
  type: ModalWorkflowType;
  vehicleName?: string;
  vehiclePrice?: number;
  dealSummary?: string;
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
