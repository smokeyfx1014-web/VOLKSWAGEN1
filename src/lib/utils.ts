import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function generateBookingRef(prefix: string): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `NVW-${prefix}-${num}`;
}
