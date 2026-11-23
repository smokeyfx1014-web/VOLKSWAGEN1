import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, CheckCircle2, Clock, Cog, Wrench } from 'lucide-react';
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
  const { activeVehicles, submitLead } = useDealershipData();

  const [activeTab, setActiveTab] = useState<'service' | 'parts'>(initialTab);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    activeVehicles[0]?.title ?? '2026 Volkswagen Polo Vivo 1.4 Life'
  );
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

  useEffect(() => {
    if (activeVehicles.length > 0 && !activeVehicles.some((v) => v.title === selectedModel)) {
      setSelectedModel(activeVehicles[0].title);
    }
  }, [activeVehicles, selectedModel]);

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

    if (!vehicleReg.trim()) errors.vehicleReg = 'Vehicle registration number is required.';
    if (vinNumber.trim().length < 6) {
      errors.vinNumber = 'Valid VIN number is required.';
    }

    if (activeTab === 'service') {
      if (!mileageKm.trim() || Number(mileageKm) <= 0 || Number.isNaN(Number(mileageKm))) {
        errors.mileageKm = 'Current mileage (km) is required.';
      }
      if (!preferredDate || preferredDate < todayISO) {
        errors.preferredDate = 'Select today or a future drop-off date.';
      } else if (isSunday) {
        errors.preferredDate = `Workshop closed on Sundays. Service Hours: ${activeDealership.serviceHours}.`;
      }
    }

    if (activeTab === 'parts' && !notes.trim()) {
      errors.notes = 'Specify the required part description or OEM part number.';
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

    await submitLead({
      id: ref.toLowerCase(),
      leadType: activeTab,
      fullName,
      phone,
      email,
      subject:
        activeTab === 'service'
          ? `${serviceType} — ${selectedModel}`
          : `Genuine Parts Enquiry — ${selectedModel}`,
      details:
        activeTab === 'service'
          ? `Reg: ${vehicleReg} | VIN: ${vinNumber} | Mileage: ${mileageKm} km | Drop-off: ${preferredDate} | Notes: ${notes || 'None'}`
          : `Reg: ${vehicleReg} | VIN: ${vinNumber} | Part Needed: ${notes}`,
      homeDealershipId: activeDealership.id,
    });
  };

  return (
    <div className="bg-[#F8FAFC] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <SectionHeader
          kicker="Aftersales Hub · Service & Genuine Parts"
          title={`${activeDealership.shortName} Workshop Service & Genuine VW Parts`}
          description={`Grouped aftersales care at ${activeDealership.physicalAddress}. Schedule factory-certified maintenance or order VIN-matched OEM components from one streamlined page.`}
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
                      Approved Workshop
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold text-[#091224]">
                    Volkswagen Service Centre
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    Minor &amp; major scheduled services, warranty repairs, wheel alignment, and multi-point diagnostics backed by VW factory tooling at {activeDealership.name}.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-[#334155]">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>Factory-trained master technicians</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>Digital service history &amp; warranty protection</span>
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
                alt={`Genuine Volkswagen Parts & Accessories — ${activeDealership.shortName}`}
                className="border-b border-[#E2E8F0]"
              />
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-2 text-[#001E50]">
                    <Cog className="h-4 w-4" />
                    <span className="text-xs font-semibold tracking-wider uppercase">
                      Parts &amp; Accessories
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-2xl font-semibold text-[#091224]">
                    Genuine Volkswagen Parts
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    Direct counter supply at {activeDealership.shortName} for private owners, panel beaters, and commercial fleets—matched precisely to your VIN before ordering.
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-[#334155]">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>2-year unlimited-kilometre OEM parts warranty</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#00437A]" />
                      <span>Parts Sales Executive callback verification</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
                  <Button
                    variant={activeTab === 'parts' ? 'primary' : 'outline'}
                    onClick={() => handleTabSwitch('parts')}
                  >
                    Request Genuine Parts Below
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
                {activeTab === 'service' ? 'Schedule Workshop Service' : 'Request OEM Parts'}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                {activeTab === 'service'
                  ? 'Provide your registration, VIN, and odometer reading so a Service Advisor can confirm your arrival slot.'
                  : 'Provide your registration, VIN, and required part details so our Parts Sales Executive can verify fitment and pricing before ordering.'}
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
                Genuine Parts Request
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
                    : 'to verify fitment and pricing before placing your OEM parts order.'}
                </p>
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 font-mono text-xs text-[#334155] space-y-1">
                  <p>
                    Reference: <strong className="text-[#001E50]">{submittedRef}</strong>
                  </p>
                  <p>Branch: {activeDealership.name}</p>
                  <p>Model: {selectedModel}</p>
                  <p>Registration: {vehicleReg}</p>
                  <p>VIN: {vinNumber}</p>
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="aftersales-model">Volkswagen Model</Label>
                    <Select
                      id="aftersales-model"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {activeVehicles.map((v) => (
                        <option key={v.id} value={v.title}>
                          {v.title}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {activeTab === 'service' && (
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
                  )}
                </div>

                <div
                  className={cn(
                    'grid grid-cols-1 gap-4',
                    activeTab === 'service' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                  )}
                >
                  <div>
                    <Label htmlFor="aftersales-reg">Vehicle Registration *</Label>
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
                  <div>
                    <Label htmlFor="aftersales-vin">VIN Number *</Label>
                    <Input
                      id="aftersales-vin"
                      value={vinNumber}
                      placeholder="17-digit VIN"
                      className={cn(fieldErrors.vinNumber && ERROR_INPUT_CLASS)}
                      onChange={(e) => {
                        setVinNumber(e.target.value.toUpperCase());
                        clearError('vinNumber');
                      }}
                    />
                    {fieldErrors.vinNumber && (
                      <p className="mt-1 text-[11px] font-medium text-red-700">
                        {fieldErrors.vinNumber}
                      </p>
                    )}
                  </div>

                  {activeTab === 'service' && (
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
                        ? 'Describe the OEM part or accessory required (model year, engine, part number)...'
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
