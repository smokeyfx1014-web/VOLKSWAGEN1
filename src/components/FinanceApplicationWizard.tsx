import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Lock,
  Phone,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import {
  cn,
  formatZAR,
  generateBookingRef,
  toIntlPhoneDisplay,
  toTelHref,
} from '../lib/utils';
import { AppRoute, DealershipId } from '../types/dealership';
import { Button, Input, Label, Select } from './ui/shadcn';

export interface FinanceSimulatorSnapshot {
  selectedVehicleId: string;
  vehicleName: string;
  vehiclePrice: number;
  depositAmount: number;
  depositPercent: number;
  balloonPercent: number;
  interestRate: number;
  termMonths: number;
  monthlyInstalment: number;
  homeDealershipId: DealershipId | null;
}

interface FinanceApplicationWizardProps {
  simulator: FinanceSimulatorSnapshot;
  onSyncFromWizard: (patch: {
    selectedVehicleId?: string;
    vehiclePrice?: number;
    depositAmount?: number;
  }) => void;
  onNavigate?: (route: AppRoute) => void;
  wizardRef?: React.RefObject<HTMLDivElement | null>;
}

type StepNumber = 1 | 2 | 3 | 4;
type YesNo = '' | 'Yes' | 'No';

interface DocAttachment {
  key: 'idBook' | 'driversLicense' | 'bankStatement' | 'payslip' | 'proofOfAddress';
  label: string;
  categoryLabel: string;
  helper: string;
  fileName: string;
  fileSizeKb: number | null;
}

interface FinanceFormState {
  // Step 1: Me
  title: string;
  firstName: string;
  surname: string;
  email: string;
  cell: string;
  idNumber: string;
  passportNumber: string;
  dateOfBirth: string;

  // Step 1: Consent
  consentCreditBureau: boolean;
  consentBankStatements: boolean;
  consentPayslips: boolean;

  // Step 1: Credit score (7 questions)
  underDebtReview: YesNo;
  debtCounsellingArrangement: YesNo;
  everAdministrationOrder: YesNo;
  subjectToAdministrationOrCurator: YesNo;
  judgmentAgainst: YesNo;
  disputeCreditBureau: YesNo;
  underSequestrationOrder: YesNo;

  // Step 1: More about me
  birthCountry: string;
  nationality: string;
  maritalStatus: string;
  maritalType: string;
  dateMarried: string;

  // Step 1: My address
  streetAddress: string;
  addressYears: string;
  addressMonths: string;

  // Step 1: Next of kin
  kinName: string;
  kinSurname: string;
  kinCell: string;
  kinRelation: string;

  // Step 2: Vehicle
  vehicleYear: string;
  articleType: string;
  stockVehicleId: string;
  customMakeModel: string;
  vehiclePrice: string;
  cashDepositAmount: string;
  tradeInDepositAmount: string;

  // Step 2: Current finance to settle
  settlementBank: string;
  settlementAccount: string;
  settlementAmount: string;

  // Step 3: My Employer
  employerName: string;
  salaryDate: string;
  occupation: string;
  employmentType: string;
  employerAddress: string;
  employedYears: string;
  employedMonths: string;

  // Step 3: Income
  grossIncome: string;
  netIncome: string;
  commissionIncome: string;
  carAllowanceIncome: string;
  overtimeIncome: string;
  otherIncome: string;

  // Step 3: Expenses - Loan repayments
  expBond: string;
  expVehicle: string;
  expPersonalLoan: string;
  expCreditCard: string;
  expFurniture: string;
  expClothing: string;
  expOverdraft: string;

  // Step 3: Expenses - Living costs
  expRental: string;
  expUtilities: string;
  expInsurance: string;
  expTelephone: string;
  expTransport: string;
  expFoodEntertainment: string;
  expEducation: string;
  expMaintenance: string;
  expOtherLiving: string;

  // Step 3: My bank
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;

  // Step 4: Consent
  popiaConsent: boolean;
}

const STEP_META: Array<{ step: StepNumber; short: string; title: string }> = [
  { step: 1, short: 'Step 1', title: 'Step 1: Personal details' },
  { step: 2, short: 'Step 2', title: 'Step 2: Vehicle details' },
  { step: 3, short: 'Step 3', title: 'Step 3: Employment & income' },
  { step: 4, short: 'Step 4', title: 'Step 4: Supporting documents' },
];

const CREDIT_QUESTIONS: Array<{
  key: keyof Pick<
    FinanceFormState,
    | 'underDebtReview'
    | 'debtCounsellingArrangement'
    | 'everAdministrationOrder'
    | 'subjectToAdministrationOrCurator'
    | 'judgmentAgainst'
    | 'disputeCreditBureau'
    | 'underSequestrationOrder'
  >;
  prompt: string;
}> = [
  { key: 'underDebtReview', prompt: 'Are you under debt review?' },
  {
    key: 'debtCounsellingArrangement',
    prompt: 'Do you have an arrangement in place with any credit provider as a result of debt counselling?',
  },
  {
    key: 'everAdministrationOrder',
    prompt: 'Have you ever been under an administration order?',
  },
  {
    key: 'subjectToAdministrationOrCurator',
    prompt: 'Are you subject to an administration order or curator bonis?',
  },
  {
    key: 'judgmentAgainst',
    prompt: 'Have you ever had a judgment against you?',
  },
  {
    key: 'disputeCreditBureau',
    prompt: 'Are you in dispute with a credit bureau?',
  },
  {
    key: 'underSequestrationOrder',
    prompt: 'Are you currently under a sequestration order?',
  },
];

const INITIAL_DOCS: DocAttachment[] = [
  {
    key: 'idBook',
    label: 'Proof of Identity',
    categoryLabel: 'ID Book',
    helper: 'South African Smart ID, Green ID Book, or Valid Passport',
    fileName: '',
    fileSizeKb: null,
  },
  {
    key: 'driversLicense',
    label: "Driver's License",
    categoryLabel: 'Drivers License',
    helper: 'Front & back copy of valid South African Driver’s Licence',
    fileName: '',
    fileSizeKb: null,
  },
  {
    key: 'bankStatement',
    label: '3 Months Bank Statements',
    categoryLabel: 'Bank Statement',
    helper: 'Latest 3 consecutive months bank-stamped statements (PDF)',
    fileName: '',
    fileSizeKb: null,
  },
  {
    key: 'payslip',
    label: '3 Months Payslips',
    categoryLabel: 'Payslip',
    helper: 'Latest 3 months official salary advices',
    fileName: '',
    fileSizeKb: null,
  },
  {
    key: 'proofOfAddress',
    label: 'Proof of Address (Not older than 3 months)',
    categoryLabel: 'Proof of Address',
    helper: 'Municipal rates, utility bill, or retail account statement',
    fileName: '',
    fileSizeKb: null,
  },
];

