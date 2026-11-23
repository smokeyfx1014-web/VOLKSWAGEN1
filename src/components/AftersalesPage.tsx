import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, CheckCircle2, Clock, Cog, Info, Wrench } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { SERVICE_PARTS_ASSETS } from '../data/dealership';
import { cn, generateBookingRef } from '../lib/utils';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button, Input, Label, Select, Textarea } from './ui/shadcn';

interface AftersalesPageProps {
  initialTab?: 'service' | 'parts';
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
    | 'notes',
    string
  >
>;

function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function getNextBusinessDayISO(): string {
  const date = new Date();
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function getDayOfWeek(dateISO: string): number | null {
  if (!dateISO) return null;
  const parsed = new Date(`${dateISO}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
}

const ERROR_INPUT_CLASS =
  'border-red-500 bg-red-50/40 focus-visible:border-red-600 focus-visible:ring-red-500/20';

export function AftersalesPage({ initialTab = 'service' }: AftersalesPageProps) {
  const { activeDealership } = useDealership();
  const { submitLead } = useDealershipData();

  const [activeTab, setActiveTab] = useState<'service' | 'parts'>(initialTab);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Typed VAG vehicle identification (supports VW, Audi, Porsche, VW Commercial, SEAT, Skoda)
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [serviceType, setServiceType] = useState('Minor Scheduled Service');
  const [preferredDate, setPreferredDate] = useState(getNextBusinessDayISO);
  const [vehicleReg, setVehicleReg] = useState('');
  const [vinNumber, setVinNumber] = useState('');
  const [mileageKm, setMileageKm] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [errorSummary, setErrorSummary] = useState('');
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setFieldErrors({});
    setErrorSummary('');
    setSubmittedRef(null);
  }, [initialTab]);

  const todayISO = useMemo(() => getTodayISO(), []);
  const selectedDay = useMemo(() => getDayOfWeek(preferredDate), [preferredDate]);
  const isSunday = selectedDay === 0;

  const clearError = (key: keyof FieldErrorMap) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (errorSummary) setErrorSummary('');
  };

  const handleTabSwitch = (nextTab: 'service' | 'parts') => {
    setActiveTab(nextTab);
    setFieldErrors({});
    setErrorSummary('');
    setSubmittedRef(null);
    const el = document.getElementById('aftersales-booking-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const typedVehicleLabel = [vehicleYear.trim(), vehicleModel.trim()].filter(Boolean).join(' ');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrorMap = {};

    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (phone.replace(/\D/g, '').length < 9) {
      errors.phone = 'Enter a valid South African mobile number (at least 9 digits).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    const hasValidVin = vinNumber.trim().length >= 6;
    const hasYear = /^\d{4}$/.test(vehicleYear.trim());
    const hasModelName = vehicleModel.trim().length >= 2;
    const hasTypedModel = hasYear && hasModelName;

    if (activeTab === 'service') {
      // VIN is mandatory for service bookings
      if (!hasValidVin) {
        errors.vinNumber =
          'VIN number is mandatory for service bookings so technicians verify your exact VW / Audi / Porsche service specification.';
      }
      if (!vehicleReg.trim()) {
        errors.vehicleReg = 'Vehicle registration number is required.';
      }
      if (vehicleYear.trim() && !hasYear) {
        errors.vehicleYear = 'Enter a 4-digit vehicle year (e.g. 2021).';
      }
      if (!mileageKm.trim() || Number(mileageKm) <= 0 || Number.isNaN(Number(mileageKm))) {
        errors.mileageKm = 'Current mileage (km) is required.';
      }
      if (!preferredDate || preferredDate < todayISO) {
        errors.preferredDate = 'Select today or a future drop-off date.';
      } else if (isSunday) {
        errors.preferredDate = `Workshop closed on Sundays. Service Hours: ${activeDealership.serviceHours}.`;
      }
    } else {
      // Parts: Identify car by VIN OR Model (typed year + car name)
      if (!hasValidVin && !hasTypedModel) {
        if (!vinNumber.trim() && !vehicleYear.trim() && !vehicleModel.trim()) {
          errors.vinNumber =
            'Identify your VAG vehicle by entering your VIN number OR typing the Vehicle Year and Make/Model.';
          errors.vehicleYear = 'Required if VIN number is not provided.';
          errors.vehicleModel = 'Required if VIN number is not provided.';
        } else if (!hasValidVin) {
          if (vinNumber.trim().length > 0 && vinNumber.trim().length < 6) {
            errors.vinNumber = 'Enter at least 6 characters (17-character VIN recommended).';
          }
          if (!hasYear) {
            errors.vehicleYear = 'Enter a 4-digit year (e.g. 2019), or provide a VIN.';
          }
          if (!hasModelName) {
            errors.vehicleModel = 'Type the make & model (e.g. Audi Q5 / VW Golf), or provide a VIN.';
          }
        }
      }

      if (!notes.trim()) {
        errors.notes = 'Specify the required part description or OEM part number.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorSummary(
        'Please complete all highlighted mandatory fields before submitting your callback request.'
      );
      return;
    }

    const ref = generateBookingRef(
      activeTab === 'service' ? 'SRV' : 'PRT',
      activeDealership.id
    );
    setFieldErrors({});
    setErrorSummary('');
    setSubmittedRef(ref);

    const vehicleDescriptor =
      typedVehicleLabel || (vinNumber.trim() ? `VIN ${vinNumber.trim()}` : 'VAG Group Vehicle');

    await submitLead({
      id: ref.toLowerCase(),
      leadType: activeTab,
      fullName,
      phone,
      email,
      subject:
        activeTab === 'service'
          ? `${serviceType} — ${vehicleDescriptor}`
          : `Genuine VAG Parts Enquiry — ${vehicleDescriptor}`,
      details:
        activeTab === 'service'
          ? `Vehicle: ${typedVehicleLabel || 'Identified by VIN'} | Reg: ${vehicleReg} | VIN: ${vinNumber} | Mileage: ${mileageKm} km | Drop-off: ${preferredDate} | Notes: ${notes || 'None'}`
          : `Vehicle: ${typedVehicleLabel || 'Identified by VIN'} | VIN: ${vinNumber || 'Not provided'} | Reg: ${vehicleReg || 'Not provided'} | Part Needed: ${notes}`,
      homeDealershipId: activeDealership.id,
    });
  };

  return (
    <div className="bg-[#F8FAFC] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeader
          kicker="Aftersales Hub · Volkswagen Group (VAG) Service & Genuine Parts"
          title={`${activeDealership.shortName} Workshop Service & Genuine VAG Parts`}
          description={`Grouped aftersales care at ${activeDealership.physicalAddress}. We service and supply genuine OEM parts for all Volkswagen Group vehicles—including Volkswagen, Audi, Porsche, VW Commercial, SEAT, and Škoda.`}
        />

        {/* Two-Column Overview Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <FadeUp>
            <motion.article
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all',
                activeTab === 'service' ? 'border-[#001E50] shadow-md' : 'border-[#E2E8F0]'
              )}
            >
              <DealershipImage
                asset={SERVICE_PARTS_ASSETS.service}
                alt={`${activeDealership.name} Approved Service Centre`}
                className="border-b border-[#E2E8F0]"
              />
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-2 text-[#001E50]">
                    <Wrench className="h-4 w-4" />
                    <span className="text-xs font-semibold tracking-wider uppercase">
                      Approved VAG Workshop
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold text-[#091224]">
                    Volkswagen &amp; VAG Group Service Centre
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    Minor &amp; major scheduled services, warranty repairs, wheel alignment, and factory diagnostics for Volkswagen, Audi, Porsche, and VW Commercial vehicles at {activeDealership.name}.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-[#334155]">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>Factory-trained technicians &amp; VAG diagnostic tooling</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>VIN-verified service intervals &amp; digital service records</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
                  <Button
                    variant={activeTab === 'service' ? 'primary' : 'outline'}
                    onClick={() => handleTabSwitch('service')}
                  >
                    Book Workshop Service Below
                  </Button>
                </div>
              </div>
            </motion.article>
          </FadeUp>

          <FadeUp delay={0.06}>
            <motion.article
              whileHover={{ y: -3 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all',
                activeTab === 'parts' ? 'border-[#001E50] shadow-md' : 'border-[#E2E8F0]'
              )}
            >
              <DealershipImage
                asset={SERVICE_PARTS_ASSETS.parts}
                alt={`Genuine Volkswagen Group Parts & Accessories — ${activeDealership.shortName}`}
                className="border-b border-[#E2E8F0]"
              />
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-2 text-[#001E50]">
                    <Cog className="h-4 w-4" />
                    <span className="text-xs font-semibold tracking-wider uppercase">
                      VAG Parts &amp; Accessories
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold text-[#091224]">
                    Genuine VW, Audi &amp; Porsche Parts
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    Direct counter supply at {activeDealership.shortName} across all Volkswagen Group (VAG) brands—including VW, Audi, Porsche, SEAT &amp; Škoda—matched accurately via VIN or model &amp; year.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-[#334155]">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>2-year unlimited-kilometre Genuine OEM warranty</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>VIN-matched ETKA part verification callback before ordering</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
                  <Button
                    variant={activeTab === 'parts' ? 'primary' : 'outline'}
                    onClick={() => handleTabSwitch('parts')}
                  >
                    Request Genuine VAG Parts Below
                  </Button>
                </div>
              </div>
            </motion.article>
          </FadeUp>
        </div>

        {/* Grouped Interactive Booking Form */}
        <div
          id="aftersales-booking-form"
          className="grid grid-cols-1 gap-8 rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 lg:grid-cols-12"
        >
          <div className="lg:col-span-4 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#00437A]">
                {activeDealership.shortName} Aftersales Desk
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[#091224]">
                {activeTab === 'service' ? 'Schedule Workshop Service' : 'Request VAG OEM Parts'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                {activeTab === 'service'
                  ? 'Provide your mandatory VIN number, registration, and odometer reading so a Service Advisor can verify exact parts and confirm your arrival slot.'
                  : 'Identify your vehicle by VIN number (recommended) or by typing your Year and Make/Model. Our Parts Sales Executive will verify VAG fitment and pricing before ordering.'}
              </p>
            </div>

            <div className="rounded-xl border border-[#CFE0F5] bg-[#EFF6FF] p-4 space-y-1.5 text-xs text-[#001E50]">
              <div className="flex items-center gap-2 font-semibold">
                <Info className="h-4 w-4 shrink-0 text-[#00437A]" />
                <span>All VAG Marques Supported</span>
              </div>
              <p className="leading-relaxed text-[#334155]">
                We service and supply genuine parts for <strong className="text-[#091224]">Volkswagen, Audi, Porsche, VW Commercial, SEAT &amp; Škoda</strong>. Because platform parts vary by engine and build code, your 17-digit VIN ensures 100% accuracy.
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-3 text-xs text-[#475569]">
              <div className="flex items-center gap-2 font-semibold text-[#001E50]">
                <Clock className="h-4 w-4" />
                <span>Service &amp; Parts Hours</span>
              </div>
              <p className="font-mono text-xs text-[#091224]">{activeDealership.serviceHours}</p>
              <p className="pt-2 border-t border-[#E2E8F0] text-[#64748B]">
                {activeDealership.physicalAddress} · {activeDealership.receptionNumber}
              </p>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="mb-6 inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => handleTabSwitch('service')}
                className={cn(
                  'px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  activeTab === 'service'
                    ? 'bg-[#001E50] text-white'
                    : 'text-[#475569] hover:text-[#091224]'
                )}
              >
                Workshop Service Booking
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('parts')}
                className={cn(
                  'px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer',
                  activeTab === 'parts'
                    ? 'bg-[#001E50] text-white'
                    : 'text-[#475569] hover:text-[#091224]'
                )}
              >
                Genuine VAG Parts Request
              </button>
            </div>

            {submittedRef ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#001E50]/10 text-[#001E50]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="font-display text-xl font-semibold text-[#091224]">
                  {activeTab === 'service'
                    ? 'Service Request Logged — Advisor Callback Pending'
                    : 'Parts Request Logged — Parts Executive Callback Pending'}
                </h4>
                <p className="text-sm leading-relaxed text-[#475569]">
                  Thank you, <strong className="text-[#091224]">{fullName}</strong>. Our{' '}
                  {activeDealership.name}{' '}
                  {activeTab === 'service' ? 'Service Advisor' : 'Parts Sales Executive'} will call{' '}
                  <span className="font-mono text-[#091224]">{phone}</span>{' '}
                  {activeTab === 'service'
                    ? `to confirm your ${serviceType} drop-off time on ${preferredDate}.`
                    : 'to verify VAG fitment and pricing before placing your OEM parts order.'}
                </p>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 font-mono text-xs text-[#334155] space-y-1">
                  <p>
                    Reference: <strong className="text-[#001E50]">{submittedRef}</strong>
                  </p>
                  <p>Branch: {activeDealership.name}</p>
                  {typedVehicleLabel && <p>Vehicle: {typedVehicleLabel}</p>}
                  {vehicleReg.trim() && <p>Registration: {vehicleReg}</p>}
                  {vinNumber.trim() && <p>VIN: {vinNumber}</p>}
                  {activeTab === 'service' && (
                    <>
                      <p>Service Type: {serviceType}</p>
                      <p>Current Mileage: {Number(mileageKm).toLocaleString('en-ZA')} km</p>
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => setSubmittedRef(null)}>
                  Submit Another Aftersales Request
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                      {Object.values(fieldErrors).map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="aftersales-name">Full Name *</Label>
                    <Input
                      id="aftersales-name"
                      value={fullName}
                      placeholder="e.g. Sipho Ndlovu"
                      className={cn(fieldErrors.fullName && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        clearError('fullName');
                      }}
                    />
                    {fieldErrors.fullName && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.fullName}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="aftersales-phone">Mobile Number *</Label>
                    <Input
                      id="aftersales-phone"
                      type="tel"
                      value={phone}
                      placeholder="e.g. 083 412 9087"
                      className={cn(fieldErrors.phone && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        clearError('phone');
                      }}
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.phone}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="aftersales-email">Email Address *</Label>
                    <Input
                      id="aftersales-email"
                      type="email"
                      value={email}
                      placeholder="you@example.co.za"
                      className={cn(fieldErrors.email && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearError('email');
                      }}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Vehicle Identification Block */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                    <p className="text-xs font-semibold text-[#001E50]">
                      Vehicle Identification (VW, Audi, Porsche &amp; VAG Group)
                    </p>
                    <span className="text-[11px] font-medium text-[#475569]">
                      {activeTab === 'service'
                        ? 'VIN Number is mandatory · Optionally add Year & Model'
                        : 'Provide VIN Number OR type Vehicle Year & Make/Model'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Label htmlFor="aftersales-vin">
                        VIN Number {activeTab === 'service' ? '*' : '(Recommended)'}
                      </Label>
                      <Input
                        id="aftersales-vin"
                        value={vinNumber}
                        placeholder="17-digit VAG VIN (e.g. WVW... / WAU...)"
                        className={cn('bg-white font-mono', fieldErrors.vinNumber && ERROR_INPUT_CLASS)}
                        onChange={(e) => {
                          setVinNumber(e.target.value.toUpperCase());
                          clearError('vinNumber');
                          if (activeTab === 'parts') {
                            clearError('vehicleYear');
                            clearError('vehicleModel');
                          }
                        }}
                      />
                      {fieldErrors.vinNumber && (
                        <p className="mt-1 text-[11px] font-medium text-red-700">
                          {fieldErrors.vinNumber}
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <Label htmlFor="aftersales-year">
                        Year {activeTab === 'parts' && vinNumber.trim().length < 6 ? '*' : ''}
                      </Label>
                      <Input
                        id="aftersales-year"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={vehicleYear}
                        placeholder="e.g. 2019"
                        className={cn('bg-white font-mono', fieldErrors.vehicleYear && ERROR_INPUT_CLASS)}
                        onChange={(e) => {
                          setVehicleYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                          clearError('vehicleYear');
                          if (activeTab === 'parts') clearError('vinNumber');
                        }}
                      />
                      {fieldErrors.vehicleYear && (
                        <p className="mt-1 text-[11px] font-medium text-red-700">
                          {fieldErrors.vehicleYear}
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-5">
                      <Label htmlFor="aftersales-model-text">
                        Car Make &amp; Model {activeTab === 'parts' && vinNumber.trim().length < 6 ? '*' : ''}
                      </Label>
                      <Input
                        id="aftersales-model-text"
                        value={vehicleModel}
                        placeholder="e.g. VW Golf 7 GTI / Audi Q5 / Porsche Macan"
                        className={cn('bg-white', fieldErrors.vehicleModel && ERROR_INPUT_CLASS)}
                        onChange={(e) => {
                          setVehicleModel(e.target.value);
                          clearError('vehicleModel');
                          if (activeTab === 'parts') clearError('vinNumber');
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

                <div
                  className={cn(
                    'grid grid-cols-1 gap-4',
                    activeTab === 'service' ? 'sm:grid-cols-3' : 'sm:grid-cols-1'
                  )}
                >
                  <div>
                    <Label htmlFor="aftersales-reg">
                      Vehicle Registration {activeTab === 'service' ? '*' : '(Optional)'}
                    </Label>
                    <Input
                      id="aftersales-reg"
                      value={vehicleReg}
                      placeholder="e.g. NN 45210"
                      className={cn(fieldErrors.vehicleReg && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVehicleReg(e.target.value);
                        clearError('vehicleReg');
                      }}
                    />
                    {fieldErrors.vehicleReg && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.vehicleReg}
                      </p>
                    )}
                  </div>

                  {activeTab === 'service' && (
                    <>
                      <div>
                        <Label htmlFor="aftersales-service-type">Service Type *</Label>
                        <Select
                          id="aftersales-service-type"
                          value={serviceType}
                          onChange={(e) => setServiceType(e.target.value)}
                        >
                          <option>Minor Scheduled Service</option>
                          <option>Major Scheduled Service</option>
                          <option>Warranty Repair</option>
                          <option>Mechanical Diagnostics &amp; Repairs</option>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="aftersales-mileage">Current Mileage (km) *</Label>
                        <Input
                          id="aftersales-mileage"
                          type="number"
                          min={1}
                          value={mileageKm}
                          placeholder="e.g. 45000"
                          className={cn(fieldErrors.mileageKm && ERROR_INPUT_CLASS)}
                          onChange={(e) => {
                            setMileageKm(e.target.value);
                            clearError('mileageKm');
                          }}
                        />
                        {fieldErrors.mileageKm && (
                          <p className="mt-1 text-[11px] font-medium text-red-700">
                            {fieldErrors.mileageKm}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {activeTab === 'service' && (
                  <div>
                    <Label htmlFor="aftersales-date">Preferred Drop-Off Date (Mon–Sat) *</Label>
                    <Input
                      id="aftersales-date"
                      type="date"
                      min={todayISO}
                      value={preferredDate}
                      className={cn(
                        (fieldErrors.preferredDate || isSunday) && ERROR_INPUT_CLASS
                      )}
                      onChange={(e) => {
                        setPreferredDate(e.target.value);
                        clearError('preferredDate');
                      }}
                    />
                    {(isSunday || fieldErrors.preferredDate) && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.preferredDate ||
                          'Workshop closed on Sundays. Please choose Monday to Saturday.'}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="aftersales-notes">
                    {activeTab === 'parts'
                      ? 'Required Part Description or Part Number *'
                      : 'Workshop Notes or Symptoms'}
                  </Label>
                  <Textarea
                    id="aftersales-notes"
                    value={notes}
                    className={cn(fieldErrors.notes && ERROR_INPUT_CLASS)}
                    placeholder={
                      activeTab === 'parts'
                        ? 'Describe the OEM part or accessory required (engine code, front/rear, OEM part number if known)...'
                        : 'Any specific faults, brake checks, or shuttle requirements...'
                    }
                    onChange={(e) => {
                      setNotes(e.target.value);
                      clearError('notes');
                    }}
                  />
                  {fieldErrors.notes && (
                    <p className="mt-1 text-[11px] font-medium text-red-700">
                      {fieldErrors.notes}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={activeTab === 'service' && isSunday}
                >
                  {activeTab === 'service' ? 'Request Service Booking' : 'Submit Parts Request'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
