import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  FileText,
  Link2,
  Mail,
  MapPin,
  RefreshCw,
  Send,
} from 'lucide-react';
import { deriveBranchCareersEmail } from '../lib/careerEmail';
import {
  CareerDocPreviewResult,
  downloadProtectedCareerDoc,
  fetchProtectedCareerDocPreview,
} from '../lib/careerUpload';
import {
  CmsJobApplication,
  DealershipRecord,
  JobApplicationStatus,
} from '../types/dealership';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import { Button, Dialog, Input, Label, Select, Textarea } from './ui/shadcn';

export interface ActiveCareerDocPreviewTarget {
  url: string;
  fileName: string;
  mimeType: string;
  docLabel: string;
  applicantName: string;
}

interface CareerDocumentViewerModalProps {
  open: boolean;
  target: ActiveCareerDocPreviewTarget | null;
  user: User | null;
  onClose: () => void;
  onError: (message: string) => void;
}

export function CareerDocumentViewerModal({
  open,
  target,
  user,
  onClose,
  onError,
}: CareerDocumentViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CareerDocPreviewResult | null>(null);

  useEffect(() => {
    if (!open || !target) {
      setPreview(null);
      setPreviewError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let activeBlobUrl: string | null = null;

    setLoading(true);
    setPreviewError(null);
    setPreview(null);

    fetchProtectedCareerDocPreview(target.url, target.fileName, target.mimeType, user)
      .then((result) => {
        if (cancelled) {
          if (result.kind === 'image') {
            URL.revokeObjectURL(result.blobUrl);
          }
          return;
        }
        if (result.kind === 'image') {
          activeBlobUrl = result.blobUrl;
        }
        setPreview(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unable to load document preview.';
        setPreviewError(msg);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [open, target, user]);

  if (!open || !target) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadProtectedCareerDoc(target.url, target.fileName, user);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to download applicant document.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${target.docLabel} — ${target.applicantName}`}
      subtitle={`Viewing "${target.fileName}" directly in browser without downloading`}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-[#334155]">
            <FileText className="h-4 w-4 text-[#00437A]" />
            <span className="font-semibold text-[#091224]">{target.fileName}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => void handleDownload()}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloading ? 'Downloading...' : 'Download Copy'}</span>
          </Button>
        </div>

        {loading && (
          <div className="flex h-[56vh] items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#475569]">
            Loading secure inline document preview...
          </div>
        )}

        {!loading && previewError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>Preview Unavailable</span>
            </div>
            <p className="text-xs leading-relaxed">{previewError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleDownload()}>
              <Download className="h-3.5 w-3.5" />
              <span>Download Copy Instead</span>
            </Button>
          </div>
        )}

        {!loading && !previewError && preview?.kind === 'pdf' && (
          <PdfCanvasViewer pdfBytes={preview.pdfBytes} fileName={preview.fileName} />
        )}

        {!loading && !previewError && preview?.kind === 'image' && (
          <div className="flex max-h-[68vh] items-center justify-center overflow-auto rounded-xl border border-[#CBD5E1] bg-[#0F172A]/5 p-4">
            <img
              src={preview.blobUrl}
              alt={`${target.docLabel} for ${target.applicantName}`}
              className="max-h-[62vh] w-auto rounded-lg object-contain shadow-sm"
            />
          </div>
        )}

        {!loading && !previewError && preview?.kind === 'text' && (
          <div className="max-h-[64vh] overflow-y-auto rounded-xl border border-[#CBD5E1] bg-white p-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Extracted Document Text (.docx Preview)
            </p>
            <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#0F172A]">
              {preview.text || '(No readable text detected inside this .docx file.)'}
            </div>
          </div>
        )}

        {!loading && !previewError && preview?.kind === 'unsupported' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 space-y-3">
            <p className="font-semibold">Inline Browser Preview Not Supported for This File Type</p>
            <p className="text-xs leading-relaxed">{preview.reason}</p>
            <Button type="button" size="sm" onClick={() => void handleDownload()}>
              <Download className="h-3.5 w-3.5" />
              <span>Download Copy</span>
            </Button>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close Viewer
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

interface CandidateStatusEmailModalProps {
  open: boolean;
  application: CmsJobApplication | null;
  initialStatus: JobApplicationStatus;
  groupName: string;
  defaultBranchId: string;
  dealershipsById: Record<string, DealershipRecord>;
  user: User | null;
  onConfirmStatus: (applicationId: string, status: JobApplicationStatus) => Promise<void>;
  onClose: () => void;
  onSuccessFlash: (message: string) => void;
  onError: (message: string) => void;
}

const STATUS_LABELS: Record<JobApplicationStatus, string> = {
  new: 'New Application',
  shortlisted: 'Shortlisted',
  interview: 'Interview Scheduled',
  rejected: 'Unsuccessful / Declined',
  archived: 'Archived',
};

function buildCandidateDraft(params: {
  status: JobApplicationStatus;
  candidateName: string;
  jobTitle: string;
  branchName: string;
  careersEmail: string;
  aptitudeTestUrl: string;
  interviewDate: string;
  interviewTime: string;
  interviewLocation: string;
  interviewerContact: string;
}): { subject: string; body: string } {
  const {
    status,
    candidateName,
    jobTitle,
    branchName,
    careersEmail,
    aptitudeTestUrl,
    interviewDate,
    interviewTime,
    interviewLocation,
    interviewerContact,
  } = params;

  if (status === 'shortlisted') {
    const cleanUrl = aptitudeTestUrl.trim();
    const testLine = cleanUrl
      ? `As the next step in our selection process, please complete the online aptitude / pre-interview assessment using the link below:\n${cleanUrl}\n\nPlease complete this assessment at your earliest convenience so our hiring team can finalise interview scheduling.`
      : 'Our recruitment team will follow up shortly with the next steps regarding assessment or interview scheduling.';

    return {
      subject: `[${branchName}] Shortlisted: ${jobTitle} Application`,
      body: [
        `Dear ${candidateName},`,
        '',
        `Congratulations — following our review of your application for the ${jobTitle} position at ${branchName}, we are pleased to inform you that you have been shortlisted for the next stage.`,
        '',
        testLine,
        '',
        `If you have any questions, please reply directly to ${careersEmail}.`,
        '',
        'Kind regards,',
        `Recruitment Team · ${branchName}`,
      ].join('\n'),
    };
  }

  if (status === 'interview') {
    const dateLine = interviewDate.trim() || '[Insert Interview Date]';
    const timeLine = interviewTime.trim() || '[Insert Interview Time]';
    const locationLine = interviewLocation.trim() || branchName;
    const contactLine = interviewerContact.trim();

    return {
      subject: `[${branchName}] Interview Invitation: ${jobTitle}`,
      body: [
        `Dear ${candidateName},`,
        '',
        `We are pleased to invite you to an interview for the ${jobTitle} position at ${branchName}.`,
        '',
        'Interview Details:',
        `- Date: ${dateLine}`,
        `- Time: ${timeLine}`,
        `- Location: ${locationLine}`,
        ...(contactLine ? [`- Contact / Panel: ${contactLine}`] : []),
        '',
        'Please bring your original ID, driver’s licence (if applicable), and certified copies of your qualifications.',
        `Kindly reply to ${careersEmail} to confirm your attendance.`,
        '',
        'Kind regards,',
        `Recruitment Team · ${branchName}`,
      ].join('\n'),
    };
  }

  if (status === 'rejected') {
    return {
      subject: `[${branchName}] Update on your ${jobTitle} application`,
      body: [
        `Dear ${candidateName},`,
        '',
        `Thank you for taking the time to apply for the ${jobTitle} role at ${branchName}.`,
        '',
        'After careful consideration of all applications received, we regret to inform you that your application has not been selected to move forward on this occasion. We will keep your details in consideration should a matching opportunity arise in the future.',
        '',
        `Wishing you every success in your career search.`,
        '',
        'Kind regards,',
        `Recruitment Team · ${branchName}`,
      ].join('\n'),
    };
  }

  if (status === 'archived') {
    return {
      subject: `[${branchName}] Status Update: ${jobTitle} application`,
      body: [
        `Dear ${candidateName},`,
        '',
        `This is an update to let you know that your application for ${jobTitle} at ${branchName} has been archived in our recruitment records.`,
        '',
        `If you have any questions, please contact ${careersEmail}.`,
        '',
        'Kind regards,',
        `Recruitment Team · ${branchName}`,
      ].join('\n'),
    };
  }

  return {
    subject: `[${branchName}] Application Received: ${jobTitle}`,
    body: [
      `Dear ${candidateName},`,
      '',
      `Thank you for applying for the ${jobTitle} position at ${branchName}. Your application is active and under review by our recruitment team.`,
      '',
      `We will keep you updated via ${careersEmail} as our review progresses.`,
      '',
      'Kind regards,',
      `Recruitment Team · ${branchName}`,
    ].join('\n'),
  };
}

export function CandidateStatusEmailModal({
  open,
  application,
  initialStatus,
  groupName,
  defaultBranchId,
  dealershipsById,
  user,
  onConfirmStatus,
  onClose,
  onSuccessFlash,
  onError,
}: CandidateStatusEmailModalProps) {
  const effectiveBranch = useMemo(() => {
    if (!application) return null;
    if (application.branchId && dealershipsById[application.branchId]) {
      return dealershipsById[application.branchId];
    }
    return dealershipsById[defaultBranchId] ?? Object.values(dealershipsById)[0] ?? null;
  }, [application, dealershipsById, defaultBranchId]);

  const branchName = effectiveBranch?.name || `${groupName} Careers`;
  const careersEmail = useMemo(
    () => deriveBranchCareersEmail(effectiveBranch),
    [effectiveBranch]
  );
  const defaultLocation = effectiveBranch
    ? `${effectiveBranch.name}${effectiveBranch.physicalAddress ? `, ${effectiveBranch.physicalAddress}` : ''}`
    : '';

  const [status, setStatus] = useState<JobApplicationStatus>(initialStatus);
  const [aptitudeTestUrl, setAptitudeTestUrl] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('09:00');
  const [interviewLocation, setInterviewLocation] = useState(defaultLocation);
  const [interviewerContact, setInterviewerContact] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [hasManualEdit, setHasManualEdit] = useState(false);
  const [sendEmailNotification, setSendEmailNotification] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !application) return;
    setStatus(initialStatus);
    setAptitudeTestUrl('');
    setInterviewDate('');
    setInterviewTime('09:00');
    setInterviewLocation(defaultLocation);
    setInterviewerContact('');
    setHasManualEdit(false);
    setSendEmailNotification(true);
    setLocalError(null);

    const draft = buildCandidateDraft({
      status: initialStatus,
      candidateName: application.fullName,
      jobTitle: application.jobTitle,
      branchName,
      careersEmail,
      aptitudeTestUrl: '',
      interviewDate: '',
      interviewTime: '09:00',
      interviewLocation: defaultLocation,
      interviewerContact: '',
    });
    setSubject(draft.subject);
    setMessageBody(draft.body);
  }, [open, application, initialStatus, branchName, careersEmail, defaultLocation]);

  useEffect(() => {
    if (!open || !application || hasManualEdit) return;
    const draft = buildCandidateDraft({
      status,
      candidateName: application.fullName,
      jobTitle: application.jobTitle,
      branchName,
      careersEmail,
      aptitudeTestUrl,
      interviewDate,
      interviewTime,
      interviewLocation,
      interviewerContact,
    });
    setSubject(draft.subject);
    setMessageBody(draft.body);
  }, [
    open,
    application,
    status,
    branchName,
    careersEmail,
    aptitudeTestUrl,
    interviewDate,
    interviewTime,
    interviewLocation,
    interviewerContact,
    hasManualEdit,
  ]);

  if (!open || !application) return null;

  const handleResetTemplate = () => {
    setHasManualEdit(false);
    const draft = buildCandidateDraft({
      status,
      candidateName: application.fullName,
      jobTitle: application.jobTitle,
      branchName,
      careersEmail,
      aptitudeTestUrl,
      interviewDate,
      interviewTime,
      interviewLocation,
      interviewerContact,
    });
    setSubject(draft.subject);
    setMessageBody(draft.body);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (sendEmailNotification) {
      if (!subject.trim() || !messageBody.trim()) {
        setLocalError('Email subject and message draft are required before sending.');
        return;
      }
      if (status === 'shortlisted' && aptitudeTestUrl.trim()) {
        try {
          const parsed = new URL(aptitudeTestUrl.trim());
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            setLocalError('Aptitude test link must begin with https:// or http://.');
            return;
          }
        } catch {
          setLocalError('Please enter a valid web URL for the aptitude test link.');
          return;
        }
      }
      if (status === 'interview' && (!interviewDate.trim() || !interviewTime.trim() || !interviewLocation.trim())) {
        setLocalError('Please specify Interview Date, Time, and Location before sending an interview invitation.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onConfirmStatus(application.id, status);

      if (!sendEmailNotification) {
        onSuccessFlash(
          `Updated ${application.fullName} to "${STATUS_LABELS[status]}" (email skipped).`
        );
        onClose();
        return;
      }

      if (!user) {
        onSuccessFlash(
          `Status updated to "${STATUS_LABELS[status]}", but admin session token is missing to send email.`
        );
        onClose();
        return;
      }

      const idToken = await user.getIdToken();
      const response = await fetch('/api/career-status-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          candidateEmail: application.email,
          candidateName: application.fullName,
          jobTitle: application.jobTitle,
          status,
          branchId: application.branchId || defaultBranchId || '1',
          subject: subject.trim(),
          messageBody: messageBody.trim(),
          aptitudeTestUrl: status === 'shortlisted' ? aptitudeTestUrl.trim() : '',
          interviewDate: status === 'interview' ? interviewDate.trim() : '',
          interviewTime: status === 'interview' ? interviewTime.trim() : '',
          interviewLocation: status === 'interview' ? interviewLocation.trim() : '',
          interviewerContact: status === 'interview' ? interviewerContact.trim() : '',
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        delivered?: boolean;
        skipped?: boolean;
        from?: string;
        to?: string;
        reason?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Email dispatch failed (HTTP ${response.status}).`);
      }

      if (payload.skipped) {
        onSuccessFlash(
          `Saved status "${STATUS_LABELS[status]}" for ${application.fullName}. Email not sent yet: ${payload.reason}`
        );
      } else {
        onSuccessFlash(
          `Updated ${application.fullName} to "${STATUS_LABELS[status]}" and emailed from ${payload.from || careersEmail}.`
        );
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to complete candidate status update.';
      setLocalError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Candidate Status Update & Email Draft"
      subtitle={`Review and send the status notification email to ${application.fullName}`}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              From (Branch Careers)
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono font-semibold text-[#001E50]">
              <Mail className="h-3.5 w-3.5 text-[#00437A]" />
              <span>{careersEmail}</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              To Candidate
            </p>
            <p className="mt-0.5 font-semibold text-[#091224]">
              {application.fullName}{' '}
              <span className="font-mono font-normal text-[#475569]">&lt;{application.email}&gt;</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="candidate-status-select">Application Status</Label>
            <Select
              id="candidate-status-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as JobApplicationStatus);
                setHasManualEdit(false);
              }}
            >
              <option value="new">New</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview">Interview</option>
              <option value="rejected">Rejected / Unsuccessful</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div className="flex items-end justify-between gap-2 pb-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#091224] cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmailNotification}
                onChange={(e) => setSendEmailNotification(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] text-[#001E50]"
              />
              <span>Send email update to candidate</span>
            </label>
          </div>
        </div>

        {status === 'shortlisted' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-2">
            <Label htmlFor="aptitude-test-url" className="flex items-center gap-1.5 text-[#001E50]">
              <Link2 className="h-3.5 w-3.5 text-[#00437A]" />
              <span>Aptitude / Online Assessment Link (Optional)</span>
            </Label>
            <Input
              id="aptitude-test-url"
              type="url"
              value={aptitudeTestUrl}
              onChange={(e) => setAptitudeTestUrl(e.target.value)}
              placeholder="https://assessments.example.com/vw-aptitude-test"
            />
            <p className="text-[11px] text-[#334155]">
              Adding an assessment link automatically updates the candidate email draft and inserts a
              clickable Assessment button in the email.
            </p>
          </div>
        )}

        {status === 'interview' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-[#001E50]">
              Interview Schedule Details (Included in Email)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="interview-date" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#00437A]" />
                  <span>Interview Date *</span>
                </Label>
                <Input
                  id="interview-date"
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  required={sendEmailNotification}
                />
              </div>
              <div>
                <Label htmlFor="interview-time" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#00437A]" />
                  <span>Interview Time *</span>
                </Label>
                <Input
                  id="interview-time"
                  type="text"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  placeholder="09:30 AM"
                  required={sendEmailNotification}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="interview-location" className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#00437A]" />
                <span>Interview Location *</span>
              </Label>
              <Input
                id="interview-location"
                type="text"
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="Dealership street address or Microsoft Teams link"
                required={sendEmailNotification}
              />
            </div>
            <div>
              <Label htmlFor="interviewer-contact">Contact Person / Note (Optional)</Label>
              <Input
                id="interviewer-contact"
                type="text"
                value={interviewerContact}
                onChange={(e) => setInterviewerContact(e.target.value)}
                placeholder="Ask for Dealer Principal / HR at Reception"
              />
            </div>
          </div>
        )}

        {sendEmailNotification && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="candidate-email-subject" className="mb-0">
                Email Subject
              </Label>
              <button
                type="button"
                onClick={handleResetTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00437A] hover:underline cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh Draft Template</span>
              </button>
            </div>
            <Input
              id="candidate-email-subject"
              value={subject}
              onChange={(e) => {
                setHasManualEdit(true);
                setSubject(e.target.value);
              }}
              required
            />

            <div>
              <Label htmlFor="candidate-email-body">Message Draft (Editable Before Sending)</Label>
              <Textarea
                id="candidate-email-body"
                rows={9}
                value={messageBody}
                onChange={(e) => {
                  setHasManualEdit(true);
                  setMessageBody(e.target.value);
                }}
                className="font-sans text-xs leading-relaxed"
                required
              />
            </div>
          </div>
        )}

        {localError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
            {localError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E2E8F0] pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            <Send className="h-3.5 w-3.5" />
            <span>
              {submitting
                ? 'Saving & Sending...'
                : sendEmailNotification
                ? 'Save Status & Send Email'
                : 'Save Status Only'}
            </span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
