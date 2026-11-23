import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DealershipId } from '../types/dealership';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatZAR(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `R ${formatted}`;
}

export interface FinanceCalculationInput {
  vehiclePrice: number;
  depositPercent: number;
  balloonPercent: number;
  interestRate: number;
  termMonths: number;
}

export interface FinanceCalculationResult {
  depositAmount: number;
  balloonAmount: number;
  principalFinanced: number;
  monthlyInstalment: number;
  totalPayable: number;
}

export function calculateMonthlyFinance({
  vehiclePrice,
  depositPercent,
  balloonPercent,
  interestRate,
  termMonths,
}: FinanceCalculationInput): FinanceCalculationResult {
  const depositAmount = vehiclePrice * (depositPercent / 100);
  const balloonAmount = vehiclePrice * (balloonPercent / 100);
  const principalFinanced = Math.max(vehiclePrice - depositAmount, 0);

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) {
    const monthlyInstalment = Math.max((principalFinanced - balloonAmount) / termMonths, 0);
    return {
      depositAmount,
      balloonAmount,
      principalFinanced,
      monthlyInstalment,
      totalPayable: monthlyInstalment * termMonths + balloonAmount + depositAmount,
    };
  }

  const pvBalloon = balloonAmount / Math.pow(1 + monthlyRate, termMonths);
  const netFinanced = Math.max(principalFinanced - pvBalloon, 0);
  const factor =
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  const monthlyInstalment = netFinanced * factor;
  const totalPayable = monthlyInstalment * termMonths + balloonAmount + depositAmount;

  return {
    depositAmount,
    balloonAmount,
    principalFinanced,
    monthlyInstalment,
    totalPayable,
  };
}

const BRANCH_REF_CODES: Record<DealershipId, string> = {
  '1': 'NVW',
  '2': 'EVW',
  '3': 'VVW',
};

export function generateBookingRef(prefix: string, branchId: DealershipId = '1'): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  const code = BRANCH_REF_CODES[branchId] ?? 'VW';
  return `${code}-${prefix}-${num}`;
}

export function toTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('0') && cleaned.length === 10 && !cleaned.startsWith('0800') && !cleaned.startsWith('086')) {
    return `tel:+27${cleaned.slice(1)}`;
  }
  return `tel:${cleaned}`;
}

export function toIntlPhoneDisplay(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('0') && !trimmed.startsWith('086') && !trimmed.startsWith('0800')) {
    return `+27 ${trimmed.slice(1)}`;
  }
  return trimmed;
}

export function toWhatsAppHref(whatsappNumber: string, branchName: string): string {
  const digits = whatsappNumber.replace(/\D/g, '');
  if (!digits) return '';
  const intl = digits.startsWith('0') ? `27${digits.slice(1)}` : digits;
  const msg = encodeURIComponent(
    `Hello ${branchName}, I would like assistance with a vehicle enquiry.`
  );
  return `https://wa.me/${intl}?text=${msg}`;
}

export function toWhatsAppMessageHref(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return '';
  const intl = digits.startsWith('0') ? `27${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export function toGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function toGoogleMapsEmbedUrl(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}
