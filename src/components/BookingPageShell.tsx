import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import {
  SATURDAY_TEST_DRIVE_SLOTS,
  SERVICE_PARTS_ASSETS,
  STARTING_POINT_ASSETS,
  WEEKDAY_TEST_DRIVE_SLOTS,
} from '../data/dealership';
import { cn, generateBookingRef } from '../lib/utils';
import { DealershipImage } from './DealershipImage';
import { SectionHeader } from './MotionPrimitives';
import { Button, Input, Label, Select, Textarea } from './ui/shadcn';

type BookingMode = 'test-drive' | 'service' | 'parts';

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

export function DedicatedBookingPage({ mode }: { mode: BookingMode }) {
  const { activeDealership, dealershipsById, groupProfile } = useDealership();
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
  const [errorSummary, setErrorSummary] = useState('');
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  useEffect(() => {
    if (activeVehicles.length > 0 && !activeVehicles.some((v) => v.title === selectedModel)) {
      setSelectedModel(activeVehicles[0].title);
    }
  }, [activeVehicles, selectedModel]);

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
    if (availableTimeSlots.length > 0 && !availableTimeSlots.includes(preferredTime)) {
      setPreferredTime(availableTimeSlots[0]);
    }
  }, [availableTimeSlots, preferredTime]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrorMap = {};

    if (!fullName.trim()) errors.fullName = 'Full name is required.';
    if (phone.replace(/\D/g, '').length < 9) {
      errors.phone = 'Enter a valid South African mobile number (at least 9 digits).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (mode === 'test-drive') {
      if (!preferredDate || preferredDate < todayISO) {
        errors.preferredDate = 'Select today or a future date (Monday to Saturday).';
      } else if (isSunday) {
        errors.preferredDate =
          'Closed on Sundays. Test drives run Mon–Fri (09:00–15:00) and Sat (09:00–11:00).';
      }
      const allowed = isSaturday ? SATURDAY_TEST_DRIVE_SLOTS : WEEKDAY_TEST_DRIVE_SLOTS;
      if (!isSunday && !allowed.includes(preferredTime)) {
        errors.preferredTime = isSaturday
          ? 'Saturday test drives are only available between 09:00 and 11:00.'
          : 'Weekday test drives are only available between 09:00 and 15:00.';
      }
    }

    const hasValidVin = vinNumber.trim().length >= 6;
    const hasYear = /^\d{4}$/.test(vehicleYear.trim());
    const hasModelName = vehicleModel.trim().length >= 2;

    if (mode === 'service') {
      if (!vehicleReg.trim()) errors.vehicleReg = 'Vehicle registration number is required.';
      if (!hasValidVin) errors.vinNumber = 'VIN number is mandatory for service bookings.';
      if (vehicleYear.trim() && !hasYear) errors.vehicleYear = 'Enter a 4-digit year (e.g. 2019).';
      if (!mileageKm.trim() || Number(mileageKm) <= 0) {
        errors.mileageKm = 'Current mileage (km) is required.';
      }
      if (!preferredDate || preferredDate < todayISO) {
        errors.preferredDate = 'Select today or a future drop-off date.';
      } else if (isSunday) {
        errors.preferredDate = 'Workshop closed on Sundays. Choose Monday to Saturday.';
      }
    }

    if (mode === 'parts') {
      if (!hasValidVin && !(hasYear && hasModelName)) {
        if (!vinNumber.trim() && !vehicleYear.trim() && !vehicleModel.trim()) {
          errors.vinNumber = 'Enter VIN number OR type Vehicle Year & Make/Model.';
          errors.vehicleYear = 'Required if VIN is not entered.';
          errors.vehicleModel = 'Required if VIN is not entered.';
        } else {
          if (vinNumber.trim() && !hasValidVin) errors.vinNumber = 'Enter at least 6 characters.';
          if (!hasYear) errors.vehicleYear = 'Enter 4-digit year or provide VIN.';
          if (!hasModelName) errors.vehicleModel = 'Enter make & model or provide VIN.';
        }
      }
      if (!notes.trim()) errors.notes = 'Specify the part description or part number.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorSummary(
        'Please complete all highlighted mandatory fields before submitting your callback request.'
      );
      return;
    }

    const prefix = mode === 'test-drive' ? 'TD' : mode === 'service' ? 'SRV' : 'PRT';
    const ref = generateBookingRef(prefix, activeDealership.referenceCode || activeDealership.id);
    setFieldErrors({});
    setErrorSummary('');
    setSubmittedRef(ref);

    const matchedVehicle = activeVehicles.find((v) => v.title === selectedModel);
    const typedVagLabel = [vehicleYear.trim(), vehicleModel.trim()].filter(Boolean).join(' ');
    const aftersalesTitle =
      typedVagLabel || (vinNumber.trim() ? `VIN ${vinNumber.trim()}` : 'VAG Group Vehicle');

    void submitLead({
      id: ref.toLowerCase(),
      leadType: mode,
      fullName,
      phone,
      email,
      subject:
        mode === 'test-drive'
          ? `Test Drive — ${selectedModel}`
          : mode === 'service'
          ? `${serviceType} — ${aftersalesTitle}`
          : `Genuine VAG Parts — ${aftersalesTitle}`,
      details:
        mode === 'test-drive'
          ? `Preferred Slot: ${preferredDate} at ${preferredTime} | Notes: ${notes || 'None'}`
          : mode === 'service'
          ? `Vehicle: ${typedVagLabel || 'Identified by VIN'} | Reg: ${vehicleReg} | VIN: ${vinNumber} | Mileage: ${mileageKm} km | Date: ${preferredDate} | Notes: ${notes || 'None'}`
          : `Vehicle: ${typedVagLabel || 'Identified by VIN'} | VIN: ${vinNumber || 'Not provided'} | Reg: ${vehicleReg || 'Not provided'} | Part Required: ${notes}`,
      homeDealershipId:
        mode === 'test-drive'
          ? matchedVehicle?.homeDealershipId ?? activeDealership.id
          : activeDealership.id,
    });
  };

  const pageMeta =
    mode === 'test-drive'
      ? {
          kicker: 'Test Drive Experience',
          title: `Book a Test Drive at ${activeDealership.name}`,
          description: `Test drives operate ${groupProfile.testDriveHoursSummary}. Our ${activeDealership.shortName} sales executive will call to confirm your time slot or offer the next available window.`,
          asset: STARTING_POINT_ASSETS.testDrive,
          cta: 'Request Test Drive Slot',
        }
      : mode === 'service'
      ? {
          kicker: 'Approved Workshop',
          title: `Book Scheduled Service at ${activeDealership.shortName}`,
          description: `Service & Parts operate ${activeDealership.serviceHours}. Provide your VIN, registration, and mileage for advisor confirmation.`,
          asset: SERVICE_PARTS_ASSETS.service,
          cta: 'Request Service Booking',
        }
      : {
          kicker: 'Genuine Parts Counter',
          title: `Order Genuine Volkswagen Parts — ${activeDealership.shortName}`,
          description:
            'Every Genuine Volkswagen Part carries a 2-year unlimited-kilometre warranty. Submit your VIN and part enquiry for a Parts Sales Executive callback before ordering.',
          asset: SERVICE_PARTS_ASSETS.parts,
          cta: 'Submit Parts Request',
        };

  return (
    <div className="bg-white pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kicker={pageMeta.kicker}
          title={pageMeta.title}
          description={pageMeta.description}
        />

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-6">
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0]">
              <DealershipImage asset={pageMeta.asset} alt={pageMeta.title} />
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 space-y-3 text-sm text-[#475569]">
              <div className="flex items-center gap-2 font-semibold text-[#001E50]">
                <Clock className="h-4 w-4" />
                <span>Department Hours</span>
              </div>
              {mode === 'test-drive' ? (
                <div className="space-y-1.5 text-xs">
                  <p className="font-mono text-[#091224]">{groupProfile.testDriveHoursSummary}</p>
                  <p className="text-[#64748B]">Sales Showroom: {activeDealership.salesHours}</p>
                </div>
              ) : (
                <p className="font-mono text-xs text-[#091224]">{activeDealership.serviceHours}</p>
              )}
              <p className="text-xs text-[#64748B] pt-2 border-t border-[#E2E8F0]">
                {activeDealership.physicalAddress} · {activeDealership.receptionNumber}
              </p>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 sm:p-8">
              {submittedRef ? (
                <div className="space-y-5 py-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#001E50]/10 text-[#001E50]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-[#091224]">
                    Callback Request Logged
                  </h3>
                  <p className="text-sm leading-relaxed text-[#475569]">
                    Thank you, <strong className="text-[#091224]">{fullName}</strong>. Our{' '}
                    {activeDealership.name}{' '}
                    {mode === 'test-drive'
                      ? 'sales specialist'
                      : mode === 'service'
                      ? 'Service Advisor'
                      : 'Parts Sales Executive'}{' '}
                    will call you back on <span className="font-mono text-[#091224]">{phone}</span>{' '}
                    {mode === 'test-drive'
                      ? `to confirm ${preferredDate} at ${preferredTime} (or offer the next available slot).`
                      : mode === 'service'
                      ? `to confirm your ${serviceType} arrival time on ${preferredDate}.`
                      : 'to verify fitment and pricing before placing your parts order.'}
                  </p>
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 font-mono text-xs text-[#334155] space-y-1">
                    <p>
                      Reference: <span className="font-semibold text-[#001E50]">{submittedRef}</span>
                    </p>
                    <p>Branch: {activeDealership.name}</p>
                    {mode === 'test-drive' ? (
                      <p>Model: {selectedModel}</p>
                    ) : (
                      (vehicleYear.trim() || vehicleModel.trim()) && (
                        <p>
                          Vehicle:{' '}
                          {[vehicleYear.trim(), vehicleModel.trim()].filter(Boolean).join(' ')}
                        </p>
                      )
                    )}
                    {(mode === 'service' || mode === 'parts') && (
                      <>
                        {vehicleReg.trim() && <p>Registration: {vehicleReg}</p>}
                        {vinNumber.trim() && <p>VIN: {vinNumber}</p>}
                      </>
                    )}
                    {mode === 'service' && (
                      <p>Mileage: {Number(mileageKm).toLocaleString('en-ZA')} km</p>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => setSubmittedRef(null)}>
                    Submit Another Request
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
                        {Object.values(fieldErrors).map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="page-name">Full Name *</Label>
                      <Input
                        id="page-name"
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
                      <Label htmlFor="page-phone">Mobile Number *</Label>
                      <Input
                        id="page-phone"
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
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="page-email">Email Address *</Label>
                      <Input
                        id="page-email"
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
                    {mode === 'test-drive' && (
                      <div>
                        <Label htmlFor="page-model">Volkswagen Model</Label>
                        <Select
                          id="page-model"
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                        >
                          {activeVehicles.map((m) => (
                            <option key={m.id} value={m.title}>
                              {m.title} ({dealershipsById[m.homeDealershipId]?.shortName ?? activeDealership.shortName})
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                  </div>

                  {mode === 'service' && (
                    <div>
                      <Label htmlFor="page-service-type">Service Type *</Label>
                      <Select
                        id="page-service-type"
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

                  {(mode === 'service' || mode === 'parts') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="sm:col-span-5">
                          <Label htmlFor="page-vin">
                            VIN Number {mode === 'service' ? '*' : '(Recommended)'}
                          </Label>
                          <Input
                            id="page-vin"
                            value={vinNumber}
                            placeholder="17-digit VAG VIN"
                            className={cn('bg-white font-mono', fieldErrors.vinNumber && ERROR_INPUT_CLASS)}
                            onChange={(e) => {
                              setVinNumber(e.target.value.toUpperCase());
                              clearError('vinNumber');
                              if (mode === 'parts') {
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
                          <Label htmlFor="page-year">
                            Year {mode === 'parts' && vinNumber.trim().length < 6 ? '*' : ''}
                          </Label>
                          <Input
                            id="page-year"
                            maxLength={4}
                            value={vehicleYear}
                            placeholder="2020"
                            className={cn('bg-white font-mono', fieldErrors.vehicleYear && ERROR_INPUT_CLASS)}
                            onChange={(e) => {
                              setVehicleYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
                              clearError('vehicleYear');
                              if (mode === 'parts') clearError('vinNumber');
                            }}
                          />
                          {fieldErrors.vehicleYear && (
                            <p className="mt-1 text-[11px] font-medium text-red-700">
                              {fieldErrors.vehicleYear}
                            </p>
                          )}
                        </div>
                        <div className="sm:col-span-5">
                          <Label htmlFor="page-vag-model">
                            Make &amp; Model {mode === 'parts' && vinNumber.trim().length < 6 ? '*' : ''}
                          </Label>
                          <Input
                            id="page-vag-model"
                            value={vehicleModel}
                            placeholder="e.g. VW Polo / Audi Q5 / Porsche"
                            className={cn('bg-white', fieldErrors.vehicleModel && ERROR_INPUT_CLASS)}
                            onChange={(e) => {
                              setVehicleModel(e.target.value);
                              clearError('vehicleModel');
                              if (mode === 'parts') clearError('vinNumber');
                            }}
                          />
                          {fieldErrors.vehicleModel && (
                            <p className="mt-1 text-[11px] font-medium text-red-700">
                              {fieldErrors.vehicleModel}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className={cn(
                          'grid grid-cols-1 gap-4',
                          mode === 'service' ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                        )}
                      >
                        <div>
                          <Label htmlFor="page-reg">
                            Vehicle Registration {mode === 'service' ? '*' : '(Optional)'}
                          </Label>
                          <Input
                            id="page-reg"
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
                        {mode === 'service' && (
                          <div>
                            <Label htmlFor="page-mileage">Current Mileage (km) *</Label>
                            <Input
                              id="page-mileage"
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
                    </div>
                  )}

                  {(mode === 'test-drive' || mode === 'service') && (
                    <div
                      className={cn(
                        'grid grid-cols-1 gap-4',
                        mode === 'test-drive' ? 'sm:grid-cols-2' : 'sm:grid-cols-1'
                      )}
                    >
                      <div>
                        <Label htmlFor="page-date">Preferred Date (Mon–Sat) *</Label>
                        <Input
                          id="page-date"
                          type="date"
                          min={todayISO}
                          value={preferredDate}
                          className={cn((fieldErrors.preferredDate || isSunday) && ERROR_INPUT_CLASS)}
                          onChange={(e) => {
                            setPreferredDate(e.target.value);
                            clearError('preferredDate');
                          }}
                        />
                        {(isSunday || fieldErrors.preferredDate) && (
                          <p className="mt-1 text-[11px] font-medium text-red-700">
                            {fieldErrors.preferredDate || 'Closed on Sundays. Select Monday to Saturday.'}
                          </p>
                        )}
                      </div>
                      {mode === 'test-drive' && (
                        <div>
                          <Label htmlFor="page-time">
                            Preferred Time {isSaturday ? '(09:00–11:00)' : '(09:00–15:00)'} *
                          </Label>
                          <Select
                            id="page-time"
                            value={preferredTime}
                            disabled={isSunday || availableTimeSlots.length === 0}
                            onChange={(e) => setPreferredTime(e.target.value)}
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
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="page-notes">
                      {mode === 'parts'
                        ? 'Required Part Description or Part Number *'
                        : 'Additional Notes'}
                    </Label>
                    <Textarea
                      id="page-notes"
                      value={notes}
                      className={cn(fieldErrors.notes && ERROR_INPUT_CLASS)}
                      placeholder={
                        mode === 'parts'
                          ? 'Describe the OEM part or accessory required...'
                          : 'Any additional details or preferences...'
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
                    disabled={(mode === 'test-drive' || mode === 'service') && isSunday}
                  >
                    {pageMeta.cta}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