function createInitialFormState(simulator: FinanceSimulatorSnapshot): FinanceFormState {
  const currentYear = String(new Date().getFullYear());
  return {
    title: '',
    firstName: '',
    surname: '',
    email: '',
    cell: '',
    idNumber: '',
    passportNumber: '',
    dateOfBirth: '',

    consentCreditBureau: false,
    consentBankStatements: false,
    consentPayslips: false,

    underDebtReview: '',
    debtCounsellingArrangement: '',
    everAdministrationOrder: '',
    subjectToAdministrationOrCurator: '',
    judgmentAgainst: '',
    disputeCreditBureau: '',
    underSequestrationOrder: '',

    birthCountry: 'South Africa',
    nationality: 'South African',
    maritalStatus: '',
    maritalType: '',
    dateMarried: '',

    streetAddress: '',
    addressYears: '',
    addressMonths: '',

    kinName: '',
    kinSurname: '',
    kinCell: '',
    kinRelation: '',

    vehicleYear: currentYear,
    articleType: '',
    stockVehicleId: simulator.selectedVehicleId || 'custom',
    customMakeModel: simulator.vehicleName || '',
    vehiclePrice: simulator.vehiclePrice ? String(Math.round(simulator.vehiclePrice)) : '',
    cashDepositAmount: simulator.depositAmount ? String(Math.round(simulator.depositAmount)) : '',
    tradeInDepositAmount: '',

    settlementBank: '',
    settlementAccount: '',
    settlementAmount: '',

    employerName: '',
    salaryDate: '',
    occupation: '',
    employmentType: '',
    employerAddress: '',
    employedYears: '',
    employedMonths: '',

    grossIncome: '',
    netIncome: '',
    commissionIncome: '',
    carAllowanceIncome: '',
    overtimeIncome: '',
    otherIncome: '',

    expBond: '',
    expVehicle: '',
    expPersonalLoan: '',
    expCreditCard: '',
    expFurniture: '',
    expClothing: '',
    expOverdraft: '',

    expRental: '',
    expUtilities: '',
    expInsurance: '',
    expTelephone: '',
    expTransport: '',
    expFoodEntertainment: '',
    expEducation: '',
    expMaintenance: '',
    expOtherLiving: '',

    bankName: '',
    bankAccountType: '',
    bankAccountNumber: '',

    popiaConsent: false,
  };
}

