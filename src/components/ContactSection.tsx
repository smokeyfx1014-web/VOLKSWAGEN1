import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldAlert,
  Youtube,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import {
  BRANCH_SOCIAL_LINKS,
  CONTACT_CARD_ASSETS,
  GROUP_CORPORATE_INFO,
} from '../data/dealership';
import {
  generateBookingRef,
  toGoogleMapsSearchUrl,
  toIntlPhoneDisplay,
  toTelHref,
  toWhatsAppHref,
} from '../lib/utils';
import { DealershipImage } from './DealershipImage';
import { FadeUp, SectionHeader } from './MotionPrimitives';
import { Button, Input, Label, Select, Textarea } from './ui/shadcn';

export function ContactSection() {
  const { activeDealership } = useDealership();
  const { submitLead } = useDealershipData();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('New Vehicle Sales');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmationRef, setConfirmationRef] = useState<string | null>(null);

  const mapsUrl = toGoogleMapsSearchUrl(activeDealership.physicalAddress);
  const whatsappHref = toWhatsAppHref(activeDealership.whatsappNumber, activeDealership.name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError('Please complete your name, contact number, and email address.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    const ref = generateBookingRef('ENQ', activeDealership.id);
    setError('');
    setConfirmationRef(ref);
    void submitLead({
      id: ref.toLowerCase(),
      leadType: 'contact',
      fullName: name,
      phone,
      email,
      subject: `Contact Enquiry — ${department} (${activeDealership.shortName})`,
      details: message.trim() || 'Direct contact form submission.',
      homeDealershipId: activeDealership.id,
    });
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setConfirmationRef(null);
  };

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="bg-white py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            kicker={`Visit & Connect · ${activeDealership.city}`}
            title={`${activeDealership.name} Contact Centre`}
            description={`Visit our ${activeDealership.city} showroom at ${activeDealership.physicalAddress} or connect directly with Sales, Service, Parts, or Compliance.`}
          />

          <FadeUp delay={0.08} className="flex flex-wrap items-center gap-2.5">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-4 text-xs font-semibold text-[#001E50] transition-colors hover:border-[#001E50] hover:bg-[#F8FAFC] whitespace-nowrap"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Get Directions</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#001E50] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#00437A] whitespace-nowrap"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp ({activeDealership.whatsappNumber})</span>
              </a>
            )}
            <a
              href={BRANCH_SOCIAL_LINKS[activeDealership.id].facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${activeDealership.name} on Facebook`}
              title={`${activeDealership.name} on Facebook`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#001E50] transition-colors hover:border-[#001E50] hover:bg-[#F8FAFC]"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={BRANCH_SOCIAL_LINKS[activeDealership.id].instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${activeDealership.name} on Instagram`}
              title={`${activeDealership.name} on Instagram`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#001E50] transition-colors hover:border-[#001E50] hover:bg-[#F8FAFC]"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href={BRANCH_SOCIAL_LINKS[activeDealership.id].youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${GROUP_CORPORATE_INFO.groupName} on YouTube`}
              title={`${GROUP_CORPORATE_INFO.groupName} on YouTube`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#001E50] transition-colors hover:border-[#001E50] hover:bg-[#F8FAFC]"
            >
              <Youtube className="h-4 w-4" />
            </a>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left 4 Contact Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-6">
            <FadeUp>
              <div className="flex h-full flex-col justify-between overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                <div>
                  <DealershipImage
                    asset={CONTACT_CARD_ASSETS.showroom}
                    alt={`${activeDealership.name} Showroom`}
                    className="border-b border-[#E2E8F0]"
                  />
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[#001E50]">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <h3
                        id="contact-heading"
                        className="font-display text-base font-semibold text-[#091224]"
                      >
                        Dealership Address
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                      {activeDealership.physicalAddress}
                      <br />
                      {activeDealership.city}, {activeDealership.province}
                    </p>
                  </div>
                </div>
                <div className="mx-5 mb-5 flex items-center justify-between border-t border-[#E2E8F0] pt-3 text-xs">
                  <span className="font-mono text-[#64748B]">
                    {activeDealership.postalAddress || activeDealership.domain}
                  </span>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#001E50] hover:underline"
                  >
                    Map
                  </a>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.05}>
              <div className="flex h-full flex-col justify-between overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                <div>
                  <DealershipImage
                    asset={CONTACT_CARD_ASSETS.support}
                    alt={`${activeDealership.name} Reception Switchboard`}
                    className="border-b border-[#E2E8F0]"
                  />
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[#001E50]">
                      <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <h3 className="font-display text-base font-semibold text-[#091224]">
                        Reception &amp; Compliance
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-[#475569]">
                      Sales, MasterCars, Finance (FSP {activeDealership.fspNumber}), Service &amp; Parts.
                    </p>
                  </div>
                </div>
                <div className="mx-5 mb-5 border-t border-[#E2E8F0] pt-3 space-y-1">
                  <a
                    href={toTelHref(activeDealership.receptionNumber)}
                    className="block font-mono text-base font-semibold text-[#001E50] hover:underline tabular-nums"
                  >
                    {toIntlPhoneDisplay(activeDealership.receptionNumber)}
                  </a>
                  <a
                    href={`mailto:${activeDealership.email}`}
                    className="inline-flex items-center gap-1.5 text-xs text-[#475569] hover:text-[#001E50]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{activeDealership.email}</span>
                  </a>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <div className="flex h-full flex-col justify-between overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                <div>
                  <DealershipImage
                    asset={CONTACT_CARD_ASSETS.financeTeam}
                    alt={`${activeDealership.name} Sales & Finance Specialists`}
                    className="border-b border-[#E2E8F0]"
                  />
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-[#001E50]">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <h3 className="font-display text-base font-semibold text-[#091224]">
                        Branch Trading Hours
                      </h3>
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div>
                        <dt className="text-[#475569] font-medium">Sales Showroom</dt>
                        <dd className="font-mono text-[#091224] mt-0.5">
                          {activeDealership.salesHours}
                        </dd>
                      </div>
                      <div className="pt-1 border-t border-[#E2E8F0]">
                        <dt className="text-[#475569] font-medium">Service &amp; Parts</dt>
                        <dd className="font-mono text-[#091224] mt-0.5">
                          {activeDealership.serviceHours}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.15}>
              <div className="flex h-full flex-col justify-between overflow-hidden rounded-xl border border-[#001E50]/20 bg-[#001E50] text-white">
                <div>
                  <DealershipImage
                    asset={CONTACT_CARD_ASSETS.vwAlert}
                    alt="VW National Assistance Numbers"
                    className="border-b border-white/15"
                  />
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-white">
                      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <h3 className="font-display text-base font-semibold">
                        24/7 VW Alert &amp; National Care
                      </h3>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/80">
                      VW Financial Services: {activeDealership.vwFinancialServices}
                      <br />
                      VolkswagenSure: {activeDealership.volkswagensure}
                    </p>
                  </div>
                </div>
                <div className="mx-5 mb-5 border-t border-white/15 pt-3 space-y-1">
                  <a
                    href={toTelHref(activeDealership.roadsideAssist)}
                    className="block font-mono text-base font-semibold tracking-tight text-white hover:underline tabular-nums"
                  >
                    {activeDealership.roadsideAssist} · {GROUP_CORPORATE_INFO.vwRoadsideTollFree}
                  </a>
                  <p className="font-mono text-[11px] text-white/70 tabular-nums">
                    Cross-border: {GROUP_CORPORATE_INFO.vwRoadsideCrossBorder}
                  </p>
                </div>
              </div>
            </FadeUp>
          </div>

          {/* Right Direct Inquiry Form */}
          <FadeUp delay={0.1} className="lg:col-span-6">
            <div className="h-full rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-xs">
              {confirmationRef ? (
                <div className="flex h-full flex-col items-start justify-center py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#001E50]/10 text-[#001E50]">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-semibold text-[#091224]">
                    Message received by {activeDealership.shortName} ({department})
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                    Thank you, {name}. A {activeDealership.name} specialist will reach out to you on{' '}
                    <span className="font-mono text-[#091224]">{phone}</span> shortly.
                  </p>
                  <div className="mt-5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs font-mono text-[#091224]">
                    Reference: {confirmationRef}
                  </div>
                  <Button variant="outline" size="md" className="mt-6" onClick={resetForm}>
                    Send Another Enquiry
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[#091224]">
                      Message {activeDealership.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#475569]">
                      Select your preferred department and our {activeDealership.city} team will respond promptly.
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="contact-name">Full Name</Label>
                      <Input
                        id="contact-name"
                        placeholder="e.g. Thabo Mkhize"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-phone">Mobile Number</Label>
                      <Input
                        id="contact-phone"
                        type="tel"
                        placeholder="e.g. 082 555 0148"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="contact-email">Email Address</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="you@example.co.za"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-dept">Department</Label>
                      <Select
                        id="contact-dept"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      >
                        <option>New Vehicle Sales</option>
                        <option>MasterCars Pre-Owned</option>
                        <option>Finance & Insurance</option>
                        <option>Approved Service Centre</option>
                        <option>Genuine Parts Counter</option>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="contact-message">How can we assist you?</Label>
                    <Textarea
                      id="contact-message"
                      placeholder="Specify model interest, trade-in details, or service question..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <p className="text-[11px] text-[#64748B]">
                      Processed by {activeDealership.legalEntity} in compliance with POPIA.
                    </p>
                    <Button type="submit" size="lg">
                      Submit Enquiry
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </FadeUp>
        </div>

        {/* Dynamic Branch Google Map Embed */}
        {activeDealership.mapEmbedUrl && (
          <FadeUp delay={0.12}>
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-6 py-4 bg-white">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#091224]">
                  <MapPin className="h-4 w-4 text-[#001E50]" />
                  <span>
                    {activeDealership.name} — {activeDealership.physicalAddress}
                  </span>
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#00437A] hover:underline inline-flex items-center gap-1"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <iframe
                title={`${activeDealership.name} Location Map`}
                src={activeDealership.mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-72 sm:h-80 w-full border-0"
              />
            </div>
          </FadeUp>
        )}
      </div>
    </section>
  );
}
