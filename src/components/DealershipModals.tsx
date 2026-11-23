import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import {
  GROUP_CORPORATE_INFO,
  SATURDAY_TEST_DRIVE_SLOTS,
  WEEKDAY_TEST_DRIVE_SLOTS,
} from '../data/dealership';
import { cn, formatZAR, generateBookingRef } from '../lib/utils';
import { LeadSubmissionType, ModalContextState } from '../types/dealership';
import { DealershipImage } from './DealershipImage';
import { Button, Dialog, Input, Label, Select, Textarea } from './ui/shadcn';

interface DealershipModalsProps {
  modal: ModalContextState;
  onClose: () => void;
}

type FieldErrorMap = Partial<
  Record<
    | 'fullName'
    | 'phone'
    | 'email'
    | 'vehicleYear'
    | 'vehicleModel'
    | 'vehicleReg'
    | 'vinNumber'
    | 'mileageKm'
    | 'preferredDate'
    | 'preferredTime'
    | 'notes',
    string
  >
>;

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextBusinessDayISO(): string {
  const date = new Date();
  if (date.getDay() === 0) {
    date.setDate(date.getDate() + 1);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayOfWeek(dateISO: string): number | null {
  if (!dateISO) return null;
  const parsed = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay();
}

const ERROR_INPUT_CLASS =
  'border-red-500 bg-red-50/40 focus-visible:border-red-600 focus-visible:ring-red-500/20';

export function DealershipModals({ modal, onClose }: DealershipModalsProps) {
  const { activeDealership, dealershipsById } = useDealership();
  const { activeVehicles, submitLead } = useDealershipData();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    activeVehicles[0]?.title ?? '2026 Volkswagen Polo Vivo 1.4 Life'
  );
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [serviceType, setServiceType] = useState('Minor Scheduled Service');
  const [preferredDate, setPreferredDate] = useState(getNextBusinessDayISO);
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vinNumber, setVinNumber] = useState('');
  const [mileageKm, setMileageKm] = useState('');
  const [notes, setNotes] = useState('');
  const [errorSummary, setErrorSummary] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const todayISO = useMemo(() => getTodayISO(), []);
  const selectedDay = useMemo(() => getDayOfWeek(preferredDate), [preferredDate]);
  const isSunday = selectedDay === 0;
  const isSaturday = selectedDay === 6;

  const availableTimeSlots = useMemo(() => {
    if (isSunday) return [];
    if (isSaturday) return SATURDAY_TEST_DRIVE_SLOTS;
    return WEEKDAY_TEST_DRIVE_SLOTS;
  }, [isSunday, isSaturday]);

  useEffect(() => {
    setErrorSummary('');
    setFieldErrors({});
    setSubmittedRef(null);
    setServiceType('Minor Scheduled Service');
    setPreferredDate(getNextBusinessDayISO());
    setPreferredTime('09:00');
    setVehicleYear('');
    setVehicleModel('');
    setVehicleReg('');
    setVinNumber('');
    setMileageKm('');
    setNotes(
      modal.dealSummary
        ? `Enquiring on special: ${modal.dealSummary}`
        : modal.eventTitle
        ? `RSVP for event: ${modal.eventTitle}`
        : modal.competitionTitle
        ? `Competition entry: ${modal.competitionTitle}`
        : ''
    );
    if (modal.vehicleName) {
      setSelectedModel(modal.vehicleName);
    } else if (activeVehicles[0]?.title) {
      setSelectedModel(activeVehicles[0].title);
    }
  }, [
    modal.type,
    modal.vehicleName,
    modal.dealSummary,
    modal.eventTitle,
    modal.competitionTitle,
    activeVehicles,
  ]);

  useEffect(() => {
    if (availableTimeSlots.length > 0 && !availableTimeSlots.includes(preferredTime)) {
      setPreferredTime(availableTimeSlots[0]);
    }
  }, [availableTimeSlots, preferredTime]);

  if (!modal.type) return null;

  if (modal.type === 'news-reader') {
    const article = modal.article;
    if (!article) return null;
    return (
      <Dialog
        open
        onClose={onClose}
        title={article.title}
        subtitle={`${article.category} · ${article.publishedDate} · ${article.readTime}`}
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
            <DealershipImage asset={article.asset} alt={article.title} zoomOnHover={false} />
          </div>
          <div className="space-y-4 text-sm sm:text-base leading-relaxed text-[#334155]">
            {article.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="flex justify-end border-t border-[#E2E8F0] pt-4">
            <Button onClick={onClose}>Close Article</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  if (modal.type === 'legal') {
    const legalContent: Record<
      NonNullable<ModalContextState['legalDoc']>,
      { title: string; subtitle: string; paragraphs: string[] }
    > = {
      popia: {
        title: 'POPIA Privacy Notice',
        subtitle: 'Protection of Personal Information Act (Act 4 of 2013)',
        paragraphs: [
          `${activeDealership.legalEntity} t/a ${activeDealership.name} collects and processes personal contact information strictly for responding to vehicle enquiries, test drive bookings, finance pre-qualification, workshop scheduling, and genuine parts orders.`,
          `Lead records for non-purchase enquiries are retained for up to 365 days unless you request earlier deletion. Direct POPIA access, correction, or deletion requests to Compliance Officer ${GROUP_CORPORATE_INFO.complianceOfficer} at ${GROUP_CORPORATE_INFO.complianceEmail} or ${activeDealership.receptionNumber}.`,
        ],
      },
      paia: {
        title: 'PAIA Section 51 Manual',
        subtitle: 'Promotion of Access to Information Act',
        paragraphs: [
          `In accordance with the Promotion of Access to Information Act (Act 2 of 2000), ${activeDealership.legalEntity} t/a ${activeDealership.name} (Part of ${GROUP_CORPORATE_INFO.groupName}) maintains a statutory manual detailing record categories held across Sales, Finance & Insurance, Workshop Administration, and Human Resources.`,
          `Formal information requests may be directed to Information Officer ${GROUP_CORPORATE_INFO.complianceOfficer} (${GROUP_CORPORATE_INFO.complianceEmail}) at ${activeDealership.postalAddress || activeDealership.physicalAddress}.`,
        ],
      },
      mastercars: {
        title: 'MasterCars Promise & Terms',
        subtitle: 'Certified Pre-Owned Standard',
        paragraphs: [
          `Every certified MasterCar sold by ${activeDealership.name} (and our sister Asaf Auto Sales branches in Newcastle, Ermelo, and Vryheid) is under 5 years old with fewer than 120,000 km and completes a documented 80-point technical inspection.`,
          `Qualifying vehicles carry a 7-day / 1,000 km exchange guarantee, 12-month certification, and 24/7 VW Alert roadside assistance (${activeDealership.roadsideAssist}).`,
        ],
      },
      terms: {
        title: 'Website & Pricing Terms',
        subtitle: `${activeDealership.legalEntity} · Authorised FSP No. ${activeDealership.fspNumber}`,
        paragraphs: [
          'All retail prices displayed on this site are recommended retail prices in South African Rand (ZAR) inclusive of VAT unless stated otherwise, E&OE. On-the-road, licensing, and registration fees are excluded.',
          `Finance estimates are non-binding simulations subject to formal credit assessment and bank approval through Volkswagen Financial Services South Africa (${activeDealership.legalEntity} · Authorised FSP No. ${activeDealership.fspNumber}).`,
        ],
      },
    };
    const doc = legalContent[modal.legalDoc ?? 'popia'];
    return (
      <Dialog open onClose={onClose} title={doc.title} subtitle={doc.subtitle}>
        <div className="space-y-4 text-sm leading-relaxed text-[#475569]">
          {doc.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="pt-4 flex justify-end border-t border-[#E2E8F0]">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  const metaByType: Record<
    Exclude<ModalContextState['type'], null | 'news-reader' | 'legal'>,
    { title: string; subtitle: string; prefix: string; ctaLabel: string }
  > = {
    'test-drive': {
      title: `Book a Test Drive — ${activeDealership.shortName}`,
      subtitle: `${GROUP_CORPORATE_INFO.testDriveHoursSummary} (${activeDealership.physicalAddress}).`,
      prefix: 'TD',
      ctaLabel: 'Request Test Drive Slot',
    },
    finance: {
      title: 'Apply for Vehicle Finance',
      subtitle: `Our ${activeDealership.shortName} F&I specialist (FSP ${activeDealership.fspNumber}) will prepare your tailored bank offer.`,
      prefix: 'FIN',
      ctaLabel: 'Submit Finance Request',
    },
    service: {
      title: 'Book Approved VAG Workshop Service',
      subtitle: `${activeDealership.serviceHours}. Mandatory VIN required for VW, Audi, Porsche & VAG service verification.`,
      prefix: 'SRV',
      ctaLabel: 'Request Service Booking',
    },
    parts: {
      title: 'Request Genuine VAG Group Parts',
      subtitle: `We supply OEM parts for VW, Audi, Porsche & VAG models. Identify via VIN or Year & Model for our ${activeDealership.shortName} Parts Desk.`,
      prefix: 'PRT',
      ctaLabel: 'Submit Parts Request',
    },
    'vehicle-inquiry': {
      title: 'Vehicle Enquiry & Valuation',
      subtitle: `Receive a specification sheet, branch transfer options, or trade-in offer via ${activeDealership.name}.`,
      prefix: 'VEH',
      ctaLabel: 'Request Vehicle Quote',
    },
    'event-rsvp': {
      title: 'Dealership Event RSVP',
      subtitle: modal.eventTitle || `Reserve your attendance spot at ${activeDealership.name}.`,
      prefix: 'EVT',
      ctaLabel: 'Confirm Event RSVP',
    },
    'competition-entry': {
      title: 'Enter Dealership Competition',
      subtitle:
        modal.competitionTitle ||
        `Submit your entry with ${activeDealership.name} (Asaf Auto Sales Group).`,
      prefix: 'CMP',
      ctaLabel: 'Submit Competition Entry',
    },
    contact: {
      title: `Contact ${activeDealership.name}`,
      subtitle: `Connect directly with our ${activeDealership.city} dealership floor team.`,
      prefix: 'ENQ',
      ctaLabel: 'Send Message',
    },
  };

  const activeMeta = metaByType[modal.type];
  const matchedVehicle = activeVehicles.find((v) => v.title === selectedModel);
  const effectiveHomeBranchId =
    modal.homeDealershipId ?? matchedVehicle?.homeDealershipId ?? activeDealership.id;

  const clearFieldError = (field: keyof FieldErrorMap) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (errorSummary) {
      setErrorSummary('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrorMap = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phone.trim()) {
      errors.phone = 'Mobile number is required for callback confirmation.';
    } else if (phoneDigits.length < 9) {
      errors.phone = 'Enter a valid South African contact number (at least 9 digits).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (modal.type === 'test-drive') {
      if (!preferredDate) {
        errors.preferredDate = 'Select a preferred date (Monday to Saturday).';
      } else if (preferredDate < todayISO) {
        errors.preferredDate = 'Select today or a future date.';
      } else if (isSunday) {
        errors.preferredDate =
          'Closed on Sundays. Test drives run Mon–Fri (09:00–15:00) and Sat (09:00–11:00).';
      }

      const allowedSlots = isSaturday ? SATURDAY_TEST_DRIVE_SLOTS : WEEKDAY_TEST_DRIVE_SLOTS;
      if (!isSunday && !allowedSlots.includes(preferredTime)) {
        errors.preferredTime = isSaturday
          ? 'Saturday test drives are only available between 09:00 AM and 11:00 AM.'
          : 'Weekday test drives are only available between 09:00 AM and 15:00 PM.';
      }
    }

    const hasValidVin = vinNumber.trim().length >= 6;
    const hasYear = /^\d{4}$/.test(vehicleYear.trim());
    const hasModelName = vehicleModel.trim().length >= 2;

    if (modal.type === 'service') {
      if (!vehicleReg.trim()) {
        errors.vehicleReg = 'Vehicle registration number is required.';
      }
      if (!vinNumber.trim()) {
        errors.vinNumber = 'VIN number is mandatory for service bookings.';
      } else if (!hasValidVin) {
        errors.vinNumber = 'Enter a valid VIN number (at least 6 characters).';
      }
      if (vehicleYear.trim() && !hasYear) {
        errors.vehicleYear = 'Enter a 4-digit vehicle year (e.g. 2019).';
      }
      if (!mileageKm.trim()) {
        errors.mileageKm = 'Current mileage (km) is required.';
      } else if (Number(mileageKm) <= 0 || Number.isNaN(Number(mileageKm))) {
        errors.mileageKm = 'Enter a valid positive odometer reading in km.';
      }
      if (!preferredDate) {
        errors.preferredDate = 'Select a preferred drop-off date.';
      } else if (preferredDate < todayISO) {
        errors.preferredDate = 'Select today or a future date.';
      } else if (isSunday) {
        errors.preferredDate = `Workshop closed on Sundays (${activeDealership.serviceHours}).`;
      }
    }

    if (modal.type === 'parts') {
      if (!hasValidVin && !(hasYear && hasModelName)) {
        if (!vinNumber.trim() && !vehicleYear.trim() && !vehicleModel.trim()) {
          errors.vinNumber =
            'Provide your VIN number OR type the Vehicle Year and Make/Model.';
          errors.vehicleYear = 'Required if VIN is not entered.';
          errors.vehicleModel = 'Required if VIN is not entered.';
        } else {
          if (vinNumber.trim() && !hasValidVin) {
            errors.vinNumber = 'Enter at least 6 characters (17-character VAG VIN recommended).';
          }
          if (!hasYear) errors.vehicleYear = 'Enter a 4-digit year (e.g. 2020), or enter VIN.';
          if (!hasModelName) errors.vehicleModel = 'Type the Make & Model (e.g. Audi Q5), or enter VIN.';
        }
      }
      if (!notes.trim()) {
        errors.notes = 'Specify the part description or part number required.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorSummary(
        'Please complete all highlighted mandatory fields before submitting your callback request.'
      );
      return;
    }

    const ref = generateBookingRef(activeMeta.prefix, activeDealership.id);
    setFieldErrors({});
    setErrorSummary('');
    setSubmittedRef(ref);

    const typedVagLabel = [vehicleYear.trim(), vehicleModel.trim()].filter(Boolean).join(' ');
    const aftersalesVehicleTitle =
      typedVagLabel || (vinNumber.trim() ? `VIN ${vinNumber.trim()}` : 'VAG Group Vehicle');

    void submitLead({
      id: ref.toLowerCase(),
      leadType: modal.type as LeadSubmissionType,
      fullName,
      phone,
      email,
      subject:
        modal.type === 'event-rsvp'
          ? modal.eventTitle || 'Dealership Event RSVP'
          : modal.type === 'competition-entry'
          ? modal.competitionTitle || 'Dealership Competition Entry'
          : modal.type === 'service'
          ? `${serviceType} — ${aftersalesVehicleTitle}`
          : modal.type === 'parts'
          ? `Genuine VAG Parts — ${aftersalesVehicleTitle}`
          : `${activeMeta.title} — ${selectedModel}`,
      details:
        modal.type === 'test-drive'
          ? `Preferred Slot: ${preferredDate} at ${preferredTime} | Notes: ${notes || 'None'}`
          : modal.type === 'service'
          ? `Vehicle: ${typedVagLabel || 'Identified by VIN'} | Reg: ${vehicleReg} | VIN: ${vinNumber} | Mileage: ${mileageKm} km | Date: ${preferredDate} | Notes: ${notes || 'None'}`
          : modal.type === 'parts'
          ? `Vehicle: ${typedVagLabel || 'Identified by VIN'} | VIN: ${vinNumber || 'Not provided'} | Reg: ${vehicleReg || 'Not provided'} | Part Required: ${notes}`
          : notes || modal.dealSummary || 'General enquiry submitted.',
      homeDealershipId: effectiveHomeBranchId,
    });
  };

  return (
    <Dialog open onClose={onClose} title={activeMeta.title} subtitle={activeMeta.subtitle}>
      {submittedRef ? (
        <div className="py-2 text-left space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#001E50]/10 text-[#001E50]">
            <CheckCircle2 className="h-6 w-6" />
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-[#091224]">
              {modal.type === 'test-drive'
                ? 'Test Drive Request Logged — Callback Pending'
                : modal.type === 'service'
                ? 'Service Request Logged — Advisor Callback Pending'
                : modal.type === 'parts'
                ? 'Parts Request Logged — Parts Executive Callback Pending'
                : modal.type === 'event-rsvp'
                ? 'Event RSVP Confirmed'
                : modal.type === 'competition-entry'
                ? 'Competition Entry Recorded'
                : 'Request Confirmed'}
            </h3>

            {modal.type === 'test-drive' ? (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Thank you, <span className="font-medium text-[#091224]">{fullName}</span>. A{' '}
                {activeDealership.name} sales specialist will call you back on{' '}
                <span className="font-mono text-[#091224]">{phone}</span> to confirm your{' '}
                <span className="font-medium text-[#091224]">{selectedModel}</span> test drive for{' '}
                <span className="font-mono text-[#091224]">{preferredDate}</span> at{' '}
                <span className="font-mono text-[#091224]">{preferredTime}</span>—or offer the next available time slot if that slot has already been allocated.
              </p>
            ) : modal.type === 'service' ? (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Thank you, <span className="font-medium text-[#091224]">{fullName}</span>. Our{' '}
                {activeDealership.name} Service Reception has received your vehicle details for{' '}
                <span className="font-medium text-[#091224]">{selectedModel}</span> and will call you back on{' '}
                <span className="font-mono text-[#091224]">{phone}</span> to confirm your workshop drop-off time on{' '}
                <span className="font-mono text-[#091224]">{preferredDate}</span>.
              </p>
            ) : modal.type === 'parts' ? (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Thank you, <span className="font-medium text-[#091224]">{fullName}</span>. A{' '}
                {activeDealership.name} Parts Sales Executive will call you back on{' '}
                <span className="font-mono text-[#091224]">{phone}</span> to confirm part availability, pricing, and any final specifications before placing your order.
              </p>
            ) : modal.type === 'event-rsvp' ? (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Thank you, <span className="font-medium text-[#091224]">{fullName}</span>. Your spot for{' '}
                <span className="font-medium text-[#091224]">
                  {modal.eventTitle || `${activeDealership.name} Event`}
                </span>{' '}
                is reserved. Our dealership hospitality team will confirm details via{' '}
                <span className="font-mono text-[#091224]">{phone}</span>.
              </p>
            ) : modal.type === 'competition-entry' ? (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Thank you, <span className="font-medium text-[#091224]">{fullName}</span>. Your entry for{' '}
                <span className="font-medium text-[#091224]">
                  {modal.competitionTitle || `${activeDealership.name} Promotion`}
                </span>{' '}
                has been logged through {activeDealership.name}.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                Thank you, <span className="font-medium text-[#091224]">{fullName}</span>. Our{' '}
                {activeDealership.name} team has logged your request for{' '}
                <span className="font-medium text-[#091224]">{selectedModel}</span> and will contact you on{' '}
                <span className="font-mono text-[#091224]">{phone}</span>.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs space-y-1.5 font-mono text-[#334155]">
            <p>
              Booking Reference: <span className="font-semibold text-[#001E50]">{submittedRef}</span>
            </p>
            <p>Submitted Branch: {activeDealership.name}</p>
            {effectiveHomeBranchId && effectiveHomeBranchId !== activeDealership.id && (
              <p>
                Vehicle Held At: {dealershipsById[effectiveHomeBranchId]?.name ?? activeDealership.name}
              </p>
            )}
            {modal.type === 'event-rsvp' && (
              <p>Event: {modal.eventTitle || `${activeDealership.name} Event`}</p>
            )}
            {modal.type === 'competition-entry' && (
              <p>Competition: {modal.competitionTitle}</p>
            )}
            {modal.type === 'test-drive' && (
              <p>
                Requested Slot: {preferredDate} · {preferredTime}
              </p>
            )}
            {modal.type === 'service' && (
              <>
                {(vehicleYear.trim() || vehicleModel.trim()) && (
                  <p>
                    Vehicle:{' '}
                    {[vehicleYear.trim(), vehicleModel.trim()].filter(Boolean).join(' ')}
                  </p>
                )}
                <p>Service Type: {serviceType}</p>
                <p>Registration: {vehicleReg.trim()}</p>
                <p>VIN: {vinNumber.trim()}</p>
                <p>Current Mileage: {Number(mileageKm).toLocaleString('en-ZA')} km</p>
                <p>Preferred Date: {preferredDate}</p>
              </>
            )}
            {modal.type === 'parts' && (
              <>
                {(vehicleYear.trim() || vehicleModel.trim()) && (
                  <p>
                    Vehicle:{' '}
                    {[vehicleYear.trim(), vehicleModel.trim()].filter(Boolean).join(' ')}
                  </p>
                )}
                {vehicleReg.trim() && <p>Registration: {vehicleReg.trim()}</p>}
                {vinNumber.trim() && <p>VIN: {vinNumber.trim()}</p>}
              </>
            )}
            {modal.financePreset && modal.type === 'finance' && (
              <p>
                Indicative Estimate: {formatZAR(modal.financePreset.monthlyEstimate)} p/m ·{' '}
                {modal.financePreset.termMonths} months
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {modal.financePreset && modal.type === 'finance' && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#475569]">Selected Calculation</p>
                <p className="font-display text-sm font-semibold text-[#091224]">
                  {selectedModel} · {formatZAR(modal.financePreset.vehiclePrice)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#475569]">
                  {modal.financePreset.depositPercent}% Dep · {modal.financePreset.balloonPercent}% Balloon
                </p>
                <p className="font-mono text-sm font-semibold text-[#001E50] tabular-nums">
                  {formatZAR(modal.financePreset.monthlyEstimate)} /mo ({modal.financePreset.termMonths} mo)
                </p>
              </div>
            </div>
          )}

          {modal.type === 'vehicle-inquiry' && modal.dealSummary && (
            <div className="rounded-xl border border-[#001E50]/20 bg-[#F8FAFC] px-4 py-3 text-xs text-[#091224]">
              <p className="font-semibold text-[#001E50]">Selected Showroom Offer</p>
              <p className="mt-0.5 text-[#334155]">{modal.dealSummary}</p>
            </div>
          )}

          {modal.type === 'test-drive' && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#334155] space-y-1">
              <div className="flex items-center gap-2 font-semibold text-[#001E50]">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Test Drive Operating Hours ({activeDealership.shortName})</span>
              </div>
              <p className="font-mono text-[11px] text-[#475569]">
                {GROUP_CORPORATE_INFO.testDriveHoursSummary}
              </p>
            </div>
          )}

          {errorSummary && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900 space-y-1"
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{errorSummary}</span>
              </div>
              <ul className="list-disc pl-6 text-red-800 space-y-0.5">
                {Object.values(fieldErrors).map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="modal-name">Full Name *</Label>
              <Input
                id="modal-name"
                placeholder="e.g. Sipho Ndlovu"
                value={fullName}
                aria-invalid={Boolean(fieldErrors.fullName)}
                className={cn(fieldErrors.fullName && ERROR_INPUT_CLASS)}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError('fullName');
                }}
                required
              />
              {fieldErrors.fullName && (
                <p className="mt-1 text-[11px] font-medium text-red-700">{fieldErrors.fullName}</p>
              )}
            </div>
            <div>
              <Label htmlFor="modal-phone">Mobile Number *</Label>
              <Input
                id="modal-phone"
                type="tel"
                placeholder="e.g. 083 412 9087"
                value={phone}
                aria-invalid={Boolean(fieldErrors.phone)}
                className={cn(fieldErrors.phone && ERROR_INPUT_CLASS)}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldError('phone');
                }}
                required
              />
              {fieldErrors.phone && (
                <p className="mt-1 text-[11px] font-medium text-red-700">{fieldErrors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="modal-email">Email Address *</Label>
              <Input
                id="modal-email"
                type="email"
                placeholder="you@example.co.za"
                value={email}
                aria-invalid={Boolean(fieldErrors.email)}
                className={cn(fieldErrors.email && ERROR_INPUT_CLASS)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                required
              />
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] font-medium text-red-700">{fieldErrors.email}</p>
              )}
            </div>

            {modal.type !== 'event-rsvp' &&
              modal.type !== 'competition-entry' &&
              modal.type !== 'service' &&
              modal.type !== 'parts' && (
                <div>
                  <Label htmlFor="modal-model">Volkswagen Model</Label>
                  <Select
                    id="modal-model"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {activeVehicles.map((m) => (
                      <option key={m.id} value={m.title}>
                        {m.title} ({dealershipsById[m.homeDealershipId]?.shortName})
                      </option>
                    ))}
                    {modal.vehicleName &&
                      !activeVehicles.some((m) => m.title === modal.vehicleName) && (
                        <option value={modal.vehicleName}>{modal.vehicleName}</option>
                      )}
                  </Select>
                </div>
              )}
          </div>

          {modal.type === 'test-drive' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="modal-date">Preferred Date (Mon–Sat) *</Label>
                <Input
                  id="modal-date"
                  type="date"
                  min={todayISO}
                  value={preferredDate}
                  aria-invalid={Boolean(fieldErrors.preferredDate || isSunday)}
                  className={cn((fieldErrors.preferredDate || isSunday) && ERROR_INPUT_CLASS)}
                  onChange={(e) => {
                    setPreferredDate(e.target.value);
                    clearFieldError('preferredDate');
                  }}
                  required
                />
                {(isSunday || fieldErrors.preferredDate) && (
                  <p className="mt-1 text-[11px] font-medium text-red-700">
                    {fieldErrors.preferredDate ||
                      'Closed on Sundays. Please choose Monday to Saturday.'}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="modal-time">
                  Preferred Time {isSaturday ? '(Sat: 09:00–11:00)' : '(Mon–Fri: 09:00–15:00)'} *
                </Label>
                <Select
                  id="modal-time"
                  value={preferredTime}
                  disabled={isSunday || availableTimeSlots.length === 0}
                  aria-invalid={Boolean(fieldErrors.preferredTime)}
                  className={cn(fieldErrors.preferredTime && ERROR_INPUT_CLASS)}
                  onChange={(e) => {
                    setPreferredTime(e.target.value);
                    clearFieldError('preferredTime');
                  }}
                >
                  {availableTimeSlots.length === 0 ? (
                    <option value="">Closed on Sundays</option>
                  ) : (
                    availableTimeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))
                  )}
                </Select>
                {fieldErrors.preferredTime && (
                  <p className="mt-1 text-[11px] font-medium text-red-700">
                    {fieldErrors.preferredTime}
                  </p>
                )}
              </div>
            </div>
          )}

          {modal.type === 'service' && (
            <>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <p className="text-xs font-semibold text-[#001E50]">
                  VAG Vehicle Identification (VW, Audi, Porsche, SEAT &amp; Škoda)
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Label htmlFor="modal-vin">VIN Number *</Label>
                    <Input
                      id="modal-vin"
                      placeholder="17-digit VAG VIN"
                      value={vinNumber}
                      aria-invalid={Boolean(fieldErrors.vinNumber)}
                      className={cn('bg-white font-mono', fieldErrors.vinNumber && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVinNumber(e.target.value.toUpperCase());
                        clearFieldError('vinNumber');
                      }}
                      required
                    />
                    {fieldErrors.vinNumber && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.vinNumber}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor="modal-year">Year (Optional)</Label>
                    <Input
                      id="modal-year"
                      maxLength={4}
                      placeholder="e.g. 2019"
                      value={vehicleYear}
                      className={cn('bg-white font-mono', fieldErrors.vehicleYear && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVehicleYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                        clearFieldError('vehicleYear');
                      }}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Label htmlFor="modal-vag-model">Make &amp; Model (Optional)</Label>
                    <Input
                      id="modal-vag-model"
                      placeholder="e.g. Audi Q5 / VW Polo"
                      value={vehicleModel}
                      className="bg-white"
                      onChange={(e) => setVehicleModel(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="modal-service-type">Service Type *</Label>
                <Select
                  id="modal-service-type"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option>Minor Scheduled Service</option>
                  <option>Major Scheduled Service</option>
                  <option>Warranty Repair</option>
                  <option>Mechanical Diagnostics &amp; Repairs</option>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="modal-reg">Vehicle Registration *</Label>
                  <Input
                    id="modal-reg"
                    placeholder="e.g. NN 45210"
                    value={vehicleReg}
                    aria-invalid={Boolean(fieldErrors.vehicleReg)}
                    className={cn(fieldErrors.vehicleReg && ERROR_INPUT_CLASS)}
                    onChange={(e) => {
                      setVehicleReg(e.target.value);
                      clearFieldError('vehicleReg');
                    }}
                    required
                  />
                  {fieldErrors.vehicleReg && (
                    <p className="mt-1 text-[11px] font-medium text-red-700">
                      {fieldErrors.vehicleReg}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="modal-mileage">Current Mileage (km) *</Label>
                  <Input
                    id="modal-mileage"
                    type="number"
                    min={1}
                    placeholder="e.g. 45000"
                    value={mileageKm}
                    aria-invalid={Boolean(fieldErrors.mileageKm)}
                    className={cn(fieldErrors.mileageKm && ERROR_INPUT_CLASS)}
                    onChange={(e) => {
                      setMileageKm(e.target.value);
                      clearFieldError('mileageKm');
                    }}
                    required
                  />
                  {fieldErrors.mileageKm && (
                    <p className="mt-1 text-[11px] font-medium text-red-700">
                      {fieldErrors.mileageKm}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="modal-service-date">Preferred Drop-Off Date (Mon–Sat) *</Label>
                <Input
                  id="modal-service-date"
                  type="date"
                  min={todayISO}
                  value={preferredDate}
                  aria-invalid={Boolean(fieldErrors.preferredDate || isSunday)}
                  className={cn((fieldErrors.preferredDate || isSunday) && ERROR_INPUT_CLASS)}
                  onChange={(e) => {
                    setPreferredDate(e.target.value);
                    clearFieldError('preferredDate');
                  }}
                  required
                />
                {(isSunday || fieldErrors.preferredDate) && (
                  <p className="mt-1 text-[11px] font-medium text-red-700">
                    {fieldErrors.preferredDate ||
                      'Workshop closed on Sundays. Please choose Monday to Saturday.'}
                  </p>
                )}
              </div>
            </>
          )}

          {modal.type === 'parts' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <p className="text-xs font-semibold text-[#001E50]">
                  Identify VAG Vehicle (Enter VIN OR Type Year + Make/Model)
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Label htmlFor="modal-vin">VIN Number (Recommended)</Label>
                    <Input
                      id="modal-vin"
                      placeholder="17-digit VAG VIN"
                      value={vinNumber}
                      aria-invalid={Boolean(fieldErrors.vinNumber)}
                      className={cn('bg-white font-mono', fieldErrors.vinNumber && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVinNumber(e.target.value.toUpperCase());
                        clearFieldError('vinNumber');
                        clearFieldError('vehicleYear');
                        clearFieldError('vehicleModel');
                      }}
                    />
                    {fieldErrors.vinNumber && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.vinNumber}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-3">
                    <Label htmlFor="modal-parts-year">
                      Year {vinNumber.trim().length < 6 ? '*' : ''}
                    </Label>
                    <Input
                      id="modal-parts-year"
                      maxLength={4}
                      placeholder="e.g. 2018"
                      value={vehicleYear}
                      className={cn('bg-white font-mono', fieldErrors.vehicleYear && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVehicleYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                        clearFieldError('vehicleYear');
                        clearFieldError('vinNumber');
                      }}
                    />
                    {fieldErrors.vehicleYear && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.vehicleYear}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-4">
                    <Label htmlFor="modal-parts-model">
                      Make &amp; Model {vinNumber.trim().length < 6 ? '*' : ''}
                    </Label>
                    <Input
                      id="modal-parts-model"
                      placeholder="e.g. Porsche Macan / VW Golf"
                      value={vehicleModel}
                      className={cn('bg-white', fieldErrors.vehicleModel && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVehicleModel(e.target.value);
                        clearFieldError('vehicleModel');
                        clearFieldError('vinNumber');
                      }}
                    />
                    {fieldErrors.vehicleModel && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.vehicleModel}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="modal-reg">Vehicle Registration (Optional)</Label>
                <Input
                  id="modal-reg"
                  placeholder="e.g. NN 45210"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="modal-notes">
              {modal.type === 'parts'
                ? 'Required Part Description or Part Number *'
                : modal.type === 'service'
                ? 'Service Interval or Workshop Notes'
                : 'Additional Notes or Trade-In Details'}
            </Label>
            <Textarea
              id="modal-notes"
              aria-invalid={Boolean(fieldErrors.notes)}
              className={cn(fieldErrors.notes && ERROR_INPUT_CLASS)}
              placeholder={
                modal.type === 'parts'
                  ? 'Describe the part or accessory needed (vehicle year, engine & part details)...'
                  : modal.type === 'service'
                  ? 'e.g. 60,000 km major service, brake inspection, or diagnostic check...'
                  : 'Let us know any questions or trade-in details...'
              }
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                clearFieldError('notes');
              }}
            />
            {fieldErrors.notes && (
              <p className="mt-1 text-[11px] font-medium text-red-700">{fieldErrors.notes}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={(modal.type === 'test-drive' || modal.type === 'service') && isSunday}
            >
              {activeMeta.ctaLabel}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