function parseNum(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function extractDobFromSaId(id: string): string | null {
  const digits = id.replace(/\D/g, '');
  if (digits.length !== 13) return null;
  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const currentTwoDigitYear = new Date().getFullYear() % 100;
  const century = yy <= currentTwoDigitYear - 16 ? 2000 : 1900;
  const fullYear = century + yy;
  return `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function FinanceApplicationWizard({
  simulator,
  onSyncFromWizard,
  onNavigate,
  wizardRef,
}: FinanceApplicationWizardProps) {
  const { activeDealership, dealershipsById } = useDealership();
  const { activeVehicles, submitLead } = useDealershipData();

  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [completedSteps, setCompletedSteps] = useState<StepNumber[]>([]);
  const [form, setForm] = useState<FinanceFormState>(() => createInitialFormState(simulator));
  const [docs, setDocs] = useState<DocAttachment[]>(INITIAL_DOCS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorSummary, setErrorSummary] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    reference: string;
    applicantName: string;
    vehicleLabel: string;
    estimatedMonthly: number;
    attachedCount: number;
  } | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Sync top calculator changes into Step 2 fields
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      stockVehicleId: simulator.selectedVehicleId || prev.stockVehicleId,
      customMakeModel: simulator.vehicleName || prev.customMakeModel,
      vehiclePrice: simulator.vehiclePrice ? String(Math.round(simulator.vehiclePrice)) : prev.vehiclePrice,
      cashDepositAmount: simulator.depositAmount
        ? String(Math.round(simulator.depositAmount))
        : prev.cashDepositAmount,
    }));
  }, [
    simulator.selectedVehicleId,
    simulator.vehicleName,
    simulator.vehiclePrice,
    simulator.depositAmount,
  ]);

  const setField = <K extends keyof FinanceFormState>(key: K, val: FinanceFormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'idNumber' && typeof val === 'string' && !prev.dateOfBirth) {
        const autoDob = extractDobFromSaId(val);
        if (autoDob) next.dateOfBirth = autoDob;
      }
      return next;
    });
    if (errors[key as string]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key as string];
        return copy;
      });
    }
  };

  // Affordability calculation for Step 3
  const affordability = useMemo(() => {
    const netIncome = parseNum(form.netIncome);
    const otherInc = parseNum(form.otherIncome);
    const totalNet = netIncome + otherInc;

    const totalLoans =
      parseNum(form.expBond) +
      parseNum(form.expVehicle) +
      parseNum(form.expPersonalLoan) +
      parseNum(form.expCreditCard) +
      parseNum(form.expFurniture) +
      parseNum(form.expClothing) +
      parseNum(form.expOverdraft);

    const totalLiving =
      parseNum(form.expRental) +
      parseNum(form.expUtilities) +
      parseNum(form.expInsurance) +
      parseNum(form.expTelephone) +
      parseNum(form.expTransport) +
      parseNum(form.expFoodEntertainment) +
      parseNum(form.expEducation) +
      parseNum(form.expMaintenance) +
      parseNum(form.expOtherLiving);

    const disposable = totalNet - (totalLoans + totalLiving);
    return { totalNet, totalLoans, totalLiving, disposable };
  }, [form]);

  const selectedStockVehicle = useMemo(
    () => activeVehicles.find((v) => v.id === form.stockVehicleId),
    [activeVehicles, form.stockVehicleId]
  );

  const selectedVehicleLabel =
    form.stockVehicleId === 'custom'
      ? form.customMakeModel.trim() || 'Custom Volkswagen Model'
      : selectedStockVehicle?.title || form.customMakeModel || simulator.vehicleName;

  const validateStep = (step: StepNumber): { errs: Record<string, string>; list: string[] } => {
    const errs: Record<string, string> = {};
    const list: string[] = [];

    const req = (field: keyof FinanceFormState, label: string) => {
      const val = String(form[field] ?? '').trim();
      if (!val) {
        errs[field as string] = `${label} is required.`;
        list.push(label);
      }
    };

    if (step === 1) {
      req('title', 'Title');
      req('firstName', 'Name');
      req('surname', 'Surname');
      req('email', 'Email');
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errs.email = 'Please enter a valid email address.';
        list.push('Valid Email address');
      }
      req('cell', 'Cell number');

      const cleanId = form.idNumber.replace(/\s+/g, '');
      const cleanPassport = form.passportNumber.trim();
      if (!cleanId && !cleanPassport) {
        errs.idNumber = 'Provide either your SA ID Number or Passport Number.';
        errs.passportNumber = 'Provide either your SA ID Number or Passport Number.';
        list.push('ID Number or Passport Number');
      } else if (cleanId && !/^\d{13}$/.test(cleanId)) {
        errs.idNumber = 'South African ID numbers must be 13 digits.';
        list.push('Valid 13-digit SA ID Number');
      }

      if (!form.consentCreditBureau || !form.consentBankStatements || !form.consentPayslips) {
        errs.consents = 'All three mandatory credit, bank statement, and payslip consents must be checked.';
        list.push('All 3 mandatory Credit / Bank / Payslip consents');
      }

      const missingCredit = CREDIT_QUESTIONS.some((q) => !form[q.key]);
      if (missingCredit) {
        errs.creditScore = 'Please answer Yes or No to all 7 credit assessment questions.';
        list.push('All 7 Credit score declaration questions');
      }

      req('birthCountry', 'Birth country');
      req('nationality', 'Nationality');
      req('streetAddress', 'Street address');
      req('addressYears', 'Period at address (Years)');
      req('addressMonths', 'Period at address (Months)');
      req('kinName', 'Next of kin Name');
      req('kinSurname', 'Next of kin Surname');
      req('kinCell', 'Next of kin Cell');
      req('kinRelation', 'Next of kin Relation');
    }

    if (step === 2) {
      req('vehicleYear', 'Vehicle Year');
      req('articleType', 'Article Type');
      if (form.stockVehicleId === 'custom' && !form.customMakeModel.trim()) {
        errs.stockVehicleId = 'Please enter or select a Make & Model.';
        list.push('Make & Model');
      } else if (!form.stockVehicleId) {
        errs.stockVehicleId = 'Make & Model is required.';
        list.push('Make & Model');
      }
      if (parseNum(form.vehiclePrice) <= 0) {
        errs.vehiclePrice = 'Please confirm the vehicle price.';
        list.push('Vehicle Price');
      }
    }

    if (step === 3) {
      req('employerName', 'Employer Name');
      req('salaryDate', 'Salary date');
      req('occupation', 'Occupation');
      req('employmentType', 'Employment type');
      req('employerAddress', 'Employer Address');
      req('employedYears', 'Period Employed (Years)');
      req('employedMonths', 'Period Employed (Months)');

      if (parseNum(form.grossIncome) <= 0) {
        errs.grossIncome = 'Gross monthly income is required.';
        list.push('Gross Income');
      }
      if (parseNum(form.netIncome) <= 0) {
        errs.netIncome = 'Net monthly income is required.';
        list.push('Net Income');
      }

      req('bankName', 'Bank name');
      req('bankAccountType', 'Account type');
      req('bankAccountNumber', 'Account number');
    }

    if (step === 4) {
      if (!form.popiaConsent) {
        errs.popiaConsent = 'Consent to process personal information under POPIA is required.';
        list.push('Consent to process personal information');
      }
    }

    return { errs, list };
  };

  const scrollToWizardTop = () => {
    wizardRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNextStep = () => {
    const { errs, list } = validateStep(currentStep);
    if (list.length > 0) {
      setErrors(errs);
      setErrorSummary(list);
      scrollToWizardTop();
      return;
    }
    setErrors({});
    setErrorSummary([]);
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as StepNumber);
      scrollToWizardTop();
    }
  };

  const handlePreviousStep = () => {
    setErrors({});
    setErrorSummary([]);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepNumber);
      scrollToWizardTop();
    }
  };

  const handleStepJump = (targetStep: StepNumber) => {
    if (targetStep === currentStep) return;
    if (targetStep < currentStep || completedSteps.includes(targetStep)) {
      setErrors({});
      setErrorSummary([]);
      setCurrentStep(targetStep);
      scrollToWizardTop();
      return;
    }
    // Validate current step before advancing forward
    const { errs, list } = validateStep(currentStep);
    if (list.length > 0) {
      setErrors(errs);
      setErrorSummary(list);
      scrollToWizardTop();
      return;
    }
    setErrors({});
    setErrorSummary([]);
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));
    setCurrentStep(targetStep);
    scrollToWizardTop();
  };

  const handleFileAttach = (
    docKey: DocAttachment['key'],
    fileList: FileList | null
  ) => {
    const file = fileList?.[0];
    if (!file) return;
    setDocs((prev) =>
      prev.map((d) =>
        d.key === docKey
          ? {
              ...d,
              fileName: file.name,
              fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
            }
          : d
      )
    );
  };

  const handleFileRemove = (docKey: DocAttachment['key']) => {
    setDocs((prev) =>
      prev.map((d) => (d.key === docKey ? { ...d, fileName: '', fileSizeKb: null } : d))
    );
    const el = fileInputRefs.current[docKey];
    if (el) el.value = '';
  };

  const handleResetAll = () => {
    setForm(createInitialFormState(simulator));
    setDocs(INITIAL_DOCS);
    setErrors({});
    setErrorSummary([]);
    setCompletedSteps([]);
    setCurrentStep(1);
    Object.values(fileInputRefs.current).forEach((el) => {
      if (el) el.value = '';
    });
    scrollToWizardTop();
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all steps sequentially
    for (const s of [1, 2, 3, 4] as StepNumber[]) {
      const { errs, list } = validateStep(s);
      if (list.length > 0) {
        setCurrentStep(s);
        setErrors(errs);
        setErrorSummary(list);
        scrollToWizardTop();
        return;
      }
    }

    setSubmitting(true);
    const reference = generateBookingRef('FIN', activeDealership.referenceCode || activeDealership.id);
    const fullApplicantName = `${form.title} ${form.firstName.trim()} ${form.surname.trim()}`.trim();
    const attachedDocs = docs.filter((d) => d.fileName);
    const creditFlags = CREDIT_QUESTIONS.map(
      (q) => `${q.prompt.replace(/\?$/, '')}: ${form[q.key]}`
    ).join(' | ');

    const structuredSummary = [
      `REF: ${reference} | BRANCH: ${activeDealership.name} (FSP ${activeDealership.fspNumber})`,
      `APPLICANT: ${fullApplicantName} | ID: ${form.idNumber || 'N/A'} | Passport: ${form.passportNumber || 'N/A'} | DOB: ${form.dateOfBirth || 'N/A'}`,
      `BIRTH/NATIONALITY: ${form.birthCountry} / ${form.nationality} | Marital: ${form.maritalStatus || 'N/A'} (${form.maritalType || 'N/A'}${form.dateMarried ? `, ${form.dateMarried}` : ''})`,
      `ADDRESS: ${form.streetAddress} (${form.addressYears}y ${form.addressMonths}m)`,
      `NEXT OF KIN: ${form.kinName} ${form.kinSurname} (${form.kinRelation}) · ${form.kinCell}`,
      `CONSENTS: CreditBureau=${form.consentCreditBureau ? 'Yes' : 'No'}, BankStmt=${form.consentBankStatements ? 'Yes' : 'No'}, Payslips=${form.consentPayslips ? 'Yes' : 'No'}, POPIA=${form.popiaConsent ? 'Yes' : 'No'}`,
      `CREDIT CHECKS: ${creditFlags}`,
      `VEHICLE: ${form.vehicleYear} ${selectedVehicleLabel} (${form.articleType}) | Price: ${formatZAR(parseNum(form.vehiclePrice))} | Cash Dep: ${formatZAR(parseNum(form.cashDepositAmount))} | Trade-in Dep: ${formatZAR(parseNum(form.tradeInDepositAmount))}`,
      `SIMULATOR: ${simulator.termMonths}mo @ ${simulator.interestRate.toFixed(2)}% | Balloon ${simulator.balloonPercent}% | Est. ${formatZAR(simulator.monthlyInstalment)}/mo`,
      form.settlementBank
        ? `SETTLEMENT: ${form.settlementBank} Acc #${form.settlementAccount || 'N/A'} (${formatZAR(parseNum(form.settlementAmount))})`
        : `SETTLEMENT: None declared`,
      `EMPLOYER: ${form.employerName} (${form.employmentType}, ${form.occupation}) | Salary Date: ${form.salaryDate} | Tenure: ${form.employedYears}y ${form.employedMonths}m | Addr: ${form.employerAddress}`,
      `INCOME/EXPENSE: Gross ${formatZAR(parseNum(form.grossIncome))} | Net ${formatZAR(affordability.totalNet)} | Debt ${formatZAR(affordability.totalLoans)} | Living ${formatZAR(affordability.totalLiving)} | Disposable ${formatZAR(affordability.disposable)}`,
      `BANKING: ${form.bankName} (${form.bankAccountType}) Acc #${form.bankAccountNumber}`,
      `DOCS READY (${attachedDocs.length}/5): ${
        attachedDocs.length > 0
          ? attachedDocs.map((d) => `${d.categoryLabel}: ${d.fileName}`).join(', ')
          : 'Customer will supply FICA documents during F&I callback'
      }`,
    ].join('\n');

    try {
      await submitLead({
        id: reference,
        leadType: 'finance',
        fullName: fullApplicantName,
        phone: form.cell.trim(),
        email: form.email.trim(),
        subject: `Full 4-Step Finance Application · ${form.vehicleYear} ${selectedVehicleLabel}`,
        details: structuredSummary,
        homeDealershipId: selectedStockVehicle?.homeDealershipId ?? simulator.homeDealershipId ?? activeDealership.id,
      });

      setSubmittedReceipt({
        reference,
        applicantName: fullApplicantName,
        vehicleLabel: `${form.vehicleYear} ${selectedVehicleLabel}`,
        estimatedMonthly: Math.round(simulator.monthlyInstalment),
        attachedCount: attachedDocs.length,
      });
      scrollToWizardTop();
    } finally {
      setSubmitting(false);
    }
  };

  const yearOptions = Array.from({ length: 14 }, (_, idx) => String(new Date().getFullYear() + 1 - idx));
  const yearsTenureOptions = Array.from({ length: 36 }, (_, idx) => String(idx));
  const monthsTenureOptions = Array.from({ length: 12 }, (_, idx) => String(idx));

  if (submittedReceipt) {
    return (
      <div
        id="finance-application-wizard"
        ref={wizardRef}
        className="mt-14 scroll-mt-24 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 sm:p-10"
      >
        <div className="mx-auto max-w-2xl text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#001E50]/10 text-[#001E50]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-xs font-semibold tracking-wider text-[#00437A] uppercase">
            {activeDealership.name} · Finance &amp; Insurance Desk
          </p>
          <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[#091224]">
            Finance Application Logged
          </h3>
          <p className="text-sm text-[#475569] leading-relaxed">
            Thank you, <strong className="text-[#091224]">{submittedReceipt.applicantName}</strong>. Your 4-step FSP/NCA credit application for{' '}
            <strong className="text-[#091224]">{submittedReceipt.vehicleLabel}</strong> has been securely routed to our {activeDealership.name} F&amp;I Manager for assessment and bank submission.
          </p>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 text-left space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
              <span className="text-xs text-[#64748B]">Application Reference</span>
              <span className="font-mono text-sm font-semibold text-[#001E50]">
                {submittedReceipt.reference}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <div>
                <span className="block text-[#64748B]">Vehicle Selected</span>
                <span className="font-semibold text-[#091224]">{submittedReceipt.vehicleLabel}</span>
              </div>
              <div>
                <span className="block text-[#64748B]">Estimated Instalment</span>
                <span className="font-mono font-semibold text-[#001E50] tabular-nums">
                  {formatZAR(submittedReceipt.estimatedMonthly)} /mo
                </span>
              </div>
              <div>
                <span className="block text-[#64748B]">Documents Checklist</span>
                <span className="font-semibold text-[#091224]">
                  {submittedReceipt.attachedCount} of 5 files selected
                </span>
              </div>
            </div>
            <p className="text-xs text-[#475569] pt-2 border-t border-[#E2E8F0]">
              Our F&amp;I specialist will contact you on <strong className="text-[#091224]">{form.cell}</strong> with your confidential encrypted document link and multi-bank outcome, or call us directly on{' '}
              <a
                href={toTelHref(activeDealership.receptionNumber)}
                className="font-mono font-semibold text-[#001E50] hover:underline"
              >
                {toIntlPhoneDisplay(activeDealership.receptionNumber)}
              </a>
              .
            </p>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSubmittedReceipt(null);
                handleResetAll();
              }}
            >
              Start a New Finance Application
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="finance-application-wizard" ref={wizardRef} className="mt-16 scroll-mt-24">
      <div className="border-t border-[#E2E8F0] pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#00437A] uppercase">
              Full Credit &amp; Pre-Qualification Application
            </p>
            <h3 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#091224]">
              Apply for Volkswagen Finance Online
            </h3>
            <p className="mt-1.5 text-sm text-[#475569] max-w-2xl">
              Complete all 4 steps below so our {activeDealership.name} Finance &amp; Insurance team ({activeDealership.legalEntity}, Authorised FSP No. {activeDealership.fspNumber}) can process your credit assessment across major South African banks.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetAll}
            className="text-[#475569]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Form</span>
          </Button>
        </div>

        {/* Horizontal 4-Step Progress Indicator */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEP_META.map((item) => {
            const isActive = currentStep === item.step;
            const isDone = completedSteps.includes(item.step);
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => handleStepJump(item.step)}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer',
                  isActive
                    ? 'border-[#001E50] bg-[#001E50] text-white'
                    : isDone
                    ? 'border-[#CBD5E1] bg-[#F8FAFC] text-[#091224] hover:border-[#001E50]'
                    : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1]'
                )}
              >
                <div className="min-w-0">
                  <span
                    className={cn(
                      'block font-mono text-[11px] font-semibold uppercase tracking-wider',
                      isActive ? 'text-white/80' : 'text-[#00437A]'
                    )}
                  >
                    {item.short}
                  </span>
                  <span className="block truncate text-xs sm:text-sm font-semibold mt-0.5">
                    {item.title.replace(/^Step \d:\s*/, '')}
                  </span>
                </div>
                {isDone && !isActive && (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Validation Error Summary */}
        {errorSummary.length > 0 && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">
                  Please complete the following mandatory information before proceeding:
                </p>
                <ul className="mt-1.5 list-disc pl-5 text-xs space-y-0.5 text-red-800">
                  {errorSummary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitApplication} noValidate className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* MAIN STEP CONTENT COLUMN */}
          <div className="space-y-6 lg:col-span-8">
            {/* ==================== STEP 1: PERSONAL DETAILS ==================== */}
            {currentStep === 1 && (
              <>
                {/* Me */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Me
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-title">Title *</Label>
                      <Select
                        id="fin-title"
                        value={form.title}
                        onChange={(e) => setField('title', e.target.value)}
                        className={errors.title ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="Mr">Mr</option>
                        <option value="Mrs">Mrs</option>
                        <option value="Ms">Ms</option>
                        <option value="Miss">Miss</option>
                        <option value="Dr">Dr</option>
                        <option value="Prof">Prof</option>
                      </Select>
                      {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
                    </div>
                    <div>
                      <Label htmlFor="fin-first-name">Name *</Label>
                      <Input
                        id="fin-first-name"
                        value={form.firstName}
                        onChange={(e) => setField('firstName', e.target.value)}
                        placeholder="First name"
                        className={errors.firstName ? 'border-red-400' : ''}
                      />
                      {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
                    </div>
                    <div>
                      <Label htmlFor="fin-surname">Surname *</Label>
                      <Input
                        id="fin-surname"
                        value={form.surname}
                        onChange={(e) => setField('surname', e.target.value)}
                        placeholder="Last name"
                        className={errors.surname ? 'border-red-400' : ''}
                      />
                      {errors.surname && <p className="mt-1 text-xs text-red-600">{errors.surname}</p>}
                    </div>
                    <div>
                      <Label htmlFor="fin-email">Email *</Label>
                      <Input
                        id="fin-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                        placeholder="name@example.com"
                        className={errors.email ? 'border-red-400' : ''}
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                    </div>
                    <div>
                      <Label htmlFor="fin-cell">Cell *</Label>
                      <Input
                        id="fin-cell"
                        type="tel"
                        value={form.cell}
                        onChange={(e) => setField('cell', e.target.value)}
                        placeholder="e.g. 082 000 0000"
                        className={errors.cell ? 'border-red-400' : ''}
                      />
                      {errors.cell && <p className="mt-1 text-xs text-red-600">{errors.cell}</p>}
                    </div>
                  </div>

                  <p className="text-xs font-medium text-[#00437A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3.5 py-2.5">
                    We kindly request that you provide either your ID or passport number.
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-id">ID number *</Label>
                      <Input
                        id="fin-id"
                        value={form.idNumber}
                        onChange={(e) => setField('idNumber', e.target.value)}
                        placeholder="13-digit South African ID"
                        className={errors.idNumber ? 'border-red-400' : ''}
                      />
                      {errors.idNumber && <p className="mt-1 text-xs text-red-600">{errors.idNumber}</p>}
                    </div>
                    <div>
                      <Label htmlFor="fin-passport">Passport *</Label>
                      <Input
                        id="fin-passport"
                        value={form.passportNumber}
                        onChange={(e) => setField('passportNumber', e.target.value)}
                        placeholder="Passport number (if no SA ID)"
                        className={errors.passportNumber ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-dob">Date of birth</Label>
                      <Input
                        id="fin-dob"
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(e) => setField('dateOfBirth', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Consent */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Consent
                  </h4>
                  {errors.consents && <p className="text-xs font-medium text-red-600">{errors.consents}</p>}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex items-start justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#334155] cursor-pointer hover:border-[#00437A]">
                      <span>
                        I hereby consent to the Credit Provider accessing my credit profile from the credit bureaus for the purposes of a credit assessment and in the event that my loan application is successful, for on-going account maintenance purposes, setting limits, development of credit tools/products/models and insurance purposes. <strong className="text-red-600">*</strong>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.consentCreditBureau}
                        onChange={(e) => setField('consentCreditBureau', e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#CBD5E1] accent-[#001E50]"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#334155] cursor-pointer hover:border-[#00437A]">
                      <span>
                        I give consent to request bank statements in respect of the bank account/s listed on the application form and to process my personal information for the sole purpose of applying for finance. <strong className="text-red-600">*</strong>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.consentBankStatements}
                        onChange={(e) => setField('consentBankStatements', e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#CBD5E1] accent-[#001E50]"
                      />
                    </label>

                    <label className="flex items-start justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs leading-relaxed text-[#334155] cursor-pointer hover:border-[#00437A] md:col-span-2">
                      <span>
                        I give consent to request my payslips in respect of the employment details on the application form and to process my personal information for the sole purpose of applying for finance. <strong className="text-red-600">*</strong>
                      </span>
                      <input
                        type="checkbox"
                        checked={form.consentPayslips}
                        onChange={(e) => setField('consentPayslips', e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#CBD5E1] accent-[#001E50]"
                      />
                    </label>
                  </div>
                </div>

                {/* Credit score */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Credit score
                  </h4>
                  {errors.creditScore && (
                    <p className="text-xs font-medium text-red-600">{errors.creditScore}</p>
                  )}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                    {CREDIT_QUESTIONS.map((q) => (
                      <div
                        key={q.key}
                        className="flex items-center justify-between gap-4 border-b border-[#F1F5F9] pb-3 text-xs text-[#334155]"
                      >
                        <span className="leading-snug">{q.prompt}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="radio"
                              name={`credit-${q.key}`}
                              checked={form[q.key] === 'Yes'}
                              onChange={() => setField(q.key, 'Yes')}
                              className="h-3.5 w-3.5 accent-[#001E50]"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                            <input
                              type="radio"
                              name={`credit-${q.key}`}
                              checked={form[q.key] === 'No'}
                              onChange={() => setField(q.key, 'No')}
                              className="h-3.5 w-3.5 accent-[#001E50]"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* More about me */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    More about me
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-birth-country">Birth country *</Label>
                      <Select
                        id="fin-birth-country"
                        value={form.birthCountry}
                        onChange={(e) => setField('birthCountry', e.target.value)}
                        className={errors.birthCountry ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="South Africa">South Africa</option>
                        <option value="Botswana">Botswana</option>
                        <option value="Eswatini">Eswatini</option>
                        <option value="Lesotho">Lesotho</option>
                        <option value="Mozambique">Mozambique</option>
                        <option value="Namibia">Namibia</option>
                        <option value="Zimbabwe">Zimbabwe</option>
                        <option value="Other">Other</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-nationality">Nationality *</Label>
                      <Select
                        id="fin-nationality"
                        value={form.nationality}
                        onChange={(e) => setField('nationality', e.target.value)}
                        className={errors.nationality ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="South African">South African</option>
                        <option value="Permanent Resident">Permanent Resident (SA)</option>
                        <option value="Foreign National (Work Permit)">Foreign National (Work Permit)</option>
                        <option value="Other">Other</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-marital-status">Marital status</Label>
                      <Select
                        id="fin-marital-status"
                        value={form.maritalStatus}
                        onChange={(e) => setField('maritalStatus', e.target.value)}
                      >
                        <option value="">Select an item</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-marital-type">Marital type</Label>
                      <Select
                        id="fin-marital-type"
                        value={form.maritalType}
                        onChange={(e) => setField('maritalType', e.target.value)}
                      >
                        <option value="">Select an item</option>
                        <option value="In Community of Property">In Community of Property</option>
                        <option value="Out of Community - With Accrual">Out of Community - With Accrual</option>
                        <option value="Out of Community - Without Accrual">Out of Community - Without Accrual</option>
                        <option value="Not Applicable">Not Applicable</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-date-married">Date married</Label>
                      <Input
                        id="fin-date-married"
                        type="date"
                        value={form.dateMarried}
                        onChange={(e) => setField('dateMarried', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* My address */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    My address
                  </h4>
                  <div>
                    <Label htmlFor="fin-street">Street *</Label>
                    <Input
                      id="fin-street"
                      value={form.streetAddress}
                      onChange={(e) => setField('streetAddress', e.target.value)}
                      placeholder="Full residential street address, suburb & city"
                      className={errors.streetAddress ? 'border-red-400' : ''}
                    />
                    {errors.streetAddress && (
                      <p className="mt-1 text-xs text-red-600">{errors.streetAddress}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-addr-years">Period at this address (Years) *</Label>
                      <Select
                        id="fin-addr-years"
                        value={form.addressYears}
                        onChange={(e) => setField('addressYears', e.target.value)}
                        className={errors.addressYears ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        {yearsTenureOptions.map((y) => (
                          <option key={y} value={y}>
                            {y} {y === '1' ? 'Year' : 'Years'}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-addr-months">Period at this address (Months) *</Label>
                      <Select
                        id="fin-addr-months"
                        value={form.addressMonths}
                        onChange={(e) => setField('addressMonths', e.target.value)}
                        className={errors.addressMonths ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        {monthsTenureOptions.map((m) => (
                          <option key={m} value={m}>
                            {m} {m === '1' ? 'Month' : 'Months'}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Next of kin */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Next of kin
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-kin-name">Name *</Label>
                      <Input
                        id="fin-kin-name"
                        value={form.kinName}
                        onChange={(e) => setField('kinName', e.target.value)}
                        placeholder="Next of kin first name"
                        className={errors.kinName ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-kin-surname">Surname *</Label>
                      <Input
                        id="fin-kin-surname"
                        value={form.kinSurname}
                        onChange={(e) => setField('kinSurname', e.target.value)}
                        placeholder="Next of kin surname"
                        className={errors.kinSurname ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-kin-cell">Cell *</Label>
                      <Input
                        id="fin-kin-cell"
                        type="tel"
                        value={form.kinCell}
                        onChange={(e) => setField('kinCell', e.target.value)}
                        placeholder="Next of kin mobile number"
                        className={errors.kinCell ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-kin-relation">Relation *</Label>
                      <Select
                        id="fin-kin-relation"
                        value={form.kinRelation}
                        onChange={(e) => setField('kinRelation', e.target.value)}
                        className={errors.kinRelation ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Parent">Parent</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Child">Child</option>
                        <option value="Relative">Other Relative</option>
                        <option value="Friend">Friend</option>
                        <option value="Colleague">Colleague</option>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== STEP 2: VEHICLE DETAILS ==================== */}
            {currentStep === 2 && (
              <>
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Vehicle
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-veh-year">Year *</Label>
                      <Select
                        id="fin-veh-year"
                        value={form.vehicleYear}
                        onChange={(e) => setField('vehicleYear', e.target.value)}
                        className={errors.vehicleYear ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-article-type">Article Type *</Label>
                      <Select
                        id="fin-article-type"
                        value={form.articleType}
                        onChange={(e) => setField('articleType', e.target.value)}
                        className={errors.articleType ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="New Volkswagen">New Volkswagen</option>
                        <option value="MasterCars Certified">MasterCars Certified Pre-Owned</option>
                        <option value="Demo Vehicle">Demo Vehicle</option>
                        <option value="Pre-Owned">Pre-Owned</option>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="fin-make-model">Make &amp; Model *</Label>
                      <Select
                        id="fin-make-model"
                        value={form.stockVehicleId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setField('stockVehicleId', id);
                          if (id === 'custom') return;
                          const matched = activeVehicles.find((v) => v.id === id);
                          if (matched) {
                            setField('customMakeModel', matched.title);
                            setField('vehiclePrice', String(matched.price));
                            setField('vehicleYear', String(matched.year));
                            setField(
                              'articleType',
                              matched.category === 'New'
                                ? 'New Volkswagen'
                                : matched.category === 'MasterCars'
                                ? 'MasterCars Certified'
                                : 'Pre-Owned'
                            );
                            onSyncFromWizard({
                              selectedVehicleId: matched.id,
                              vehiclePrice: matched.price,
                            });
                          }
                        }}
                        className={errors.stockVehicleId ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        {activeVehicles.map((v) => {
                          const branch = dealershipsById[v.homeDealershipId];
                          return (
                            <option key={v.id} value={v.id}>
                              {v.year} {v.title} · {formatZAR(v.price)} ({branch?.shortName})
                            </option>
                          );
                        })}
                        <option value="custom">Other / Custom Vehicle Not Listed Above</option>
                      </Select>
                      {form.stockVehicleId === 'custom' && (
                        <Input
                          className="mt-2.5"
                          value={form.customMakeModel}
                          onChange={(e) => setField('customMakeModel', e.target.value)}
                          placeholder="e.g. Volkswagen Polo Vivo 1.4 Trendline"
                        />
                      )}
                    </div>
                    <div>
                      <Label htmlFor="fin-veh-price">Price</Label>
                      <Input
                        id="fin-veh-price"
                        type="number"
                        value={form.vehiclePrice}
                        onChange={(e) => {
                          setField('vehiclePrice', e.target.value);
                          const numeric = parseNum(e.target.value);
                          if (numeric > 0) {
                            onSyncFromWizard({ vehiclePrice: numeric });
                          }
                        }}
                        placeholder="e.g. R 200 000"
                        className={errors.vehiclePrice ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-cash-deposit">Cash Deposit Amount</Label>
                      <Input
                        id="fin-cash-deposit"
                        type="number"
                        value={form.cashDepositAmount}
                        onChange={(e) => {
                          setField('cashDepositAmount', e.target.value);
                          onSyncFromWizard({ depositAmount: parseNum(e.target.value) });
                        }}
                        placeholder="e.g. 25000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-trade-deposit">Trade in Deposit Amount</Label>
                      <Input
                        id="fin-trade-deposit"
                        type="number"
                        value={form.tradeInDepositAmount}
                        onChange={(e) => setField('tradeInDepositAmount', e.target.value)}
                        placeholder="Estimated trade-in equity (optional)"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <div className="border-b border-[#E2E8F0] pb-3">
                    <h4 className="font-display text-lg font-semibold text-[#001E50]">
                      Current finance to settle
                    </h4>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Leave blank if you are not trading in a currently financed vehicle.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-settle-bank">Bank</Label>
                      <Select
                        id="fin-settle-bank"
                        value={form.settlementBank}
                        onChange={(e) => setField('settlementBank', e.target.value)}
                      >
                        <option value="">Select an item</option>
                        <option value="None / Paid Off">None / Paid Off</option>
                        <option value="Volkswagen Financial Services">Volkswagen Financial Services</option>
                        <option value="WesBank">WesBank</option>
                        <option value="MFC (Nedbank)">MFC (Nedbank)</option>
                        <option value="Absa Vehicle & Asset Finance">Absa Vehicle &amp; Asset Finance</option>
                        <option value="Standard Bank Vehicle & Asset Finance">Standard Bank Vehicle &amp; Asset Finance</option>
                        <option value="FNB Vehicle Finance">FNB Vehicle Finance</option>
                        <option value="Other">Other</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-settle-acc">Account #</Label>
                      <Input
                        id="fin-settle-acc"
                        value={form.settlementAccount}
                        onChange={(e) => setField('settlementAccount', e.target.value)}
                        placeholder="Existing finance account number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-settle-amt">Settlement Amount</Label>
                      <Input
                        id="fin-settle-amt"
                        type="number"
                        value={form.settlementAmount}
                        onChange={(e) => setField('settlementAmount', e.target.value)}
                        placeholder="Approximate settlement in ZAR"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== STEP 3: EMPLOYMENT & INCOME ==================== */}
            {currentStep === 3 && (
              <>
                {/* My Employer */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    My Employer
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-emp-name">Name *</Label>
                      <Input
                        id="fin-emp-name"
                        value={form.employerName}
                        onChange={(e) => setField('employerName', e.target.value)}
                        placeholder="Company / Employer name"
                        className={errors.employerName ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-salary-date">Salary date *</Label>
                      <Select
                        id="fin-salary-date"
                        value={form.salaryDate}
                        onChange={(e) => setField('salaryDate', e.target.value)}
                        className={errors.salaryDate ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="1st of the month">1st of the month</option>
                        <option value="15th of the month">15th of the month</option>
                        <option value="25th of the month">25th of the month</option>
                        <option value="28th of the month">28th of the month</option>
                        <option value="Last day of the month">Last day of the month</option>
                        <option value="Bi-weekly / Weekly">Bi-weekly / Weekly</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-occupation">Occupation *</Label>
                      <Select
                        id="fin-occupation"
                        value={form.occupation}
                        onChange={(e) => setField('occupation', e.target.value)}
                        className={errors.occupation ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="Management / Executive">Management / Executive</option>
                        <option value="Engineering / Technical">Engineering / Technical</option>
                        <option value="Finance / Accounting">Finance / Accounting</option>
                        <option value="Medical / Healthcare">Medical / Healthcare</option>
                        <option value="Education / Public Service">Education / Public Service</option>
                        <option value="Mining / Manufacturing">Mining / Manufacturing</option>
                        <option value="Agriculture / Agri-Business">Agriculture / Agri-Business</option>
                        <option value="Sales / Marketing">Sales / Marketing</option>
                        <option value="Administration / Clerical">Administration / Clerical</option>
                        <option value="Business Owner / Director">Business Owner / Director</option>
                        <option value="Other">Other</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-emp-type">Employment type *</Label>
                      <Select
                        id="fin-emp-type"
                        value={form.employmentType}
                        onChange={(e) => setField('employmentType', e.target.value)}
                        className={errors.employmentType ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="Permanent Full-Time">Permanent Full-Time</option>
                        <option value="Self-Employed">Self-Employed / Sole Proprietor</option>
                        <option value="Contract">Fixed-Term Contract</option>
                        <option value="Commission Earner">Commission Earner</option>
                        <option value="Pensioner">Pensioner / Retired</option>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="fin-emp-addr">Address *</Label>
                      <Input
                        id="fin-emp-addr"
                        value={form.employerAddress}
                        onChange={(e) => setField('employerAddress', e.target.value)}
                        placeholder="Employer physical business address"
                        className={errors.employerAddress ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-emp-years">Period Employed (Years) *</Label>
                      <Select
                        id="fin-emp-years"
                        value={form.employedYears}
                        onChange={(e) => setField('employedYears', e.target.value)}
                        className={errors.employedYears ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        {yearsTenureOptions.map((y) => (
                          <option key={y} value={y}>
                            {y} {y === '1' ? 'Year' : 'Years'}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-emp-months">Period Employed (Months) *</Label>
                      <Select
                        id="fin-emp-months"
                        value={form.employedMonths}
                        onChange={(e) => setField('employedMonths', e.target.value)}
                        className={errors.employedMonths ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        {monthsTenureOptions.map((m) => (
                          <option key={m} value={m}>
                            {m} {m === '1' ? 'Month' : 'Months'}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Income */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Income
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-gross">Gross Income *</Label>
                      <Input
                        id="fin-gross"
                        type="number"
                        value={form.grossIncome}
                        onChange={(e) => setField('grossIncome', e.target.value)}
                        placeholder="Monthly gross (R)"
                        className={errors.grossIncome ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-net">Net Income *</Label>
                      <Input
                        id="fin-net"
                        type="number"
                        value={form.netIncome}
                        onChange={(e) => setField('netIncome', e.target.value)}
                        placeholder="Monthly nett take-home (R)"
                        className={errors.netIncome ? 'border-red-400' : ''}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-commission">Commission (Included in Gross)</Label>
                      <Input
                        id="fin-commission"
                        type="number"
                        value={form.commissionIncome}
                        onChange={(e) => setField('commissionIncome', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-car-allow">Car allowance (Included in Gross)</Label>
                      <Input
                        id="fin-car-allow"
                        type="number"
                        value={form.carAllowanceIncome}
                        onChange={(e) => setField('carAllowanceIncome', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-overtime">Overtime (Included in Gross)</Label>
                      <Input
                        id="fin-overtime"
                        type="number"
                        value={form.overtimeIncome}
                        onChange={(e) => setField('overtimeIncome', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-other-inc">Other income</Label>
                      <Input
                        id="fin-other-inc"
                        type="number"
                        value={form.otherIncome}
                        onChange={(e) => setField('otherIncome', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Expenses: Loan repayments */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Expenses: Loan repayments
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-exp-bond">Bond</Label>
                      <Input
                        id="fin-exp-bond"
                        type="number"
                        value={form.expBond}
                        onChange={(e) => setField('expBond', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-veh">Vehicle</Label>
                      <Input
                        id="fin-exp-veh"
                        type="number"
                        value={form.expVehicle}
                        onChange={(e) => setField('expVehicle', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-personal">Personal loan</Label>
                      <Input
                        id="fin-exp-personal"
                        type="number"
                        value={form.expPersonalLoan}
                        onChange={(e) => setField('expPersonalLoan', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-cc">Credit card</Label>
                      <Input
                        id="fin-exp-cc"
                        type="number"
                        value={form.expCreditCard}
                        onChange={(e) => setField('expCreditCard', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-furn">Furniture</Label>
                      <Input
                        id="fin-exp-furn"
                        type="number"
                        value={form.expFurniture}
                        onChange={(e) => setField('expFurniture', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-cloth">Clothing</Label>
                      <Input
                        id="fin-exp-cloth"
                        type="number"
                        value={form.expClothing}
                        onChange={(e) => setField('expClothing', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-overdraft">Overdraft</Label>
                      <Input
                        id="fin-exp-overdraft"
                        type="number"
                        value={form.expOverdraft}
                        onChange={(e) => setField('expOverdraft', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Expenses: Living costs */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    Expenses: Living costs
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-exp-rent">Rental</Label>
                      <Input
                        id="fin-exp-rent"
                        type="number"
                        value={form.expRental}
                        onChange={(e) => setField('expRental', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-util">Rates, water &amp; electricity</Label>
                      <Input
                        id="fin-exp-util"
                        type="number"
                        value={form.expUtilities}
                        onChange={(e) => setField('expUtilities', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-ins">Insurance &amp; policies</Label>
                      <Input
                        id="fin-exp-ins"
                        type="number"
                        value={form.expInsurance}
                        onChange={(e) => setField('expInsurance', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-tel">Telephone</Label>
                      <Input
                        id="fin-exp-tel"
                        type="number"
                        value={form.expTelephone}
                        onChange={(e) => setField('expTelephone', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-trans">Transport</Label>
                      <Input
                        id="fin-exp-trans"
                        type="number"
                        value={form.expTransport}
                        onChange={(e) => setField('expTransport', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-food">Food &amp; entertainment</Label>
                      <Input
                        id="fin-exp-food"
                        type="number"
                        value={form.expFoodEntertainment}
                        onChange={(e) => setField('expFoodEntertainment', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-edu">Education</Label>
                      <Input
                        id="fin-exp-edu"
                        type="number"
                        value={form.expEducation}
                        onChange={(e) => setField('expEducation', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-maint">Maintenance</Label>
                      <Input
                        id="fin-exp-maint"
                        type="number"
                        value={form.expMaintenance}
                        onChange={(e) => setField('expMaintenance', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-exp-other">Other</Label>
                      <Input
                        id="fin-exp-other"
                        type="number"
                        value={form.expOtherLiving}
                        onChange={(e) => setField('expOtherLiving', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Live Affordability Snapshot */}
                  <div className="mt-4 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#00437A] mb-3">
                      Monthly NCA Affordability Snapshot
                    </p>
                    <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-[#64748B]">Total Net Income</dt>
                        <dd className="mt-0.5 font-mono text-sm font-semibold text-[#091224] tabular-nums">
                          {formatZAR(affordability.totalNet)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#64748B]">Debt + Living</dt>
                        <dd className="mt-0.5 font-mono text-sm font-semibold text-[#091224] tabular-nums">
                          {formatZAR(affordability.totalLoans + affordability.totalLiving)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#64748B]">Est. Instalment</dt>
                        <dd className="mt-0.5 font-mono text-sm font-semibold text-[#00437A] tabular-nums">
                          {formatZAR(simulator.monthlyInstalment)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#64748B]">Disposable Surplus</dt>
                        <dd
                          className={cn(
                            'mt-0.5 font-mono text-sm font-semibold tabular-nums',
                            affordability.disposable >= simulator.monthlyInstalment
                              ? 'text-emerald-700'
                              : 'text-[#091224]'
                          )}
                        >
                          {formatZAR(affordability.disposable)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* My bank */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                  <h4 className="font-display text-lg font-semibold text-[#001E50] border-b border-[#E2E8F0] pb-3">
                    My bank
                  </h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="fin-bank-name">Bank name *</Label>
                      <Select
                        id="fin-bank-name"
                        value={form.bankName}
                        onChange={(e) => setField('bankName', e.target.value)}
                        className={errors.bankName ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="ABSA">ABSA</option>
                        <option value="FNB">FNB</option>
                        <option value="Standard Bank">Standard Bank</option>
                        <option value="Nedbank">Nedbank</option>
                        <option value="Capitec">Capitec Bank</option>
                        <option value="Investec">Investec</option>
                        <option value="TymeBank">TymeBank</option>
                        <option value="Discovery Bank">Discovery Bank</option>
                        <option value="African Bank">African Bank</option>
                        <option value="Other">Other</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-acc-type">Account type *</Label>
                      <Select
                        id="fin-acc-type"
                        value={form.bankAccountType}
                        onChange={(e) => setField('bankAccountType', e.target.value)}
                        className={errors.bankAccountType ? 'border-red-400' : ''}
                      >
                        <option value="">Select an item</option>
                        <option value="Cheque / Current">Cheque / Current</option>
                        <option value="Savings">Savings</option>
                        <option value="Transmission">Transmission</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="fin-acc-num">Account number *</Label>
                      <Input
                        id="fin-acc-num"
                        value={form.bankAccountNumber}
                        onChange={(e) => setField('bankAccountNumber', e.target.value)}
                        placeholder="Primary salary bank account number"
                        className={errors.bankAccountNumber ? 'border-red-400' : ''}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== STEP 4: SUPPORTING DOCUMENTS ==================== */}
            {currentStep === 4 && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-6">
                <div className="border-b border-[#E2E8F0] pb-3">
                  <h4 className="font-display text-lg font-semibold text-[#001E50]">
                    File uploads
                  </h4>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Attach supporting FICA documents now if available, or upload them later via your {activeDealership.name} F&amp;I Manager&apos;s secure encrypted portal link.
                  </p>
                </div>

                <div className="divide-y divide-[#E2E8F0]">
                  {docs.map((item) => (
                    <div
                      key={item.key}
                      className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 sm:w-64">
                        <p className="text-sm font-semibold text-[#091224]">{item.label}</p>
                        <p className="text-xs text-[#64748B]">{item.helper}</p>
                      </div>

                      <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:justify-end">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[item.key] = el;
                          }}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          id={`doc-upload-${item.key}`}
                          onChange={(e) => handleFileAttach(item.key, e.target.files)}
                        />
                        {item.fileName ? (
                          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                            <FileCheck2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            <span className="max-w-[180px] truncate font-medium">
                              {item.fileName}
                            </span>
                            {item.fileSizeKb && (
                              <span className="font-mono text-[11px] text-emerald-700">
                                ({item.fileSizeKb} KB)
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleFileRemove(item.key)}
                              aria-label={`Remove ${item.label}`}
                              className="ml-1 text-emerald-700 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label
                            htmlFor={`doc-upload-${item.key}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-xs font-medium text-[#091224] hover:border-[#001E50] hover:bg-white transition-colors cursor-pointer"
                          >
                            <Upload className="h-3.5 w-3.5 text-[#00437A]" />
                            <span>Choose File</span>
                          </label>
                        )}

                        <span className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-[11px] font-medium text-[#001E50]">
                          {item.categoryLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Privacy Note on File Handling */}
                <div className="flex items-start gap-2.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3.5 text-xs text-[#334155]">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#00437A]" />
                  <span>
                    For your protection, uploaded document metadata is attached to your F&amp;I checklist without storing unencrypted personal scans in public web storage. Our {activeDealership.name} Finance Manager verifies and collects encrypted copies directly on confirmation.
                  </span>
                </div>

                {/* Final POPIA Consent */}
                <div className="space-y-3 border-t border-[#E2E8F0] pt-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.popiaConsent}
                      onChange={(e) => setField('popiaConsent', e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#CBD5E1] accent-[#001E50]"
                    />
                    <div className="text-xs leading-relaxed text-[#334155]">
                      <span className="font-semibold text-[#091224]">
                        Consent to process my information <strong className="text-red-600">*</strong>
                      </span>
                      <p className="mt-1">
                        We need to process your info to contact and assist you. This might entail additional processing to find you alternate solutions. You can view your info and withdraw consent at any time by going to{' '}
                        <button
                          type="button"
                          onClick={() => onNavigate?.('/privacy-policy')}
                          className="font-semibold text-[#00437A] underline hover:text-[#001E50] cursor-pointer"
                        >
                          {activeDealership.domain}/privacy-policy
                        </button>
                        .
                      </p>
                    </div>
                  </label>
                  {errors.popiaConsent && (
                    <p className="text-xs font-medium text-red-600">{errors.popiaConsent}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#CFE0F5] bg-[#EFF6FF] px-4 py-3 text-xs text-[#001E50]">
                    <span className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4 text-[#00437A]" />
                      Protected from spam by Docrat group Information Technology
                    </span>
                    <span className="text-[#475569]">Verification &amp; POPIA compliant</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2.5">
                {currentStep > 1 && (
                  <Button type="button" variant="outline" onClick={handlePreviousStep}>
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous Tab</span>
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={handleResetAll}>
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset</span>
                </Button>
              </div>

              <div>
                {currentStep < 4 ? (
                  <Button type="button" size="lg" onClick={handleNextStep}>
                    <span>Next Tab</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit" size="lg" disabled={submitting}>
                    <span>{submitting ? 'Submitting Application...' : 'Submit Finance Application'}</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR (NON-STICKY ON MOBILE, STICKY DESKTOP lg:sticky) */}
          <aside className="lg:col-span-4">
            <div className="space-y-5 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-5">
                <div>
                  <h4 className="font-display text-lg font-semibold text-[#001E50]">
                    Finance made simple
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                    Complete the steps and our {activeDealership.name} finance team will review your details and contact you.
                  </p>
                </div>

                <div className="space-y-2">
                  {STEP_META.map((item) => {
                    const isActive = currentStep === item.step;
                    const isDone = completedSteps.includes(item.step);
                    return (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => handleStepJump(item.step)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-xs font-semibold transition-colors cursor-pointer',
                          isActive
                            ? 'border-[#001E50] bg-white text-[#001E50] shadow-xs'
                            : isDone
                            ? 'border-[#CBD5E1] bg-white text-[#091224] hover:border-[#00437A]'
                            : 'border-[#E2E8F0] bg-white/70 text-[#475569] hover:bg-white'
                        )}
                      >
                        <span>{item.title}</span>
                        {isDone ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-[#E2E8F0] pt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Vehicle Selected</span>
                    <span className="font-semibold text-[#091224] text-right truncate max-w-[175px]">
                      {selectedVehicleLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Est. Monthly</span>
                    <span className="font-mono text-sm font-semibold text-[#001E50] tabular-nums">
                      {formatZAR(simulator.monthlyInstalment)} /mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Term / Rate / Balloon</span>
                    <span className="font-mono font-medium text-[#334155] tabular-nums">
                      {simulator.termMonths}mo · {simulator.interestRate.toFixed(2)}% · {simulator.balloonPercent}%
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#E2E8F0] pt-4 space-y-2 text-xs">
                  <p className="font-semibold text-[#091224]">
                    {activeDealership.legalEntity}
                  </p>
                  <p className="text-[#475569]">
                    Authorised Financial Services Provider · FSP No. {activeDealership.fspNumber}
                  </p>
                  <a
                    href={toTelHref(activeDealership.receptionNumber)}
                    className="inline-flex items-center gap-1.5 font-mono font-semibold text-[#001E50] hover:underline pt-1"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{toIntlPhoneDisplay(activeDealership.receptionNumber)}</span>
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
