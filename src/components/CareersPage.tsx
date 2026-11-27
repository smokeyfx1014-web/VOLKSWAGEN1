import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { CareerDocKind, uploadCareerDocument } from '../lib/careerUpload';
import { CareerDocumentRef, CmsJobOpening } from '../types/dealership';
import { SectionHeader } from './MotionPrimitives';
import { Button, Dialog, Input, Label, Select, Textarea } from './ui/shadcn';

function sanitizeExternalApplyUrl(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CareersPage() {
  const { activeDealership, activeDealerships, dealershipsById, groupProfile } = useDealership();
  const { activeJobs, loadingCatalog, submitJobApplication } = useDealershipData();

  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');

  const [applyingJob, setApplyingJob] = useState<CmsJobOpening | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [cityOrSuburb, setCityOrSuburb] = useState('');
  const [highestQualification, setHighestQualification] = useState('');
  const [yearsExperience, setYearsExperience] = useState('2');
  const [driversLicenceCode, setDriversLicenceCode] = useState('');
  const [coverNote, setCoverNote] = useState('');

  const [resumeDoc, setResumeDoc] = useState<CareerDocumentRef | null>(null);
  const [qualificationDoc, setQualificationDoc] = useState<CareerDocumentRef | null>(null);
  const [idCopyDoc, setIdCopyDoc] = useState<CareerDocumentRef | null>(null);
  const [licenceDoc, setLicenceDoc] = useState<CareerDocumentRef | null>(null);

  const [uploadingSlot, setUploadingSlot] = useState<CareerDocKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<{ id: string; jobTitle: string } | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const j of activeJobs) {
      if (j.department) set.add(j.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeJobs]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeJobs.filter((job) => {
      if (branchFilter === 'MASTER' && job.dealershipId !== null) return false;
      if (branchFilter !== 'All' && branchFilter !== 'MASTER' && job.dealershipId !== branchFilter) {
        return false;
      }
      if (departmentFilter !== 'All' && job.department !== departmentFilter) return false;
      if (q) {
        const hay = `${job.title} ${job.department} ${job.locationLabel} ${job.summary} ${job.requirements}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeJobs, branchFilter, departmentFilter, searchQuery]);

  const resetApplicationModal = () => {
    setApplyingJob(null);
    setFormError(null);
    setSubmitting(false);
    setSubmittedRef(null);
    setResumeDoc(null);
    setQualificationDoc(null);
    setIdCopyDoc(null);
    setLicenceDoc(null);
  };

  const openInternalModal = (job: CmsJobOpening) => {
    setApplyingJob(job);
    setFormError(null);
    setSubmittedRef(null);
    setResumeDoc(null);
    setQualificationDoc(null);
    setIdCopyDoc(null);
    setLicenceDoc(null);
  };

  const handleFileUpload = async (slot: CareerDocKind, file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    setUploadingSlot(slot);
    try {
      const uploaded = await uploadCareerDocument(file, slot);
      if (slot === 'resume') setResumeDoc(uploaded);
      if (slot === 'qualification') setQualificationDoc(uploaded);
      if (slot === 'idCopy') setIdCopyDoc(uploaded);
      if (slot === 'licence') setLicenceDoc(uploaded);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to upload selected supporting document.'
      );
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJob) return;
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError('Please enter your full legal name.');
      return;
    }
    if (!email.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (phone.trim().length < 7) {
      setFormError('Please enter a valid contact phone number.');
      return;
    }
    if (idNumber.trim().length < 6) {
      setFormError('Please provide your South African ID or Passport number.');
      return;
    }
    if (cityOrSuburb.trim().length < 2) {
      setFormError('Please enter your city or suburb.');
      return;
    }
    if (highestQualification.trim().length < 2) {
      setFormError('Please specify your highest qualification.');
      return;
    }
    if (!resumeDoc) {
      setFormError('Please upload your Resume / CV before submitting.');
      return;
    }
    if (!qualificationDoc) {
      setFormError('Please upload your Qualification Certificates before submitting.');
      return;
    }
    if (!idCopyDoc) {
      setFormError('Please upload a certified/clear Copy of your ID or Passport.');
      return;
    }
    if (applyingJob.requiresLicence) {
      if (!driversLicenceCode.trim()) {
        setFormError('Please specify your driver or trade licence code required for this role.');
        return;
      }
      if (!licenceDoc) {
        setFormError(
          `Please upload a copy of your required ${applyingJob.licenceDescription || "Driver's / Trade Licence"}.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const applicationId = await submitJobApplication({
        jobId: applyingJob.id,
        jobTitle: applyingJob.title,
        branchId: applyingJob.dealershipId ?? null,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        idNumber: idNumber.trim(),
        cityOrSuburb: cityOrSuburb.trim(),
        yearsExperience: Number(yearsExperience || 0),
        highestQualification: highestQualification.trim(),
        driversLicenceCode: driversLicenceCode.trim(),
        coverNote: coverNote.trim(),
        resumeDoc,
        qualificationDoc,
        idCopyDoc,
        licenceDoc: licenceDoc ?? null,
      });
      setSubmittedRef({ id: applicationId, jobTitle: applyingJob.title });
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to submit your application right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderUploadSlot = (
    slot: CareerDocKind,
    label: string,
    hint: string,
    required: boolean,
    docValue: CareerDocumentRef | null,
    onClear: () => void
  ) => (
    <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#091224]">
            {label}{' '}
            <span className={required ? 'text-red-600' : 'text-[#64748B] font-normal'}>
              {required ? '*' : '(Optional)'}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#64748B]">{hint}</p>
        </div>
        {docValue ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span>Replace</span>
          </button>
        ) : (
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#001E50]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#001E50] hover:bg-[#001E50] hover:text-white transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>{uploadingSlot === slot ? 'Uploading...' : 'Select File'}</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              disabled={uploadingSlot !== null}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                void handleFileUpload(slot, f);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {docValue && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <FileCheck2 className="h-4 w-4 text-emerald-700 shrink-0" />
          <span className="truncate font-medium flex-1">{docValue.fileName}</span>
          <span className="font-mono text-[11px] text-emerald-700 shrink-0">
            {formatBytes(docValue.sizeBytes)}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-[#F8FAFC] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            kicker={`Careers at ${groupProfile.groupName}`}
            title="Automotive Career Opportunities"
            description={`Join ${activeDealership.legalEntity} across our Volkswagen sales showrooms, Approved Workshops, Parts Centres, and F&I departments. Apply directly online or follow verified external manufacturer portals where specified.`}
          />

          <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#475569] shrink-0">
            <p className="font-semibold text-[#091224] flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#00437A]" />
              <span>Protected Applicant Document Handling</span>
            </p>
            <p className="mt-1">
              Uploaded CVs, ID copies, qualifications &amp; licences are stored strictly for hiring review.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-center">
            <div className="sm:col-span-5 relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search role title, skills, or location..."
                className="pl-10"
              />
            </div>

            <div className="sm:col-span-4">
              <Select
                aria-label="Filter jobs by dealership branch"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="All">All Locations &amp; Branches</option>
                <option value="MASTER">Group-Wide / External Programmes</option>
                {activeDealerships.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-3">
              <Select
                aria-label="Filter jobs by department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Job Listings */}
        {loadingCatalog && filteredJobs.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-72 rounded-2xl border border-[#E2E8F0] bg-white animate-pulse"
              />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center">
            <Briefcase className="mx-auto h-9 w-9 text-[#00437A]/60" />
            <h3 className="mt-3 font-display text-xl font-semibold text-[#091224]">
              No matching open positions right now
            </h3>
            <p className="mt-2 text-sm text-[#64748B]">
              Check back soon for new sales, workshop, parts, and finance vacancies across{' '}
              {groupProfile.groupName}.
            </p>
            {(searchQuery || branchFilter !== 'All' || departmentFilter !== 'All') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setBranchFilter('All');
                  setDepartmentFilter('All');
                }}
              >
                Reset Career Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {filteredJobs.map((job) => {
              const branchLabel =
                job.dealershipId === null
                  ? `${groupProfile.groupName} Group`
                  : dealershipsById[job.dealershipId]?.name ?? job.locationLabel;
              const safeExternalUrl = sanitizeExternalApplyUrl(job.externalApplyUrl);
              const isExternal = job.applicationMode === 'external' && Boolean(safeExternalUrl);

              return (
                <motion.article
                  key={job.id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <div>
                    {/* Clean Zero-Pill Metadata */}
                    <p className="font-mono text-xs text-[#00437A] font-semibold">
                      {job.department} · {job.employmentType} · Closes {job.closingDate}
                    </p>

                    <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#091224]">
                      {job.title}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475569]">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-[#00437A]" />
                        {branchLabel}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#00437A]" />
                        {job.locationLabel}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[#334155]">{job.summary}</p>

                    <div className="mt-4 space-y-2 border-t border-[#E2E8F0] pt-4 text-xs text-[#475569]">
                      <div>
                        <span className="font-semibold text-[#091224]">Key Requirements: </span>
                        <span>{job.requirements}</span>
                      </div>
                      {job.responsibilities && (
                        <div>
                          <span className="font-semibold text-[#091224]">Responsibilities: </span>
                          <span>{job.responsibilities}</span>
                        </div>
                      )}
                      <div className="pt-1 flex items-start gap-1.5 text-[#001E50]">
                        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {isExternal
                            ? 'Application handled via verified external recruitment link.'
                            : `Required on-site documents: Resume/CV, Qualification Certificates, Copy of ID${
                                job.requiresLicence
                                  ? `, and ${job.licenceDescription || "Valid Driver's / Trade Licence"}`
                                  : ' (Optional licence if applicable)'
                              }.`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
                    <span className="text-[11px] font-medium text-[#64748B]">
                      {isExternal ? 'External Source Application' : 'Direct On-Site Application'}
                    </span>

                    {isExternal ? (
                      <a
                        href={safeExternalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#001E50] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#00437A] whitespace-nowrap shrink-0"
                      >
                        <span>Apply on External Portal</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <Button variant="primary" size="sm" onClick={() => openInternalModal(job)}>
                        <span>Apply Now</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      {/* On-Site Career Application Modal */}
      {applyingJob && (
        <Dialog
          open
          onClose={resetApplicationModal}
          title={
            submittedRef
              ? 'Application Submitted Successfully'
              : `Apply: ${applyingJob.title}`
          }
          subtitle={
            submittedRef
              ? `${applyingJob.department} · ${applyingJob.locationLabel}`
              : `${
                  applyingJob.dealershipId === null
                    ? groupProfile.groupName
                    : dealershipsById[applyingJob.dealershipId]?.name ?? applyingJob.locationLabel
                } · Closing Date: ${applyingJob.closingDate}`
          }
          maxWidthClass="max-w-2xl"
        >
          {submittedRef ? (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-[#091224]">
                  Thank you for applying, {fullName}!
                </h3>
                <p className="mt-2 text-sm text-[#475569]">
                  Your application and uploaded supporting documents for{' '}
                  <strong>{submittedRef.jobTitle}</strong> have been securely recorded for{' '}
                  {groupProfile.groupName} HR &amp; Management review.
                </p>
                <p className="mt-3 font-mono text-xs text-[#64748B]">
                  Reference ID: {submittedRef.id}
                </p>
              </div>
              <Button variant="primary" onClick={resetApplicationModal}>
                Return to Career Opportunities
              </Button>
            </div>
          ) : (
            <form onSubmit={handleApplicationSubmit} className="space-y-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full Legal Name *</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Thabo Mkhize"
                    required
                  />
                </div>
                <div>
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.co.za"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Phone / WhatsApp Number *</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="082 123 4567"
                    required
                  />
                </div>
                <div>
                  <Label>SA ID / Passport Number *</Label>
                  <Input
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="13-digit SA ID or Passport"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>City / Suburb *</Label>
                  <Input
                    value={cityOrSuburb}
                    onChange={(e) => setCityOrSuburb(e.target.value)}
                    placeholder="e.g. Newcastle"
                    required
                  />
                </div>
                <div>
                  <Label>Highest Qualification *</Label>
                  <Input
                    value={highestQualification}
                    onChange={(e) => setHighestQualification(e.target.value)}
                    placeholder="Matric / N4 / Red Seal / BCom"
                    required
                  />
                </div>
                <div>
                  <Label>Years Experience *</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>
                  Driver&apos;s / Trade Licence Details{' '}
                  {applyingJob.requiresLicence ? '*' : '(Optional)'}
                </Label>
                <Input
                  value={driversLicenceCode}
                  onChange={(e) => setDriversLicenceCode(e.target.value)}
                  placeholder={
                    applyingJob.licenceDescription ||
                    'e.g. Unendorsed Code 8 (B) / Code 10 / Red Seal Trade No.'
                  }
                  required={applyingJob.requiresLicence}
                />
              </div>

              <div>
                <Label>Cover Note / Motivation (Optional)</Label>
                <Textarea
                  rows={3}
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="Briefly highlight relevant Volkswagen, motor retail, technical, or customer experience..."
                />
              </div>

              {/* Document Upload Section */}
              <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
                <div>
                  <h4 className="font-display text-sm font-semibold text-[#091224]">
                    Supporting Documents (PDF, DOC, DOCX, PNG, JPG, WebP · Max 10 MB each)
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Files are stored privately for HR review only and never published publicly.
                  </p>
                </div>

                {renderUploadSlot(
                  'resume',
                  'Resume / Curriculum Vitae (CV)',
                  'Upload your latest detailed CV.',
                  true,
                  resumeDoc,
                  () => setResumeDoc(null)
                )}

                {renderUploadSlot(
                  'qualification',
                  'Qualifications & Academic Certificates',
                  'Matric certificate, diploma, trade certificate, or OEM transcripts.',
                  true,
                  qualificationDoc,
                  () => setQualificationDoc(null)
                )}

                {renderUploadSlot(
                  'idCopy',
                  'Copy of ID / Passport',
                  'Clear scan or photo of your valid South African ID or Passport.',
                  true,
                  idCopyDoc,
                  () => setIdCopyDoc(null)
                )}

                {renderUploadSlot(
                  'licence',
                  applyingJob.licenceDescription || "Driver's Licence / Relevant Licence",
                  applyingJob.requiresLicence
                    ? `Required for this position: ${applyingJob.licenceDescription || "Valid Driver's / Trade Licence"}.`
                    : "Upload driver's licence or relevant occupational licence if applicable.",
                  applyingJob.requiresLicence,
                  licenceDoc,
                  () => setLicenceDoc(null)
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                <Button type="button" variant="ghost" onClick={resetApplicationModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || uploadingSlot !== null}>
                  <span>{submitting ? 'Submitting Application...' : 'Submit Application'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}
    </div>
  );
}
