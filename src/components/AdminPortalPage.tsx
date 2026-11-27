import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Briefcase,
  Building2,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Film,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Newspaper,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { useDealership, isValidBranchIdFormat } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { DEALERSHIP_IMAGE_LIBRARY } from '../data/dealership';
import { downloadProtectedCareerDoc } from '../lib/careerUpload';
import {
  LeadInboxSection,
  formatLeadTypeBadge,
  isSpotterLead,
  matchesLeadInboxSection,
} from '../lib/leadFilters';
import {
  MediaUploadCategory,
  UploadedMediaType,
  isVideoMedia,
  uploadDealershipMedia,
} from '../lib/mediaUpload';
import { cn, formatZAR, toGoogleMapsEmbedUrl, toWhatsAppMessageHref } from '../lib/utils';
import {
  AutoTraderSyncReport,
  CmsJobApplication,
  CmsJobOpening,
  CmsLeadSubmission,
  CmsNewsArticle,
  CmsPromotion,
  CmsVehicle,
  DealershipGroupProfile,
  DealershipId,
  DealershipRecord,
  JobApplicationMode,
  JobApplicationStatus,
  JobEmploymentType,
  PromotionScope,
  PromotionType,
  StaffRole,
  StaffUserProfile,
  SystemStatusResponse,
  VehicleStatus,
} from '../types/dealership';
import {
  ActiveCareerDocPreviewTarget,
  CandidateStatusEmailModal,
  CareerDocumentViewerModal,
} from './CareerReviewModals';
import { ItEscalationCenter, formatCountdown } from './ItEscalationCenter';
import { PromotionMedia } from './PromotionMedia';
import { SmtpPresetSelection, SmtpSetupGuideModal } from './SmtpSetupGuideModal';
import { SystemHandoverManualModal } from './SystemHandoverManualModal';
import { Button, Dialog, Input, Label, Select, Textarea } from './ui/shadcn';

type AdminTab =
  | 'overview'
  | 'vehicles'
  | 'promotions'
  | 'users'
  | 'branches'
  | 'news'
  | 'careers'
  | 'leads'
  | 'it-tickets';
type VisibilityChoice = 'MASTER' | DealershipId;

const STAFF_ROLE_META: Record<
  StaffRole,
  {
    label: string;
    shortLabel: string;
    scopeSummary: string;
    permissionsNote: string;
    badgeClass: string;
    branchRequired: boolean;
  }
> = {
  admin: {
    label: 'Group Administrator',
    shortLabel: 'Group Admin',
    scopeSummary: 'Full group access + all branches & staff',
    permissionsNote:
      'Manage all staff accounts, corporate group settings, branches, AutoTrader inventory, promotions, news, careers, IT escalations, and all customer leads.',
    badgeClass: 'bg-[#001E50] text-white',
    branchRequired: false,
  },
  branch_admin: {
    label: 'Branch Admin (Dealer Principal)',
    shortLabel: 'Branch Admin',
    scopeSummary: 'Full operations for allocated branch',
    permissionsNote:
      'Manage all vehicle stock, branch specials/events/competitions, all branch customer leads, branch career applications, branch staff roster, and branch IT tickets.',
    badgeClass: 'bg-sky-100 text-[#001E50] border border-sky-300',
    branchRequired: true,
  },
  it_manager: {
    label: 'IT Manager',
    shortLabel: 'IT Manager',
    scopeSummary: 'Group-wide technical admin & IT ticket approvals',
    permissionsNote:
      'Manage group branches, SMTP email setup, AutoTrader feeds, operational staff (non-admin), and approve, resolve, reject, or revoke IT Agent role-escalation tickets.',
    badgeClass: 'bg-violet-50 text-violet-900 border border-violet-200',
    branchRequired: false,
  },
  it_agent: {
    label: 'Branch IT Agent',
    shortLabel: 'IT Agent',
    scopeSummary: 'Branch IT support + timed escalation tickets',
    permissionsNote:
      'View branch SMTP & operational overview and submit timed role-escalation tickets to the IT Manager when elevated access is needed.',
    badgeClass: 'bg-cyan-50 text-cyan-900 border border-cyan-200',
    branchRequired: true,
  },
  agent: {
    label: 'Car Sales Executive',
    shortLabel: 'Sales Exec',
    scopeSummary: 'Branch vehicles, specials, events & Spotters',
    permissionsNote:
      'Manage manual vehicle listings, publish branch specials and dealership events, and follow up on Spotter referral leads for their allocated dealership.',
    badgeClass: 'bg-blue-50 text-[#00437A] border border-blue-200',
    branchRequired: true,
  },
  marketing: {
    label: 'Marketing Coordinator',
    shortLabel: 'Marketing',
    scopeSummary: 'Group-wide news, specials, events & competitions',
    permissionsNote:
      'Publish and manage Motoring News articles plus group-wide or branch-specific Specials, Events, and Competitions.',
    badgeClass: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
    branchRequired: false,
  },
  parts: {
    label: 'Parts Agent',
    shortLabel: 'Parts Agent',
    scopeSummary: 'Branch parts requests & department specials',
    permissionsNote:
      'Review and update branch Parts & Accessories requests and publish branch-scoped department specials.',
    badgeClass: 'bg-amber-50 text-amber-900 border border-amber-200',
    branchRequired: true,
  },
  service: {
    label: 'Service Booking Agent',
    shortLabel: 'Service Agent',
    scopeSummary: 'Branch service bookings & department specials',
    permissionsNote:
      'Review and update branch Service Booking requests and publish branch-scoped department specials.',
    badgeClass: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
    branchRequired: true,
  },
};

function generateSecureRandomPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;

  const pick = (pool: string, byte: number) => pool[byte % pool.length];
  const bytes = new Uint32Array(Math.max(length, 12));
  window.crypto.getRandomValues(bytes);

  const chars: string[] = [
    pick(upper, bytes[0]),
    pick(lower, bytes[1]),
    pick(digits, bytes[2]),
    pick(symbols, bytes[3]),
  ];
  for (let i = 4; i < length; i += 1) {
    chars.push(pick(all, bytes[i]));
  }

  // Fisher-Yates shuffle with crypto randomness
  const shuffleBytes = new Uint32Array(chars.length);
  window.crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = shuffleBytes[i] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

function formatSyncTimestamp(value: unknown): string {
  if (!value) return '—';
  try {
    let date: Date | null = null;
    if (value instanceof Date) {
      date = value;
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      date = (value as { toDate: () => Date }).toDate();
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    }
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function addDaysISO(baseISO: string, days: number): string {
  const date = new Date(`${baseISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function LogoUploadField({
  label,
  value,
  onChange,
  previewBg = 'light',
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  previewBg?: 'dark' | 'light';
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadDealershipMedia(file, 'logos');
      onChange(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload logo picture.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={value}
          placeholder="/uploads/logos/... or https://..."
          onChange={(e) => {
            setUploadError(null);
            onChange(e.target.value);
          }}
          required
          className="flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="whitespace-nowrap shrink-0"
        >
          <Upload className="h-3.5 w-3.5" />
          <span>{uploading ? 'Uploading...' : 'Upload Logo'}</span>
        </Button>
      </div>
      {hint && <p className="text-[11px] text-[#64748B]">{hint}</p>}
      {uploadError && (
        <p className="text-xs text-red-600" role="alert">
          {uploadError}
        </p>
      )}
      {value && (
        <div
          className={cn(
            'inline-flex h-16 max-w-[220px] items-center justify-center rounded-lg border px-3 py-2',
            previewBg === 'dark'
              ? 'border-[#001E50]/20 bg-[#001E50]'
              : 'border-[#E2E8F0] bg-[#F8FAFC]'
          )}
        >
          <img
            src={value}
            alt={label}
            referrerPolicy="no-referrer"
            className="max-h-11 w-auto object-contain"
          />
        </div>
      )}
    </div>
  );
}

function ImageSourceField({
  value,
  onChange,
  uploadCategory = 'promotions',
  allowVideo = false,
  mediaType,
  onMediaTypeChange,
}: {
  value: string;
  onChange: (next: string) => void;
  uploadCategory?: MediaUploadCategory;
  allowVideo?: boolean;
  mediaType?: UploadedMediaType;
  onMediaTypeChange?: (next: UploadedMediaType) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isVideo = allowVideo && isVideoMedia(value, mediaType);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadDealershipMedia(file, uploadCategory);
      onChange(result.url);
      onMediaTypeChange?.(result.mediaType);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Choose Dealership Image Preset</Label>
          <Select
            value={
              DEALERSHIP_IMAGE_LIBRARY.some((item) => item.src === value) ? value : 'custom'
            }
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                setUploadError(null);
                onChange(e.target.value);
                onMediaTypeChange?.('image');
              }
            }}
          >
            {DEALERSHIP_IMAGE_LIBRARY.map((item) => (
              <option key={item.src} value={item.src}>
                {item.category}: {item.label}
              </option>
            ))}
            <option value="custom">Custom URL / Uploaded Media</option>
          </Select>
        </div>
        <div>
          <Label>
            {allowVideo ? 'Or Enter Picture / Video URL *' : 'Or Enter Image URL / Path *'}
          </Label>
          <Input
            value={value}
            placeholder={
              allowVideo ? '/uploads/... or https://... (.jpg, .png, .mp4)' : '/assets/... or https://...'
            }
            onChange={(e) => {
              const nextVal = e.target.value;
              setUploadError(null);
              onChange(nextVal);
              if (allowVideo && onMediaTypeChange) {
                onMediaTypeChange(isVideoMedia(nextVal) ? 'video' : 'image');
              }
            }}
            required
          />
        </div>
      </div>

      {/* Direct File Upload Box */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-center gap-2.5 text-xs text-[#475569]">
          {allowVideo ? (
            <Film className="h-4 w-4 text-[#001E50] shrink-0" />
          ) : (
            <ImageIcon className="h-4 w-4 text-[#001E50] shrink-0" />
          )}
          <div>
            <p className="font-semibold text-[#091224]">
              {allowVideo ? 'Upload Picture or Video from Device' : 'Upload Picture from Device'}
            </p>
            <p className="text-[11px] text-[#64748B]">
              {allowVideo
                ? 'Pictures (PNG, JPG, WebP, SVG up to 8 MB) or Videos (MP4, WebM, MOV up to 25 MB).'
                : 'Pictures (PNG, JPG, WebP, SVG, GIF up to 8 MB).'}
            </p>
          </div>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={
              allowVideo
                ? 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif,video/mp4,video/webm,video/quicktime'
                : 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif'
            }
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>
              {uploading
                ? 'Uploading...'
                : allowVideo
                ? 'Upload Picture / Video'
                : 'Upload Picture'}
            </span>
          </Button>
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-600" role="alert">
          {uploadError}
        </p>
      )}

      {value && (
        <div className="relative h-36 w-64 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F1F5F9]">
          <PromotionMedia
            src={value}
            alt="Media preview"
            mediaType={isVideo ? 'video' : 'image'}
          />
        </div>
      )}
    </div>
  );
}

export function AdminPortalPage() {
  const {
    groupProfile,
    activeDealership,
    dealershipsById,
    activeDealerships,
    allDealerships,
    switchPreviewBranch,
    saveGroupProfile,
    saveDealershipSettings,
    setDealershipArchived,
  } = useDealership();

  const {
    todayISO,
    user,
    authReady,
    staffRole,
    baseStaffRole,
    isAdmin,
    isBranchAdmin,
    isItManager,
    isItAgent,
    isSalesAgent,
    isMarketing,
    isPartsExec,
    isServiceClerk,
    canAccessPortal,
    allocatedBranchId,
    staffProfile,
    activeEscalation,
    escalationRemainingSeconds,
    requiresPasswordSetup,
    isDeactivatedStaff,
    authError,
    signInAdmin,
    signInWithStaffCredentials,
    sendStaffPasswordReset,
    completeInitialPasswordSetup,
    signOutAdmin,
    activeVehicles,
    allVehicles,
    allPromotions,
    archivedPromotions,
    allNews,
    allJobs,
    jobApplications,
    leads,
    staffUsers,
    itTickets,
    usingFallbackSeed,
    seedAllDefaultData,
    saveVehicle,
    deleteVehicle,
    clearManualVehicles,
    syncAutoTraderFromDecodo,
    importAutoTraderJson,
    savePromotion,
    archivePromotion,
    reactivatePromotion,
    deletePromotion,
    saveNews,
    deleteNews,
    saveJobOpening,
    deleteJobOpening,
    updateJobApplicationStatus,
    deleteJobApplication,
    updateLeadStatus,
    deleteLead,
    createStaffUser,
    updateStaffUser,
    removeStaffUser,
    getBranchDependencies,
    deleteBranchIfUnused,
  } = useDealershipData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleBranchFilter, setVehicleBranchFilter] = useState<'All' | DealershipId>('All');
  const [promoSubTab, setPromoSubTab] = useState<'active' | 'archived'>('active');
  const [promoTypeFilter, setPromoTypeFilter] = useState<'all' | PromotionType>('all');
  const [promoScopeFilter, setPromoScopeFilter] = useState<'all' | 'MASTER' | DealershipId>('all');
  const [leadBranchFilter, setLeadBranchFilter] = useState<'All' | DealershipId>('All');
  const [leadSectionFilter, setLeadSectionFilter] = useState<LeadInboxSection>('all');
  const [careerSubTab, setCareerSubTab] = useState<'jobs' | 'applications'>('jobs');
  const [applicationJobFilter, setApplicationJobFilter] = useState<string>('All');
  const [downloadingDocKey, setDownloadingDocKey] = useState<string | null>(null);
  const [viewingCareerDoc, setViewingCareerDoc] = useState<ActiveCareerDocPreviewTarget | null>(null);
  const [pendingStatusEmail, setPendingStatusEmail] = useState<{
    application: CmsJobApplication;
    targetStatus: JobApplicationStatus;
  } | null>(null);
  const [editingJob, setEditingJob] = useState<Omit<CmsJobOpening, 'updatedAt' | 'updatedBy'> | null>(
    null
  );

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // Staff sign-in & first-login password setup state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [signingInStaff, setSigningInStaff] = useState(false);

  const [setupCurrentPassword, setSetupCurrentPassword] = useState('');
  const [setupNewPassword, setSetupNewPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPasswords, setShowSetupPasswords] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [savingPasswordSetup, setSavingPasswordSetup] = useState(false);

  // Staff User Management modal state (Admin-only)
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [newStaffFullName, setNewStaffFullName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('agent');
  const [newStaffBranchId, setNewStaffBranchId] = useState<string>(activeDealership.id);
  const [newStaffPassword, setNewStaffPassword] = useState(() => generateSecureRandomPassword(12));
  const [staffModalError, setStaffModalError] = useState<string | null>(null);
  const [createdStaffReceipt, setCreatedStaffReceipt] = useState<{
    profile: StaffUserProfile;
    temporaryPassword: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [editingStaffUser, setEditingStaffUser] = useState<StaffUserProfile | null>(null);
  const [confirmRemoveStaffUid, setConfirmRemoveStaffUid] = useState<string | null>(null);

  // AutoTrader Sync & JSON Import state
  const [syncingAutoTrader, setSyncingAutoTrader] = useState(false);
  const [syncReport, setSyncReport] = useState<AutoTraderSyncReport | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showJsonImportModal, setShowJsonImportModal] = useState(false);
  const [jsonImportRaw, setJsonImportRaw] = useState('');
  const [jsonImportBranchId, setJsonImportBranchId] = useState<DealershipId>(activeDealership.id);
  const [jsonImportReconcile, setJsonImportReconcile] = useState(false);
  const [branchSaveError, setBranchSaveError] = useState<string | null>(null);

  // Modal editors
  const [editingVehicle, setEditingVehicle] = useState<
    (Omit<CmsVehicle, 'createdAt' | 'updatedAt' | 'updatedBy'> & { extraImagesText: string }) | null
  >(null);
  const [editingPromo, setEditingPromo] = useState<
    (Omit<CmsPromotion, 'updatedAt' | 'updatedBy'> & { visibilityChoice: VisibilityChoice }) | null
  >(null);
  const [editingNews, setEditingNews] = useState<
    Omit<CmsNewsArticle, 'updatedAt' | 'updatedBy'> | null
  >(null);

  // Reactivate archived promotion modal
  const [reactivatingPromo, setReactivatingPromo] = useState<CmsPromotion | null>(null);
  const [reactivateExpiryDate, setReactivateExpiryDate] = useState(() => addDaysISO(todayISO, 30));

  // Dealership Group Corporate Registration state
  const [groupDraft, setGroupDraft] = useState<
    Omit<DealershipGroupProfile, 'id' | 'updatedAt' | 'updatedBy'>
  >(() => ({
    groupName: groupProfile.groupName,
    legalEntity: groupProfile.legalEntity,
    fspNumber: groupProfile.fspNumber,
    complianceOfficer: groupProfile.complianceOfficer,
    complianceEmail: groupProfile.complianceEmail,
    defaultNotifyEmail: groupProfile.defaultNotifyEmail ?? 'smokeydhlamini@gmail.com',
    primarySiteUrl: groupProfile.primarySiteUrl ?? '',
    smtpHost: groupProfile.smtpHost ?? 'smtp.gmail.com',
    smtpPort: groupProfile.smtpPort ?? 465,
    smtpUser: groupProfile.smtpUser ?? 'smokeydhlamini@gmail.com',
    smtpFrom:
      groupProfile.smtpFrom ??
      `${groupProfile.groupName} <${groupProfile.smtpUser ?? 'smokeydhlamini@gmail.com'}>`,
    smtpPassEnvKey: groupProfile.smtpPassEnvKey ?? 'SMTP_PASS',
    licenceScannerEnabled: groupProfile.licenceScannerEnabled ?? true,
    autotraderSyncDefault: groupProfile.autotraderSyncDefault ?? true,
    vwRoadsideTollFree: groupProfile.vwRoadsideTollFree,
    vwRoadsideCrossBorder: groupProfile.vwRoadsideCrossBorder,
    testDriveHoursSummary: groupProfile.testDriveHoursSummary,
    groupLogoSrc: groupProfile.groupLogoSrc,
    emblemLogoSrc: groupProfile.emblemLogoSrc,
    youtubeUrl: groupProfile.youtubeUrl,
    defaultBranchId: groupProfile.defaultBranchId,
  }));
  const [groupSaveError, setGroupSaveError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [loadingSystemStatus, setLoadingSystemStatus] = useState(false);
  const [showHandoverManual, setShowHandoverManual] = useState(false);
  const [handoverManualTab, setHandoverManualTab] = useState<
    'env-builder' | 'acquire-apis' | 'hosting' | 'troubleshooting'
  >('env-builder');

  // Nodemailer SMTP Email Dispatch status & test state
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    host: string;
    port: number;
    senderEmail: string;
    defaultRecipient: string;
    branchStatus?: {
      branchId: string;
      branchPassKey: string;
      branchSecretConfigured: boolean;
      effectiveReady: boolean;
      configuredHost: string;
      configuredPort: number;
      configuredUser: string;
      configuredFrom: string;
    } | null;
  } | null>(null);
  const [loadingEmailStatus, setLoadingEmailStatus] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailStatusError, setEmailStatusError] = useState<string | null>(null);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);
  const [smtpGuideTarget, setSmtpGuideTarget] = useState<
    'group' | 'editBranch' | 'newBranch' | null
  >(null);

  // Branch Settings editor & Add Branch modal state
  const [selectedBranchId, setSelectedBranchId] = useState<DealershipId>(activeDealership.id);
  const [branchDraft, setBranchDraft] = useState<DealershipRecord>(
    dealershipsById[activeDealership.id] ?? activeDealership
  );
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchDraft, setNewBranchDraft] = useState<DealershipRecord | null>(null);
  const [addBranchError, setAddBranchError] = useState<string | null>(null);
  const [confirmDeleteBranchId, setConfirmDeleteBranchId] = useState<DealershipId | null>(null);

  const isGroupOperator = isAdmin || isItManager;
  const canViewVehicles = isGroupOperator || isBranchAdmin || isSalesAgent;
  const canViewPromotions =
    isGroupOperator ||
    isBranchAdmin ||
    isMarketing ||
    isSalesAgent ||
    isPartsExec ||
    isServiceClerk;
  const canViewUsers = isGroupOperator || isBranchAdmin;
  const canManageStaff = isGroupOperator;
  const canViewBranches = isGroupOperator;
  const canViewNews = isGroupOperator || isMarketing;
  const canViewCareers = isGroupOperator || isBranchAdmin;
  const canViewLeads =
    isGroupOperator || isBranchAdmin || isPartsExec || isServiceClerk || isSalesAgent;
  const canViewItTickets = isGroupOperator || isItAgent || isBranchAdmin;

  const fetchEmailStatus = async (branchIdOverride?: string) => {
    if (!user || !(isAdmin || isItManager || isBranchAdmin || isItAgent)) return;
    setLoadingEmailStatus(true);
    setEmailStatusError(null);
    try {
      const token = await user.getIdToken();
      const targetBranch =
        branchIdOverride ?? (isAdmin || isItManager ? selectedBranchId : allocatedBranchId ?? selectedBranchId);
      const response = await fetch(
        `/api/email-status?branchId=${encodeURIComponent(targetBranch)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to check SMTP email configuration.');
      }
      setEmailStatus(data);
    } catch (err) {
      setEmailStatusError(
        err instanceof Error ? err.message : 'Unable to check SMTP email configuration.'
      );
    } finally {
      setLoadingEmailStatus(false);
    }
  };

  const fetchSystemStatus = async () => {
    if (!user || !(isAdmin || isItManager || isBranchAdmin || isItAgent)) return;
    setLoadingSystemStatus(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/system-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as SystemStatusResponse;
        setSystemStatus(data);
      }
    } catch {
      // Non-fatal readiness check
    } finally {
      setLoadingSystemStatus(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if ((isAdmin || isItManager) && activeTab === 'branches') {
      void fetchEmailStatus(selectedBranchId);
      void fetchSystemStatus();
    } else if ((isBranchAdmin || isItAgent) && activeTab === 'overview' && allocatedBranchId) {
      void fetchEmailStatus(allocatedBranchId);
    } else if ((isAdmin || isItManager) && activeTab === 'overview') {
      void fetchSystemStatus();
    }
  }, [isAdmin, isItManager, isBranchAdmin, isItAgent, activeTab, user, selectedBranchId, allocatedBranchId]);

  useEffect(() => {
    setGroupDraft({
      groupName: groupProfile.groupName,
      legalEntity: groupProfile.legalEntity,
      fspNumber: groupProfile.fspNumber,
      complianceOfficer: groupProfile.complianceOfficer,
      complianceEmail: groupProfile.complianceEmail,
      defaultNotifyEmail: groupProfile.defaultNotifyEmail ?? 'smokeydhlamini@gmail.com',
      primarySiteUrl: groupProfile.primarySiteUrl ?? '',
      smtpHost: groupProfile.smtpHost ?? 'smtp.gmail.com',
      smtpPort: groupProfile.smtpPort ?? 465,
      smtpUser: groupProfile.smtpUser ?? 'smokeydhlamini@gmail.com',
      smtpFrom:
        groupProfile.smtpFrom ??
        `${groupProfile.groupName} <${groupProfile.smtpUser ?? 'smokeydhlamini@gmail.com'}>`,
      smtpPassEnvKey: groupProfile.smtpPassEnvKey ?? 'SMTP_PASS',
      licenceScannerEnabled: groupProfile.licenceScannerEnabled ?? true,
      autotraderSyncDefault: groupProfile.autotraderSyncDefault ?? true,
      vwRoadsideTollFree: groupProfile.vwRoadsideTollFree,
      vwRoadsideCrossBorder: groupProfile.vwRoadsideCrossBorder,
      testDriveHoursSummary: groupProfile.testDriveHoursSummary,
      groupLogoSrc: groupProfile.groupLogoSrc,
      emblemLogoSrc: groupProfile.emblemLogoSrc,
      youtubeUrl: groupProfile.youtubeUrl,
      defaultBranchId: groupProfile.defaultBranchId,
    });
  }, [groupProfile]);

  useEffect(() => {
    const resolved = dealershipsById[selectedBranchId];
    if (resolved) {
      setBranchDraft(resolved);
    } else if (allDealerships[0]) {
      setSelectedBranchId(allDealerships[0].id);
      setBranchDraft(allDealerships[0]);
    }
    setConfirmDeleteBranchId(null);
  }, [selectedBranchId, dealershipsById, allDealerships]);

  // Enforce strict role-based tab & branch filters for all staff roles (including temporary escalations)
  useEffect(() => {
    if (isAdmin || isItManager) return;

    const branchScopedOnly = !isMarketing && Boolean(allocatedBranchId);
    if (branchScopedOnly && allocatedBranchId) {
      if (activeDealership.id !== allocatedBranchId) {
        switchPreviewBranch(allocatedBranchId);
      }
      setVehicleBranchFilter(allocatedBranchId);
      setLeadBranchFilter(allocatedBranchId);
      setPromoScopeFilter(allocatedBranchId);
      if ((isPartsExec || isServiceClerk) && !isBranchAdmin) {
        setPromoTypeFilter('special');
      }
    }

    const allowedTabs: AdminTab[] = ['overview'];
    if (canViewVehicles) allowedTabs.push('vehicles');
    if (canViewPromotions) allowedTabs.push('promotions');
    if (canViewUsers) allowedTabs.push('users');
    if (canViewBranches) allowedTabs.push('branches');
    if (canViewNews) allowedTabs.push('news');
    if (canViewCareers) allowedTabs.push('careers');
    if (canViewLeads) allowedTabs.push('leads');
    if (canViewItTickets) allowedTabs.push('it-tickets');

    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [
    isAdmin,
    isItManager,
    isBranchAdmin,
    isMarketing,
    isPartsExec,
    isServiceClerk,
    allocatedBranchId,
    activeDealership.id,
    activeTab,
    canViewVehicles,
    canViewPromotions,
    canViewUsers,
    canViewBranches,
    canViewNews,
    canViewCareers,
    canViewLeads,
    canViewItTickets,
    switchPreviewBranch,
  ]);

  const showFlash = (msg: string) => {
    setActionError(null);
    setStatusNotice(msg);
    window.setTimeout(() => setStatusNotice(null), 5000);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback ignored if clipboard permissions restricted
    }
  };

  const allocatedBranch = allocatedBranchId ? dealershipsById[allocatedBranchId] : null;

  const buildStaffWelcomeMessage = (
    profile: StaffUserProfile,
    temporaryPassword: string
  ): string => {
    const branchInfo = profile.allocatedDealershipId
      ? dealershipsById[profile.allocatedDealershipId]
      : null;
    const roleMeta = STAFF_ROLE_META[profile.role];
    const branchLabel = branchInfo?.name ?? `All ${groupProfile.groupName} VW Dealerships`;
    const roleLabel = roleMeta.branchRequired
      ? `${roleMeta.label} — ${branchLabel}`
      : `${roleMeta.label} (${branchInfo ? branchInfo.name : 'Group-Wide'})`;
    const permissionsNote = roleMeta.permissionsNote;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const portalUrl = `${origin}/admin${
      profile.allocatedDealershipId ? `?branch=${profile.allocatedDealershipId}` : ''
    }`;

    return [
      `Hello ${profile.fullName},`,
      '',
      `Welcome to ${branchLabel} (${groupProfile.legalEntity}). Your dealership staff portal account is now active.`,
      '',
      `Role: ${roleLabel}`,
      `Permissions: ${permissionsNote}`,
      `Portal Sign-In: ${portalUrl}`,
      `Username (Work Email): ${profile.email}`,
      `Temporary Password: ${temporaryPassword}`,
      '',
      'First-Time Login Step:',
      'Please sign in with the credentials above and create your own personal password when prompted.',
    ].join('\n');
  };

  const scopedVehicles = useMemo(() => {
    if (isAdmin || isItManager) return allVehicles;
    if ((isBranchAdmin || isSalesAgent) && allocatedBranchId) {
      return allVehicles.filter((v) => v.homeDealershipId === allocatedBranchId);
    }
    return [];
  }, [allVehicles, isAdmin, isItManager, isBranchAdmin, isSalesAgent, allocatedBranchId]);

  const scopedPromotions = useMemo(() => {
    if (isAdmin || isItManager || isMarketing) return allPromotions;
    if (isBranchAdmin && allocatedBranchId) {
      return allPromotions.filter(
        (p) => p.scope === 'BRANCH' && p.dealershipId === allocatedBranchId
      );
    }
    if (isSalesAgent && allocatedBranchId) {
      return allPromotions.filter(
        (p) =>
          p.scope === 'BRANCH' &&
          p.dealershipId === allocatedBranchId &&
          (p.type === 'special' || p.type === 'event')
      );
    }
    if ((isPartsExec || isServiceClerk) && allocatedBranchId) {
      return allPromotions.filter(
        (p) =>
          p.scope === 'BRANCH' &&
          p.dealershipId === allocatedBranchId &&
          p.type === 'special'
      );
    }
    return [];
  }, [
    allPromotions,
    isAdmin,
    isItManager,
    isMarketing,
    isBranchAdmin,
    isSalesAgent,
    isPartsExec,
    isServiceClerk,
    allocatedBranchId,
  ]);

  const scopedArchivedPromotions = useMemo(() => {
    if (isAdmin || isItManager || isMarketing) return archivedPromotions;
    if (isBranchAdmin && allocatedBranchId) {
      return archivedPromotions.filter(
        (p) => p.scope === 'BRANCH' && p.dealershipId === allocatedBranchId
      );
    }
    if (isSalesAgent && allocatedBranchId) {
      return archivedPromotions.filter(
        (p) =>
          p.scope === 'BRANCH' &&
          p.dealershipId === allocatedBranchId &&
          (p.type === 'special' || p.type === 'event')
      );
    }
    if ((isPartsExec || isServiceClerk) && allocatedBranchId) {
      return archivedPromotions.filter(
        (p) =>
          p.scope === 'BRANCH' &&
          p.dealershipId === allocatedBranchId &&
          p.type === 'special'
      );
    }
    return [];
  }, [
    archivedPromotions,
    isAdmin,
    isItManager,
    isMarketing,
    isBranchAdmin,
    isSalesAgent,
    isPartsExec,
    isServiceClerk,
    allocatedBranchId,
  ]);

  const livePromotionsList = useMemo(
    () =>
      scopedPromotions
        .filter((p) => p.active && p.validUntil >= todayISO)
        .sort((a, b) => a.validUntil.localeCompare(b.validUntil)),
    [scopedPromotions, todayISO]
  );

  const manualVehiclesCount = useMemo(
    () =>
      scopedVehicles.filter((v) => v.source !== 'autotrader' && !v.id.startsWith('at_')).length,
    [scopedVehicles]
  );

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedVehicles.filter((v) => {
      if (
        (isAdmin || isItManager) &&
        vehicleBranchFilter !== 'All' &&
        v.homeDealershipId !== vehicleBranchFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.status.toLowerCase().includes(q)
      );
    });
  }, [scopedVehicles, isAdmin, isItManager, vehicleBranchFilter, searchQuery]);

  const filteredPromotions = useMemo(() => {
    const base = promoSubTab === 'active' ? livePromotionsList : scopedArchivedPromotions;
    const q = searchQuery.trim().toLowerCase();
    const canFilterAllScopes = isAdmin || isItManager || isMarketing;
    return base.filter((p) => {
      if (promoTypeFilter !== 'all' && p.type !== promoTypeFilter) return false;
      if (canFilterAllScopes) {
        if (promoScopeFilter === 'MASTER' && p.scope !== 'MASTER') return false;
        if (
          promoScopeFilter !== 'all' &&
          promoScopeFilter !== 'MASTER' &&
          (p.scope !== 'BRANCH' || p.dealershipId !== promoScopeFilter)
        ) {
          return false;
        }
      }
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.vehicleName.toLowerCase().includes(q)
      );
    });
  }, [
    promoSubTab,
    livePromotionsList,
    scopedArchivedPromotions,
    promoTypeFilter,
    isAdmin,
    isItManager,
    isMarketing,
    promoScopeFilter,
    searchQuery,
  ]);

  const filteredNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allNews.filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q)
    );
  }, [allNews, searchQuery]);

  const scopedStaffUsers = useMemo(() => {
    if (isAdmin || isItManager) return staffUsers;
    if (isBranchAdmin && allocatedBranchId) {
      return staffUsers.filter((s) => s.allocatedDealershipId === allocatedBranchId);
    }
    return [];
  }, [staffUsers, isAdmin, isItManager, isBranchAdmin, allocatedBranchId]);

  const filteredStaffUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedStaffUsers.filter((s) => {
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      );
    });
  }, [scopedStaffUsers, searchQuery]);

  const scopedJobApplications = useMemo(() => {
    if (isAdmin || isItManager) return jobApplications;
    if (isBranchAdmin && allocatedBranchId) {
      return jobApplications.filter((app) => app.branchId === allocatedBranchId);
    }
    return [];
  }, [jobApplications, isAdmin, isItManager, isBranchAdmin, allocatedBranchId]);

  const scopedLeads = useMemo(() => {
    if (isAdmin || isItManager) return leads;
    if (isBranchAdmin && allocatedBranchId) {
      return leads.filter(
        (l) =>
          l.submittedAtDealershipId === allocatedBranchId ||
          l.homeDealershipId === allocatedBranchId
      );
    }
    if (isPartsExec && allocatedBranchId) {
      return leads.filter(
        (l) =>
          l.leadType === 'parts' &&
          (l.submittedAtDealershipId === allocatedBranchId ||
            l.homeDealershipId === allocatedBranchId)
      );
    }
    if (isServiceClerk && allocatedBranchId) {
      return leads.filter(
        (l) =>
          l.leadType === 'service' &&
          (l.submittedAtDealershipId === allocatedBranchId ||
            l.homeDealershipId === allocatedBranchId)
      );
    }
    if (isSalesAgent && allocatedBranchId) {
      return leads.filter(
        (l) =>
          isSpotterLead(l) &&
          (l.submittedAtDealershipId === allocatedBranchId ||
            l.homeDealershipId === allocatedBranchId)
      );
    }
    return [];
  }, [
    leads,
    isAdmin,
    isItManager,
    isBranchAdmin,
    isPartsExec,
    isServiceClerk,
    isSalesAgent,
    allocatedBranchId,
  ]);

  const leadsBeforeSection = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedLeads.filter((l) => {
      if (
        (isAdmin || isItManager) &&
        leadBranchFilter !== 'All' &&
        l.submittedAtDealershipId !== leadBranchFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        l.fullName.toLowerCase().includes(q) ||
        l.subject.toLowerCase().includes(q) ||
        l.leadType.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    });
  }, [scopedLeads, isAdmin, isItManager, leadBranchFilter, searchQuery]);

  const canFilterLeadSections = isAdmin || isItManager || isBranchAdmin;

  const leadSectionCounts = useMemo(
    () => ({
      all: leadsBeforeSection.length,
      parts: leadsBeforeSection.filter((l) => matchesLeadInboxSection(l, 'parts')).length,
      service: leadsBeforeSection.filter((l) => matchesLeadInboxSection(l, 'service')).length,
      spotters: leadsBeforeSection.filter((l) => matchesLeadInboxSection(l, 'spotters')).length,
      'sales-other': leadsBeforeSection.filter((l) =>
        matchesLeadInboxSection(l, 'sales-other')
      ).length,
    }),
    [leadsBeforeSection]
  );

  const sortedLeads = useMemo(() => {
    const list = canFilterLeadSections
      ? leadsBeforeSection.filter((l) => matchesLeadInboxSection(l, leadSectionFilter))
      : leadsBeforeSection;
    return [...list].sort((a, b) => (a.status === 'new' && b.status !== 'new' ? -1 : 0));
  }, [leadsBeforeSection, canFilterLeadSections, leadSectionFilter]);

  const selectedBranchDeps = useMemo(
    () => getBranchDependencies(selectedBranchId),
    [getBranchDependencies, selectedBranchId]
  );

  if (!authReady) {
    return (
      <div className="min-h-[75vh] bg-[#F8FAFC] pt-28 pb-20 flex items-center justify-center px-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-8 py-6 text-sm text-[#475569]">
          Verifying {groupProfile.legalEntity} staff session...
        </div>
      </div>
    );
  }

  if (!user || !canAccessPortal) {
    return (
      <div className="min-h-[82vh] bg-[#F8FAFC] pt-28 pb-20 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#00437A]">
              {groupProfile.legalEntity} · FSP {groupProfile.fspNumber}
            </p>
            <h1 className="font-display text-2xl font-semibold text-[#091224]">
              Dealership Staff &amp; Admin Portal
            </h1>
            <p className="text-sm leading-relaxed text-[#475569]">
              Sign in with your work email and password assigned by your Group Administrator, or use Administrator Google Sign-In.
            </p>
          </div>

          {user && !canAccessPortal && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  {isDeactivatedStaff ? 'Staff Account Suspended' : 'Account Not Authorized'}
                </span>
              </div>
              <p>
                {isDeactivatedStaff ? (
                  <>
                    Your staff profile (<strong className="font-mono">{user.email}</strong>) is currently suspended. Contact your Group Administrator to reactivate access.
                  </>
                ) : (
                  <>
                    Signed in as <strong className="font-mono">{user.email}</strong>. Only authorized {groupProfile.legalEntity} staff (Group Administrators, Branch Admins, IT Managers, IT Agents, Car Sales Executives, Marketing, Parts Agents, and Service Booking Agents) can access this portal.
                  </>
                )}
              </p>
            </div>
          )}

          {authError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900">
              {authError}
            </div>
          )}

          {loginNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              {loginNotice}
            </div>
          )}

          {!user ? (
            <div className="space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSigningInStaff(true);
                  setLoginNotice(null);
                  try {
                    await signInWithStaffCredentials(loginEmail, loginPassword);
                  } catch {
                    // Handled in context authError
                  } finally {
                    setSigningInStaff(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="staff-login-email">Work Email Address</Label>
                  <Input
                    id="staff-login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="agent@newcastlevw.co.za"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="staff-login-password">Password</Label>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoginNotice(null);
                        try {
                          await sendStaffPasswordReset(loginEmail);
                          setLoginNotice(
                            `Password reset instructions sent to ${loginEmail.trim().toLowerCase()}.`
                          );
                        } catch {
                          // Handled in context authError
                        }
                      }}
                      className="text-[11px] font-semibold text-[#00437A] hover:underline cursor-pointer"
                    >
                      Forgot / Reset Password
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="staff-login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#091224] cursor-pointer"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={signingInStaff}>
                  <KeyRound className="h-4 w-4" />
                  <span>{signingInStaff ? 'Signing In...' : 'Sign In with Work Email'}</span>
                </Button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#E2E8F0]" />
                <span className="mx-3 shrink text-[11px] font-medium uppercase tracking-wider text-[#64748B]">
                  Or Group Admin SSO
                </span>
                <div className="flex-grow border-t border-[#E2E8F0]" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => void signInAdmin()}
              >
                <LogIn className="h-4 w-4" />
                <span>Administrator Google Sign-In</span>
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => void signOutAdmin()}>
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
              <Button className="flex-1" onClick={() => void signInAdmin()}>
                <span>Switch Google Account</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mandatory First-Login Password Configuration Gate
  if (requiresPasswordSetup && staffProfile) {
    const branchLabel = staffProfile.allocatedDealershipId
      ? dealershipsById[staffProfile.allocatedDealershipId]?.name
      : 'All Group Dealerships';

    return (
      <div className="min-h-[82vh] bg-[#F8FAFC] pt-28 pb-20 flex items-center justify-center px-4">
        <div className="max-w-lg w-full rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-md bg-[#001E50]/5 px-3 py-1 text-xs font-semibold text-[#001E50]">
              <Lock className="h-3.5 w-3.5" />
              <span>First-Time Staff Password Setup</span>
            </div>
            <h1 className="font-display text-2xl font-semibold text-[#091224]">
              Configure Your Personal Password
            </h1>
            <p className="text-sm leading-relaxed text-[#475569]">
              Welcome, <strong className="text-[#091224]">{staffProfile.fullName}</strong>. Before entering the{' '}
              <strong className="text-[#001E50]">{branchLabel}</strong> workspace, please replace the temporary password issued by your Administrator with your own private password.
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#334155] space-y-1">
            <p>
              <strong className="text-[#091224]">Work Email:</strong>{' '}
              <span className="font-mono">{staffProfile.email}</span>
            </p>
            <p>
              <strong className="text-[#091224]">Assigned Role:</strong>{' '}
              {STAFF_ROLE_META[staffProfile.role].label} (
              {STAFF_ROLE_META[staffProfile.role].branchRequired
                ? branchLabel
                : staffProfile.allocatedDealershipId
                ? branchLabel
                : 'Group-Wide Access'}
              )
            </p>
          </div>

          {setupError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900">
              {setupError}
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSetupError(null);
              if (setupNewPassword.length < 8) {
                setSetupError('Your new password must be at least 8 characters long.');
                return;
              }
              if (setupNewPassword !== setupConfirmPassword) {
                setSetupError('New password and confirmation do not match.');
                return;
              }
              setSavingPasswordSetup(true);
              try {
                await completeInitialPasswordSetup(setupCurrentPassword, setupNewPassword);
                setSetupCurrentPassword('');
                setSetupNewPassword('');
                setSetupConfirmPassword('');
                showFlash('Your personal staff password is configured.');
              } catch (err) {
                setSetupError(
                  err instanceof Error ? err.message : 'Unable to save new password.'
                );
              } finally {
                setSavingPasswordSetup(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="setup-current-pw">Temporary Password (Provided by Admin) *</Label>
              <Input
                id="setup-current-pw"
                type={showSetupPasswords ? 'text' : 'password'}
                value={setupCurrentPassword}
                onChange={(e) => setSetupCurrentPassword(e.target.value)}
                placeholder="Enter your temporary password"
                required
              />
            </div>

            <div>
              <Label htmlFor="setup-new-pw">Create New Password (Min 8 characters) *</Label>
              <Input
                id="setup-new-pw"
                type={showSetupPasswords ? 'text' : 'password'}
                value={setupNewPassword}
                onChange={(e) => setSetupNewPassword(e.target.value)}
                placeholder="Choose a strong private password"
                minLength={8}
                required
              />
            </div>

            <div>
              <Label htmlFor="setup-confirm-pw">Confirm New Password *</Label>
              <Input
                id="setup-confirm-pw"
                type={showSetupPasswords ? 'text' : 'password'}
                value={setupConfirmPassword}
                onChange={(e) => setSetupConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                minLength={8}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer">
              <input
                type="checkbox"
                checked={showSetupPasswords}
                onChange={(e) => setShowSetupPasswords(e.target.checked)}
              />
              <span>Show passwords</span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => void signOutAdmin()}
                disabled={savingPasswordSetup}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
              <Button type="submit" disabled={savingPasswordSetup}>
                <KeyRound className="h-4 w-4" />
                <span>
                  {savingPasswordSetup ? 'Updating Password...' : 'Save Password & Continue'}
                </span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const handleSeedAll = async () => {
    setBusyAction(true);
    try {
      await seedAllDefaultData();
      showFlash('Default group profile, branches, Master Stock, Promotions, and News synced to Firestore.');
    } finally {
      setBusyAction(false);
    }
  };

  const openItTicketsCount = itTickets.filter((t) => t.status === 'open').length;

  const navTabs: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  ];

  if (canViewVehicles) {
    navTabs.push({
      id: 'vehicles',
      label:
        isAdmin || isItManager
          ? `Master Stock (${scopedVehicles.length})`
          : `${allocatedBranch?.shortName ?? 'Branch'} Stock (${scopedVehicles.length})`,
      icon: Car,
    });
  }
  if (canViewPromotions) {
    navTabs.push({
      id: 'promotions',
      label:
        isPartsExec || isServiceClerk
          ? `${isPartsExec ? 'Parts' : 'Service'} Specials (${scopedPromotions.length})`
          : isAdmin || isItManager || isMarketing
          ? `Promotions & Events (${scopedPromotions.length})`
          : `Specials & Events (${scopedPromotions.length})`,
      icon: Sparkles,
    });
  }
  if (canViewLeads) {
    navTabs.push({
      id: 'leads',
      label:
        isAdmin || isItManager || isBranchAdmin
          ? `Leads (${scopedLeads.length})`
          : isPartsExec
          ? `Parts Requests (${scopedLeads.length})`
          : isServiceClerk
          ? `Service Bookings (${scopedLeads.length})`
          : `Spotter Leads (${scopedLeads.length})`,
      icon: Inbox,
    });
  }
  if (canViewUsers) {
    navTabs.push({
      id: 'users',
      label: isBranchAdmin
        ? `Branch Staff (${scopedStaffUsers.length})`
        : `Users & Roles (${scopedStaffUsers.length})`,
      icon: Users,
    });
  }
  if (canViewBranches) {
    navTabs.push({
      id: 'branches',
      label: `Group & Branches (${allDealerships.length})`,
      icon: Building2,
    });
  }
  if (canViewNews) {
    navTabs.push({
      id: 'news',
      label: `${isMarketing && !isAdmin && !isItManager ? 'Motoring News' : 'News'} (${allNews.length})`,
      icon: Newspaper,
    });
  }
  if (canViewCareers) {
    navTabs.push({
      id: 'careers',
      label: isBranchAdmin
        ? `Applications (${scopedJobApplications.length})`
        : `Careers (${allJobs.length} / ${scopedJobApplications.length})`,
      icon: Briefcase,
    });
  }
  if (canViewItTickets) {
    navTabs.push({
      id: 'it-tickets',
      label:
        openItTicketsCount > 0
          ? `IT Tickets (${openItTicketsCount} Open)`
          : `IT Tickets (${itTickets.length})`,
      icon: Ticket,
    });
  }

  const effectiveBadgeRole: StaffRole =
    staffRole ?? (isAdmin ? 'admin' : 'agent');

  const currentRoleLabel = isAdmin
    ? 'Group Administrator · Full Group Access'
    : isItManager
    ? 'IT Manager · Group Technical & Escalation Admin'
    : isItAgent && activeEscalation
    ? `Branch IT Agent (Temporarily Elevated: ${STAFF_ROLE_META[activeEscalation.grantedRole].shortLabel}) · ${allocatedBranch?.name ?? 'Assigned Branch'}`
    : isItAgent
    ? `Branch IT Agent · ${allocatedBranch?.name ?? 'Assigned Branch'}`
    : isBranchAdmin
    ? `Branch Admin (Dealer Principal) · ${allocatedBranch?.name ?? 'Assigned Branch'}`
    : isMarketing
    ? 'Marketing Coordinator · Group-Wide Campaigns & News'
    : isPartsExec
    ? `Parts Agent · ${allocatedBranch?.name ?? 'Assigned Branch'}`
    : isServiceClerk
    ? `Service Booking Agent · ${allocatedBranch?.name ?? 'Assigned Branch'}`
    : `Car Sales Executive · ${allocatedBranch?.name ?? 'Assigned Branch'}`;

  const overviewStats =
    isAdmin || isItManager
      ? [
          {
            label: 'Available Master Stock',
            value: `${activeVehicles.length} / ${allVehicles.length}`,
            sub: `${activeDealerships.length} active branch${activeDealerships.length === 1 ? '' : 'es'} in ${groupProfile.groupName}`,
          },
          {
            label: 'Live Promotions & Events',
            value: `${livePromotionsList.length}`,
            sub: `${scopedArchivedPromotions.length} archived or expired`,
          },
          {
            label: isItManager ? 'Open IT Escalations' : 'Authorized Staff Users',
            value: isItManager
              ? `${openItTicketsCount}`
              : `${staffUsers.filter((s) => s.active).length}`,
            sub: isItManager
              ? `${itTickets.filter((t) => t.status === 'approved_temporary').length} temporary grant(s) logged`
              : `${staffUsers.filter((s) => s.mustChangePassword).length} pending first password setup`,
          },
          {
            label: 'Customer Leads',
            value: `${leads.length}`,
            sub: `${leads.filter((l) => l.status === 'new').length} awaiting follow-up`,
          },
        ]
      : isBranchAdmin
      ? [
          {
            label: `${allocatedBranch?.shortName ?? 'Branch'} Stock`,
            value: `${scopedVehicles.filter((v) => v.status === 'available').length} / ${scopedVehicles.length}`,
            sub: 'Available / total vehicles held at branch',
          },
          {
            label: 'Branch Customer Leads',
            value: `${scopedLeads.length}`,
            sub: `${scopedLeads.filter((l) => l.status === 'new').length} new · ${scopedLeads.filter((l) => isSpotterLead(l)).length} Spotters`,
          },
          {
            label: 'Branch Careers & Campaigns',
            value: `${scopedJobApplications.length} / ${livePromotionsList.length}`,
            sub: 'Job applications / live branch promos',
          },
          {
            label: 'Branch Staff & IT Tickets',
            value: `${scopedStaffUsers.filter((s) => s.active).length} / ${openItTicketsCount}`,
            sub: 'Active staff / open IT requests',
          },
        ]
      : isItAgent && !activeEscalation
      ? [
          {
            label: 'Allocated Dealership',
            value: allocatedBranch?.shortName ?? `ID ${allocatedBranchId ?? '—'}`,
            sub: allocatedBranch?.domain ?? '',
          },
          {
            label: 'Open IT Tickets',
            value: `${itTickets.filter((t) => t.status === 'open').length}`,
            sub: 'Awaiting IT Manager review',
          },
          {
            label: 'Total Branch IT Tickets',
            value: `${itTickets.length}`,
            sub: `${itTickets.filter((t) => t.status === 'resolved').length} resolved directly`,
          },
          {
            label: 'Escalation Status',
            value: 'Standard IT Scope',
            sub: 'Submit a ticket to request timed role access',
          },
        ]
      : isMarketing
      ? [
          {
            label: 'Live Group Campaigns',
            value: `${livePromotionsList.length}`,
            sub: `${scopedArchivedPromotions.length} archived or expired`,
          },
          {
            label: 'Active Competitions',
            value: `${livePromotionsList.filter((p) => p.type === 'competition').length}`,
            sub: 'Visible across selected group branches',
          },
          {
            label: 'Published News Articles',
            value: `${allNews.filter((n) => !n.archived).length} / ${allNews.length}`,
            sub: 'Group-wide Motoring News feed',
          },
          {
            label: 'Dealership Scope',
            value: `${activeDealerships.length} Branches`,
            sub: groupProfile.groupName,
          },
        ]
      : isPartsExec || isServiceClerk
      ? [
          {
            label: isPartsExec ? 'Branch Parts Requests' : 'Branch Service Bookings',
            value: `${scopedLeads.length}`,
            sub: `${scopedLeads.filter((l) => l.status === 'new').length} awaiting response`,
          },
          {
            label: 'Handled / Contacted',
            value: `${scopedLeads.filter((l) => l.status === 'contacted').length}`,
            sub: `${scopedLeads.filter((l) => l.status === 'archived').length} archived`,
          },
          {
            label: 'Live Department Specials',
            value: `${livePromotionsList.length}`,
            sub: `${scopedArchivedPromotions.length} archived or expired`,
          },
          {
            label: 'Allocated Dealership',
            value: allocatedBranch?.shortName ?? `ID ${allocatedBranchId ?? '—'}`,
            sub: allocatedBranch?.domain ?? '',
          },
        ]
      : [
          {
            label: `${allocatedBranch?.shortName ?? 'Branch'} Total Stock`,
            value: `${scopedVehicles.length}`,
            sub: `${scopedVehicles.filter((v) => v.status === 'available').length} currently available`,
          },
          {
            label: 'Spotter Referral Leads',
            value: `${scopedLeads.length}`,
            sub: `${scopedLeads.filter((l) => l.status === 'new').length} awaiting sales follow-up`,
          },
          {
            label: 'Live Specials & Events',
            value: `${livePromotionsList.length}`,
            sub: `${scopedArchivedPromotions.length} archived or expired`,
          },
          {
            label: 'Allocated Dealership',
            value: allocatedBranch?.shortName ?? `ID ${allocatedBranchId ?? '—'}`,
            sub: allocatedBranch?.domain ?? '',
          },
        ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Portal Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#00437A]">
                {groupProfile.legalEntity} · FSP {groupProfile.fspNumber}
              </p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
                  STAFF_ROLE_META[effectiveBadgeRole].badgeClass
                )}
              >
                <Shield className="h-3 w-3" />
                {currentRoleLabel}
              </span>
            </div>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold text-[#091224]">
              {isAdmin
                ? `${groupProfile.groupName} — Multi-Branch Admin Portal`
                : isItManager
                ? `${groupProfile.groupName} — IT Manager Operations Console`
                : isBranchAdmin
                ? `${allocatedBranch?.name ?? 'Branch'} — Dealer Principal Desk`
                : isItAgent
                ? `${allocatedBranch?.name ?? 'Branch'} — Branch IT Workspace`
                : isMarketing
                ? `${groupProfile.groupName} — Marketing Workspace`
                : isPartsExec
                ? `${allocatedBranch?.name ?? 'Branch'} Parts Workspace`
                : isServiceClerk
                ? `${allocatedBranch?.name ?? 'Branch'} Service Booking Desk`
                : `${allocatedBranch?.name ?? 'Branch'} Sales & Spotters Workspace`}
            </h1>
            <p className="mt-1 text-xs text-[#475569]">
              Signed in as{' '}
              <span className="font-semibold text-[#091224]">
                {staffProfile?.fullName || user.displayName || user.email}
              </span>{' '}
              (<span className="font-mono text-[#091224]">{user.email}</span>) · Previewing{' '}
              <strong className="text-[#001E50]">{activeDealership.name}</strong> (ID {activeDealership.id})
              {baseStaffRole === 'it_agent' && activeEscalation && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-mono font-semibold text-amber-950">
                  <Clock className="h-3 w-3" />
                  Elevated: {formatCountdown(escalationRemainingSeconds)}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(isAdmin || isItManager) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void fetchSystemStatus();
                  setHandoverManualTab('env-builder');
                  setShowHandoverManual(true);
                }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Setup Manual &amp; .env / APIs</span>
              </Button>
            )}

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                disabled={busyAction}
                onClick={() => void handleSeedAll()}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Seed / Reset Default Group Data</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={() => void signOutAdmin()}>
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>

        {isItAgent && activeEscalation && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  Temporary Role Escalation Active: {STAFF_ROLE_META[activeEscalation.grantedRole].label}
                </p>
                <p className="text-amber-900">
                  Approved by {activeEscalation.grantedBy} (Ticket{' '}
                  <span className="font-mono">{activeEscalation.ticketId}</span>). Access reverts automatically to standard Branch IT Agent permissions when the timer expires.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="rounded-lg bg-white border border-amber-300 px-3 py-1.5 font-mono text-xs font-bold text-amber-950 tabular-nums">
                {formatCountdown(escalationRemainingSeconds)} remaining
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('it-tickets')}
              >
                <Ticket className="h-3.5 w-3.5" />
                <span>View Ticket</span>
              </Button>
            </div>
          </div>
        )}

        {isAdmin && usingFallbackSeed && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
            <span>
              Firestore catalog collections are currently empty and displaying built-in fallback data. Click <strong>Seed / Reset Default Group Data</strong> to populate Firestore.
            </span>
          </div>
        )}

        {statusNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {actionError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs & Search */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white p-1.5">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-[#001E50] text-white'
                      : 'text-[#475569] hover:text-[#091224] hover:bg-[#F8FAFC]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab !== 'overview' && activeTab !== 'branches' && (
            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="pl-9 bg-white"
              />
            </div>
          )}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {overviewStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-2"
                >
                  <p className="text-xs font-medium text-[#64748B]">{stat.label}</p>
                  <p className="font-mono text-2xl font-semibold text-[#001E50] tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-[#475569]">{stat.sub}</p>
                </div>
              ))}
            </div>

            {isSalesAgent && !isAdmin && !isItManager && !isBranchAdmin && allocatedBranch && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      Assigned Dealership · Branch ID {allocatedBranch.id} ({allocatedBranch.domain})
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      {allocatedBranch.name} — Car Sales Executive Permissions
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('leads')}>
                      <Inbox className="h-3.5 w-3.5" />
                      <span>Spotter Leads ({scopedLeads.length})</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('vehicles')}>
                      <Car className="h-3.5 w-3.5" />
                      <span>Manage Branch Stock</span>
                    </Button>
                    <Button size="sm" onClick={() => setActiveTab('promotions')}>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Manage Specials &amp; Events</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">
                  Your Car Sales Executive account is scoped strictly to <strong>{allocatedBranch.name}</strong>. You can add, edit, mark sold, or remove manual vehicle listings, publish branch specials or events, and follow up on Spotter referral leads submitted for your branch.
                </p>
              </div>
            )}

            {isBranchAdmin && !isAdmin && !isItManager && allocatedBranch && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      Dealer Principal Scope · Branch ID {allocatedBranch.id} ({allocatedBranch.domain})
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      {allocatedBranch.name} — Branch Admin Workspace
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('leads')}>
                      <Inbox className="h-3.5 w-3.5" />
                      <span>Branch Leads ({scopedLeads.length})</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('vehicles')}>
                      <Car className="h-3.5 w-3.5" />
                      <span>Branch Stock</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('careers')}>
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>Applications ({scopedJobApplications.length})</span>
                    </Button>
                    <Button size="sm" onClick={() => setActiveTab('it-tickets')}>
                      <Ticket className="h-3.5 w-3.5" />
                      <span>IT Tickets ({openItTicketsCount} Open)</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">
                  Your Branch Admin account oversees all dealership operations for <strong>{allocatedBranch.name}</strong> — including Parts, Service, Spotters, Sales leads, vehicle stock, specials/competitions, career applicant reviews, staff roster visibility, and branch IT tickets.
                </p>

                {emailStatus?.branchStatus && (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#091224]">
                        Branch Outgoing Email (Nodemailer SMTP):{' '}
                        <span
                          className={
                            emailStatus.branchStatus.effectiveReady
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        >
                          {emailStatus.branchStatus.effectiveReady
                            ? 'Ready & Connected'
                            : `Waiting for ${emailStatus.branchStatus.branchPassKey}`}
                        </span>
                      </p>
                      <p className="text-[#475569] mt-0.5">
                        Sender: <span className="font-mono">{emailStatus.branchStatus.configuredFrom}</span> · Host:{' '}
                        <span className="font-mono">
                          {emailStatus.branchStatus.configuredHost}:{emailStatus.branchStatus.configuredPort}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isItAgent && !isBranchAdmin && !isAdmin && !isItManager && allocatedBranch && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      IT Support Scope · Branch ID {allocatedBranch.id} ({allocatedBranch.domain})
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      {allocatedBranch.name} — Branch IT Agent Console
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setActiveTab('it-tickets')}>
                      <Ticket className="h-3.5 w-3.5" />
                      <span>IT Escalation Tickets ({itTickets.length})</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">
                  As Branch IT Agent for <strong>{allocatedBranch.name}</strong>, you can monitor your branch&apos;s email/SMTP readiness and submit timed role-escalation tickets to the Group IT Manager whenever temporary elevated dealership access is required.
                </p>

                {emailStatus?.branchStatus && (
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#091224]">
                        Branch Outgoing Mail Readiness:{' '}
                        <span
                          className={
                            emailStatus.branchStatus.effectiveReady
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        >
                          {emailStatus.branchStatus.effectiveReady
                            ? 'SMTP Connected'
                            : `Secret ${emailStatus.branchStatus.branchPassKey} Required`}
                        </span>
                      </p>
                      <p className="text-[#475569] mt-0.5">
                        Host: <span className="font-mono">{emailStatus.branchStatus.configuredHost}:{emailStatus.branchStatus.configuredPort}</span> · Sender:{' '}
                        <span className="font-mono">{emailStatus.branchStatus.configuredUser}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isItManager && !isAdmin && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      Group-Wide Technical Control · {groupProfile.groupName}
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      IT Manager Operations &amp; Ticket Governance
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setActiveTab('it-tickets')}>
                      <Ticket className="h-3.5 w-3.5" />
                      <span>Review IT Tickets ({openItTicketsCount} Open)</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('branches')}>
                      <Server className="h-3.5 w-3.5" />
                      <span>Branch SMTP &amp; Sync</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">
                  You hold group-wide operational access across all branches — including reviewing IT Agent escalation requests (Grant Timed Access, Resolve Directly, Reject, or Revoke Early), configuring branch SMTP &amp; AutoTrader sync, and managing operational staff accounts (Group Admin &amp; IT Manager privileges remain reserved for Group Administrators).
                </p>
              </div>
            )}

            {isMarketing && !isAdmin && !isItManager && !isBranchAdmin && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      Group-Wide Communications · {groupProfile.groupName}
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      Marketing Coordinator Permissions
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('news')}>
                      <Newspaper className="h-3.5 w-3.5" />
                      <span>Manage Motoring News</span>
                    </Button>
                    <Button size="sm" onClick={() => setActiveTab('promotions')}>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Manage Specials, Events &amp; Competitions</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">
                  Your Marketing Coordinator account can publish and archive Motoring News articles, group-wide MASTER campaigns, branch-specific Specials, Dealership Events, and Competitions across all branches of {groupProfile.groupName}.
                </p>
              </div>
            )}

            {(isPartsExec || isServiceClerk) && !isAdmin && !isItManager && !isBranchAdmin && allocatedBranch && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      Assigned Dealership · Branch ID {allocatedBranch.id} ({allocatedBranch.domain})
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      {allocatedBranch.name} —{' '}
                      {isPartsExec ? 'Parts Agent' : 'Service Booking Agent'} Permissions
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('leads')}>
                      <Inbox className="h-3.5 w-3.5" />
                      <span>
                        {isPartsExec ? 'View Parts Requests' : 'View Service Bookings'}
                      </span>
                    </Button>
                    <Button size="sm" onClick={() => setActiveTab('promotions')}>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Manage Department Specials</span>
                    </Button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-[#475569]">
                  Your department account is scoped strictly to <strong>{allocatedBranch.name}</strong>. You can review incoming{' '}
                  {isPartsExec ? 'Parts & Accessories requests' : 'Service Booking requests'}, update customer follow-up statuses (New, Contacted, Archived), and publish {isPartsExec ? 'Parts' : 'Service'} specials for your branch.
                </p>
              </div>
            )}

            {/* Dynamic Dealership Quick Cards + Live Preview Switcher (Group Admin & IT Manager) */}
            {(isAdmin || isItManager) && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      {groupProfile.groupName} — Registered Dealership Branches ({allDealerships.length})
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Click <strong>Preview Branch</strong> to switch `?branch=` immediately, or configure group &amp; branch setup.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('branches')}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Manage Group &amp; Branches</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allDealerships.map((branch) => {
                    const isCurrent = branch.id === activeDealership.id;
                    const heldStockCount = allVehicles.filter(
                      (v) => v.homeDealershipId === branch.id && v.status === 'available'
                    ).length;
                    const exclusivePromos = livePromotionsList.filter(
                      (p) => p.scope === 'BRANCH' && p.dealershipId === branch.id
                    ).length;

                    return (
                      <div
                        key={branch.id}
                        className={cn(
                          'rounded-xl border p-5 space-y-3',
                          branch.archived
                            ? 'border-amber-200 bg-amber-50/40'
                            : isCurrent
                            ? 'border-[#001E50] bg-[#F8FAFC]'
                            : 'border-[#E2E8F0] bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                              ID {branch.id} · {branch.referenceCode || branch.id} · {branch.domain}
                            </span>
                            <h3 className="font-display text-base font-semibold text-[#091224]">
                              {branch.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {branch.archived && (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                Archived
                              </span>
                            )}
                            {isCurrent && (
                              <span className="rounded bg-[#001E50] px-2 py-0.5 text-[10px] font-semibold text-white">
                                Active
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-[#475569] space-y-1">
                          <p>{branch.physicalAddress}</p>
                          <p className="font-mono">{branch.receptionNumber}</p>
                          {branch.whatsappNumber && (
                            <p className="font-mono text-emerald-700">
                              WhatsApp: {branch.whatsappNumber}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-3 text-xs">
                          <span className="text-[#475569] tabular-nums">
                            {heldStockCount} units · {exclusivePromos} branch promos
                          </span>
                          <Button
                            variant={isCurrent ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => {
                              switchPreviewBranch(branch.id);
                              showFlash(`Switched live preview to ${branch.name} (?branch=${branch.id}).`);
                            }}
                          >
                            {isCurrent ? 'Previewing' : 'Preview Branch'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MASTER GROUP STOCK / BRANCH STOCK (VEHICLES) TAB */}
        {canViewVehicles && activeTab === 'vehicles' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-[#091224]">
                  {isAdmin || isItManager
                    ? 'Master Group Stock (New, Used & MasterCars)'
                    : `${allocatedBranch?.name ?? 'Branch'} Vehicle Stock`}
                </h2>
                {isAdmin || isItManager ? (
                  <Select
                    value={vehicleBranchFilter}
                    onChange={(e) => setVehicleBranchFilter(e.target.value as 'All' | DealershipId)}
                    className="w-56 bg-white"
                  >
                    <option value="All">All Holding Branches</option>
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        Held at {b.shortName} (ID {b.id}){b.archived ? ' [Archived]' : ''}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#001E50]">
                    <MapPin className="h-3.5 w-3.5" />
                    Allocated to {allocatedBranch?.name} (ID {allocatedBranchId})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {(isAdmin || isItManager) && (
                  <>
                    <Button
                      variant="outline"
                      disabled={syncingAutoTrader}
                      onClick={async () => {
                        setSyncingAutoTrader(true);
                        setSyncError(null);
                        try {
                          const report = await syncAutoTraderFromDecodo();
                          setSyncReport(report);
                          showFlash('AutoTrader stock sync completed across configured branches.');
                        } catch (err) {
                          setSyncError(
                            err instanceof Error
                              ? err.message
                              : 'Unable to sync AutoTrader listings right now.'
                          );
                        } finally {
                          setSyncingAutoTrader(false);
                        }
                      }}
                    >
                      <RefreshCw
                        className={cn('h-4 w-4', syncingAutoTrader && 'animate-spin')}
                      />
                      <span>
                        {syncingAutoTrader ? 'Syncing AutoTrader...' : 'Sync AutoTrader Stock Now'}
                      </span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setJsonImportBranchId(
                          vehicleBranchFilter === 'All' ? activeDealership.id : vehicleBranchFilter
                        );
                        setSyncError(null);
                        setShowJsonImportModal(true);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      <span>Paste AutoTrader JSON</span>
                    </Button>

                    {manualVehiclesCount > 0 && (
                      <Button
                        variant="outline"
                        disabled={busyAction}
                        onClick={async () => {
                          setBusyAction(true);
                          try {
                            const removed = await clearManualVehicles();
                            showFlash(
                              `Removed ${removed} manually added ${removed === 1 ? 'vehicle' : 'vehicles'} from Master Group Stock.`
                            );
                          } finally {
                            setBusyAction(false);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                        <span>Remove Manual Cars ({manualVehiclesCount})</span>
                      </Button>
                    )}
                  </>
                )}

                <Button
                  onClick={() =>
                    setEditingVehicle({
                      id: `veh-${Date.now()}`,
                      title: '',
                      make: 'Volkswagen',
                      model: '',
                      year: 2026,
                      price: 399900,
                      monthlyFrom: 5990,
                      mileage: 0,
                      transmission: '7-Speed DSG',
                      fuelType: 'Petrol',
                      category: 'New',
                      bodyStyle: 'SUVs',
                      powerKw: 'N/A',
                      fuelEconomy: 'VW Spec',
                      colour: 'Pure White',
                      images: ['/assets/aistudio/vwslider10_5974d4ed.jpg'],
                      homeDealershipId: allocatedBranchId ?? activeDealership.id,
                      status: 'available',
                      source: 'manual',
                      extraImagesText: '',
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {isAdmin || isItManager
                      ? 'Add Vehicle to Group Stock'
                      : `Add Vehicle to ${allocatedBranch?.shortName ?? 'Branch'}`}
                  </span>
                </Button>
              </div>
            </div>

            {syncError && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-xs text-amber-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">AutoTrader Live Scrape Notice</p>
                    <p>{syncError}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSyncError(null);
                    setShowJsonImportModal(true);
                  }}
                >
                  Open JSON Importer
                </Button>
              </div>
            )}

            {syncReport && (
              <div className="rounded-xl border border-[#001E50]/20 bg-white p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#001E50]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    <span>
                      AutoTrader Sync Summary (
                      {syncReport.mode === 'decodo' ? 'Decodo Live Scrape' : 'JSON Import'})
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-[#64748B]">
                    {formatSyncTimestamp(syncReport.syncedAtIso)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {syncReport.branches.map((b) => (
                    <div
                      key={b.branchId}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs space-y-1"
                    >
                      <p className="font-semibold text-[#091224]">
                        {b.branchName} {b.dealerId ? `(#${b.dealerId})` : ''}
                      </p>
                      {b.skipped ? (
                        <p className="text-[#64748B]">{b.skipReason || 'Skipped'}</p>
                      ) : b.error ? (
                        <p className="text-red-700">{b.error}</p>
                      ) : (
                        <p className="font-mono text-[#334155]">
                          +{b.addedCount} added · {b.updatedCount} updated · {b.markedSoldCount}{' '}
                          marked sold
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs uppercase text-[#475569]">
                  <tr>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Holding Branch</th>
                    <th className="px-4 py-3">Source &amp; Last Synced</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredVehicles.map((v) => {
                    const homeBranch = dealershipsById[v.homeDealershipId];
                    const isAutoTrader = v.source === 'autotrader' || v.id.startsWith('at_');
                    return (
                      <tr key={v.id} className="hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <img
                              src={v.images[0]}
                              alt={v.title}
                              referrerPolicy="no-referrer"
                              className="h-12 w-16 rounded-md object-cover border border-[#E2E8F0] shrink-0"
                            />
                            <div>
                              <p className="font-semibold text-[#091224]">{v.title}</p>
                              <p className="text-xs text-[#64748B]">
                                {v.model} · {v.year} · {v.mileage.toLocaleString('en-ZA')} km ·{' '}
                                {v.category}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#001E50]/5 px-2 py-1 text-xs font-medium text-[#001E50]">
                            <MapPin className="h-3 w-3" />
                            {homeBranch?.shortName ?? `Branch ${v.homeDealershipId}`} (ID {v.homeDealershipId})
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold',
                                  isAutoTrader
                                    ? 'bg-blue-50 text-[#00437A]'
                                    : 'bg-slate-100 text-[#334155]'
                                )}
                              >
                                {isAutoTrader ? 'AutoTrader' : 'Manual Entry'}
                              </span>
                              {v.canonicalUrl && (
                                <a
                                  href={v.canonicalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open AutoTrader listing"
                                  className="text-[#00437A] hover:text-[#001E50]"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            <p className="inline-flex items-center gap-1 font-mono text-[11px] text-[#64748B]">
                              <Clock className="h-3 w-3" />
                              {formatSyncTimestamp(v.lastSyncedAt ?? v.updatedAt)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs">
                          <p className="font-semibold text-[#091224]">{formatZAR(v.price)}</p>
                          <p className="text-[#00437A]">{formatZAR(v.monthlyFrom)} p/m</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              'inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize',
                              v.status === 'available'
                                ? 'bg-emerald-50 text-emerald-800'
                                : v.status === 'reserved'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            )}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {isSalesAgent && !isAdmin && !isItManager && !isBranchAdmin && isAutoTrader ? (
                            <span className="text-[11px] font-medium text-[#64748B]">
                              AutoTrader Feed
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setEditingVehicle({
                                    ...v,
                                    extraImagesText: v.images.slice(1).join('\n'),
                                  })
                                }
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await deleteVehicle(v.id);
                                    showFlash(`Removed ${v.title} from stock.`);
                                  } catch (err) {
                                    setActionError(
                                      err instanceof Error
                                        ? err.message
                                        : 'Unable to remove vehicle.'
                                    );
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCOPED PROMOTIONS, EVENTS & COMPETITIONS TAB */}
        {canViewPromotions && activeTab === 'promotions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setPromoSubTab('active')}
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap shrink-0',
                      promoSubTab === 'active'
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#475569] hover:text-[#091224]'
                    )}
                  >
                    Live ({livePromotionsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoSubTab('archived')}
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap shrink-0',
                      promoSubTab === 'archived'
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#475569] hover:text-[#091224]'
                    )}
                  >
                    Archived / Expired ({scopedArchivedPromotions.length})
                  </button>
                </div>

                {!(isPartsExec || isServiceClerk) && (
                  <Select
                    value={promoTypeFilter}
                    onChange={(e) => setPromoTypeFilter(e.target.value as 'all' | PromotionType)}
                    className="w-44 bg-white"
                  >
                    <option value="all">All Types</option>
                    <option value="special">Specials</option>
                    <option value="event">Events</option>
                    {(isAdmin || isItManager || isMarketing || isBranchAdmin) && (
                      <option value="competition">Competitions</option>
                    )}
                  </Select>
                )}

                {(isAdmin || isItManager || isMarketing) && (
                  <Select
                    value={promoScopeFilter}
                    onChange={(e) =>
                      setPromoScopeFilter(e.target.value as 'all' | 'MASTER' | DealershipId)
                    }
                    className="w-56 bg-white"
                  >
                    <option value="all">All Visibility Scopes</option>
                    <option value="MASTER">All Dealerships (Master)</option>
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.shortName} Only (ID {b.id}){b.archived ? ' [Archived]' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <Button
                onClick={() => {
                  const isBranchLimited = !(isAdmin || isItManager || isMarketing);
                  setEditingPromo({
                    id: `promo-${Date.now()}`,
                    title: '',
                    type: 'special',
                    description: '',
                    imageUrl: '/assets/aistudio/vwslider10_5974d4ed.jpg',
                    validUntil: addDaysISO(todayISO, 30),
                    scope: isBranchLimited ? 'BRANCH' : 'MASTER',
                    dealershipId: isBranchLimited ? allocatedBranchId : null,
                    active: true,
                    vehicleName: '',
                    offerPrice: 0,
                    monthlyFrom: 0,
                    eventTime: '',
                    location: isBranchLimited
                      ? allocatedBranch?.physicalAddress ?? ''
                      : `All ${groupProfile.groupName} VW Branches`,
                    visibilityChoice:
                      isBranchLimited && allocatedBranchId ? allocatedBranchId : 'MASTER',
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {isAdmin || isItManager || isMarketing
                    ? 'Add Special / Event / Competition'
                    : isBranchAdmin
                    ? `Add ${allocatedBranch?.shortName ?? 'Branch'} Special / Event / Draw`
                    : isPartsExec
                    ? `Add ${allocatedBranch?.shortName ?? 'Branch'} Parts Special`
                    : isServiceClerk
                    ? `Add ${allocatedBranch?.shortName ?? 'Branch'} Service Special`
                    : `Add ${allocatedBranch?.shortName ?? 'Branch'} Special / Event`}
                </span>
              </Button>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-3.5 text-xs text-[#475569]">
              Campaigns whose <strong>Valid Until</strong> date is before today (
              <span className="font-mono text-[#091224]">{todayISO}</span>) are automatically hidden from public dealership sites. Use <strong>Bring Back</strong> on archived items to relaunch them.
            </div>

            {filteredPromotions.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center text-sm text-[#475569]">
                No promotions match your current tab or filter criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredPromotions.map((promo) => {
                  const visibilityLabel =
                    promo.scope === 'MASTER'
                      ? 'All Dealerships (Master)'
                      : `${dealershipsById[promo.dealershipId ?? '']?.shortName ?? `Branch ${promo.dealershipId}`} Only (ID ${promo.dealershipId})`;

                  return (
                    <div
                      key={promo.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
                    >
                      <div className="relative h-40 w-full bg-[#F1F5F9]">
                        <PromotionMedia
                          src={promo.imageUrl}
                          alt={promo.title}
                          mediaType={promo.mediaType}
                        />
                        <span className="absolute top-2.5 left-2.5 rounded bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[#001E50] uppercase shadow-xs">
                          {promo.type}
                        </span>
                        <span className="absolute top-2.5 right-2.5 rounded bg-[#001E50] px-2 py-0.5 text-[10px] font-semibold text-white">
                          {visibilityLabel}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                        <div className="space-y-1.5">
                          <h3 className="font-display text-base font-semibold text-[#091224]">
                            {promo.title}
                          </h3>
                          {promo.vehicleName && (
                            <p className="text-xs font-medium text-[#00437A]">{promo.vehicleName}</p>
                          )}
                          <p className="text-xs text-[#475569] line-clamp-3">{promo.description}</p>
                          <div className="pt-2 font-mono text-xs text-[#334155] space-y-0.5">
                            <p>Valid Until: {promo.validUntil}</p>
                            {promo.offerPrice > 0 && (
                              <p>
                                Offer: {formatZAR(promo.offerPrice)}
                                {promo.monthlyFrom > 0 ? ` · ${formatZAR(promo.monthlyFrom)} p/m` : ''}
                              </p>
                            )}
                            {promo.eventTime && <p>Time: {promo.eventTime}</p>}
                            {promo.location && <p>Location: {promo.location}</p>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-3">
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditingPromo({
                                  ...promo,
                                  visibilityChoice:
                                    promo.scope === 'MASTER' ? 'MASTER' : promo.dealershipId ?? '1',
                                })
                              }
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>

                            {promoSubTab === 'active' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await archivePromotion(promo.id);
                                  showFlash(`Archived "${promo.title}".`);
                                }}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                <span>Archive</span>
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setReactivatingPromo(promo);
                                  setReactivateExpiryDate(addDaysISO(todayISO, 30));
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Bring Back</span>
                              </Button>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await deletePromotion(promo.id);
                              showFlash(`Deleted "${promo.title}".`);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* USERS & ROLES TAB (GROUP ADMIN, IT MANAGER & BRANCH ADMIN ROSTER) */}
        {canViewUsers && activeTab === 'users' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#091224]">
                  {isBranchAdmin && !isAdmin && !isItManager
                    ? `${allocatedBranch?.name ?? 'Branch'} Staff Roster (Read-Only)`
                    : 'Dealership Staff Users & Access Roles'}
                </h2>
                <p className="text-xs text-[#475569]">
                  {isBranchAdmin && !isAdmin && !isItManager
                    ? 'View staff roles assigned to your dealership branch. Creating or modifying accounts is managed by Group Administrators or IT Managers.'
                    : 'Add Branch Admins, IT Agents, Car Sales Executives, Marketing, Parts Agents, Service Booking Agents, or Group/IT Managers. New staff configure a personal password on first sign-in.'}
                </p>
              </div>

              {canManageStaff && (
                <Button
                  onClick={() => {
                    setNewStaffFullName('');
                    setNewStaffPhone('');
                    setNewStaffEmail('');
                    setNewStaffRole('agent');
                    setNewStaffBranchId(activeDealerships[0]?.id ?? activeDealership.id);
                    setNewStaffPassword(generateSecureRandomPassword(12));
                    setStaffModalError(null);
                    setCreatedStaffReceipt(null);
                    setShowCreateStaffModal(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Add Staff User</span>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Group &amp; Branch Admins</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {
                    scopedStaffUsers.filter(
                      (s) => (s.role === 'admin' || s.role === 'branch_admin') && s.active
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">IT Managers &amp; Agents</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {
                    scopedStaffUsers.filter(
                      (s) => (s.role === 'it_manager' || s.role === 'it_agent') && s.active
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Sales &amp; Marketing</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {
                    scopedStaffUsers.filter(
                      (s) => (s.role === 'agent' || s.role === 'marketing') && s.active
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Parts &amp; Service Desk</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {
                    scopedStaffUsers.filter(
                      (s) => (s.role === 'parts' || s.role === 'service') && s.active
                    ).length
                  }
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Pending First Setup</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {scopedStaffUsers.filter((s) => s.mustChangePassword && s.active).length}
                </p>
              </div>
            </div>

            {filteredStaffUsers.length === 0 ? (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center space-y-3">
                <p className="text-sm font-medium text-[#091224]">
                  No staff user profiles found
                </p>
                <p className="text-xs text-[#475569] max-w-md mx-auto">
                  {canManageStaff
                    ? `Click Add Staff User above to assign staff across ${groupProfile.groupName} branches.`
                    : `No staff profiles are currently allocated to ${allocatedBranch?.name ?? 'this branch'}.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs uppercase text-[#475569]">
                    <tr>
                      <th className="px-4 py-3">Staff Member</th>
                      <th className="px-4 py-3">Role Privilege</th>
                      <th className="px-4 py-3">Allocated Dealership</th>
                      <th className="px-4 py-3">Password Setup</th>
                      <th className="px-4 py-3">Status</th>
                      {canManageStaff && <th className="px-4 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredStaffUsers.map((staff) => {
                      const branch = staff.allocatedDealershipId
                        ? dealershipsById[staff.allocatedDealershipId]
                        : null;
                      const isSelf = staff.uid === user.uid;
                      const roleMeta = STAFF_ROLE_META[staff.role] ?? STAFF_ROLE_META.agent;
                      const isProtectedRow =
                        !isAdmin && (staff.role === 'admin' || staff.role === 'it_manager');

                      return (
                        <tr key={staff.uid} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-[#091224]">
                              {staff.fullName}
                              {isSelf ? ' (You)' : ''}
                            </p>
                            <p className="font-mono text-xs text-[#475569]">{staff.email}</p>
                            <p className="font-mono text-xs text-[#64748B] tabular-nums">
                              {staff.phone}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold',
                                roleMeta.badgeClass
                              )}
                            >
                              {roleMeta.label}
                            </span>
                            <p className="mt-1 text-[11px] text-[#64748B]">
                              {roleMeta.scopeSummary}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            {branch ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#001E50]/5 px-2 py-1 font-medium text-[#001E50]">
                                <MapPin className="h-3 w-3" />
                                {branch.shortName} (ID {branch.id})
                              </span>
                            ) : staff.allocatedDealershipId ? (
                              <span className="text-amber-700 font-medium">
                                Unassigned Branch ({staff.allocatedDealershipId})
                              </span>
                            ) : (
                              <span className="text-[#475569]">All Group Dealerships</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold',
                                staff.mustChangePassword
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-emerald-50 text-emerald-800'
                              )}
                            >
                              {staff.mustChangePassword ? 'Pending First Setup' : 'Configured'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                                staff.active
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              )}
                            >
                              {staff.active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          {canManageStaff && (
                            <td className="px-4 py-3.5 text-right">
                              {isProtectedRow ? (
                                <span className="text-[11px] font-medium text-[#64748B]">
                                  Group Admin Only
                                </span>
                              ) : confirmRemoveStaffUid === staff.uid ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmRemoveStaffUid(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await removeStaffUser(staff.uid);
                                        setConfirmRemoveStaffUid(null);
                                        showFlash(
                                          `Removed ${staff.fullName} and revoked dealership access.`
                                        );
                                      } catch (err) {
                                        setActionError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Unable to remove staff user.'
                                        );
                                      }
                                    }}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Confirm Remove
                                  </Button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Edit Role / Dealership / Details"
                                    onClick={() => setEditingStaffUser({ ...staff })}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Send Password Reset Email"
                                    onClick={async () => {
                                      try {
                                        await sendStaffPasswordReset(staff.email);
                                        showFlash(
                                          `Password reset link sent to ${staff.email}.`
                                        );
                                      } catch (err) {
                                        setActionError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Unable to send reset email.'
                                        );
                                      }
                                    }}
                                  >
                                    <Mail className="h-3.5 w-3.5 text-[#00437A]" />
                                  </Button>
                                  {isAdmin && !isSelf && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Remove Staff User"
                                      onClick={() => setConfirmRemoveStaffUid(staff.uid)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* GROUP & BRANCHES TAB */}
        {canViewBranches && activeTab === 'branches' && (
          <div className="space-y-6">
            {/* White-Label Dealership Group Corporate Registration */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!isAdmin) return;
                setBusyAction(true);
                setGroupSaveError(null);
                try {
                  await saveGroupProfile(groupDraft);
                  showFlash(`Saved corporate group identity for ${groupDraft.groupName}.`);
                } catch (err) {
                  setGroupSaveError(
                    err instanceof Error ? err.message : 'Unable to save group corporate profile.'
                  );
                } finally {
                  setBusyAction(false);
                }
              }}
              className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                <div>
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#00437A]">
                    White-Label Group Registration
                  </span>
                  <h2 className="font-display text-xl font-semibold text-[#091224]">
                    Dealership Group Corporate Profile
                  </h2>
                  <p className="text-xs text-[#475569]">
                    {isAdmin
                      ? 'Configure group branding, FSP registration, POPIA officer, roadside numbers, and default fallback branch across all public pages.'
                      : 'Corporate group profile & FSP details (view-only for IT Manager; branch configurations & SMTP settings below are editable).'}
                  </p>
                </div>
                {isAdmin && (
                  <Button type="submit" disabled={busyAction}>
                    <Save className="h-4 w-4" />
                    <span>Save Group Profile</span>
                  </Button>
                )}
              </div>

              {groupSaveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  {groupSaveError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Dealership Group Display Name *</Label>
                  <Input
                    value={groupDraft.groupName}
                    onChange={(e) => setGroupDraft({ ...groupDraft, groupName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Holding Legal Entity *</Label>
                  <Input
                    value={groupDraft.legalEntity}
                    onChange={(e) => setGroupDraft({ ...groupDraft, legalEntity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Authorised Group FSP Number *</Label>
                  <Input
                    value={groupDraft.fspNumber}
                    onChange={(e) => setGroupDraft({ ...groupDraft, fspNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>POPIA / Information Officer *</Label>
                  <Input
                    value={groupDraft.complianceOfficer}
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, complianceOfficer: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Compliance Email *</Label>
                  <Input
                    type="email"
                    value={groupDraft.complianceEmail}
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, complianceEmail: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Default Landing Branch *</Label>
                  <Select
                    value={groupDraft.defaultBranchId}
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, defaultBranchId: e.target.value })
                    }
                  >
                    {activeDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (ID {b.id})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>VW Roadside Toll-Free *</Label>
                  <Input
                    value={groupDraft.vwRoadsideTollFree}
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, vwRoadsideTollFree: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>VW Roadside Cross-Border *</Label>
                  <Input
                    value={groupDraft.vwRoadsideCrossBorder}
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, vwRoadsideCrossBorder: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Group YouTube Channel URL</Label>
                  <Input
                    type="url"
                    value={groupDraft.youtubeUrl}
                    placeholder="https://www.youtube.com/@..."
                    onChange={(e) => setGroupDraft({ ...groupDraft, youtubeUrl: e.target.value })}
                  />
                </div>
                <LogoUploadField
                  label="Group Footer Logo URL / Path *"
                  value={groupDraft.groupLogoSrc}
                  previewBg="dark"
                  hint="Recommended: transparent PNG, WebP, or SVG light/white group logo (max 8 MB)."
                  onChange={(url) => setGroupDraft({ ...groupDraft, groupLogoSrc: url })}
                />
                <LogoUploadField
                  label="Header Emblem Logo URL / Path *"
                  value={groupDraft.emblemLogoSrc}
                  previewBg="light"
                  hint="Recommended: square emblem PNG, WebP, or SVG (max 8 MB)."
                  onChange={(url) => setGroupDraft({ ...groupDraft, emblemLogoSrc: url })}
                />
                <div>
                  <Label>Test-Drive Hours Summary *</Label>
                  <Input
                    value={groupDraft.testDriveHoursSummary}
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, testDriveHoursSummary: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Default Lead Notification Email *</Label>
                  <Input
                    type="email"
                    value={groupDraft.defaultNotifyEmail ?? ''}
                    placeholder="leads@yourdealershipgroup.co.za"
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, defaultNotifyEmail: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Primary Website / Vercel Hosting URL (APP_URL)</Label>
                  <Input
                    type="url"
                    value={groupDraft.primarySiteUrl ?? ''}
                    placeholder="https://your-dealership.vercel.app or https://www.yourgroup.co.za"
                    onChange={(e) =>
                      setGroupDraft({ ...groupDraft, primarySiteUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Group Fallback Outgoing Mail & Required APIs Registration */}
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileCode2 className="h-4 w-4 text-[#001E50]" />
                      <h3 className="font-display text-sm font-semibold text-[#091224]">
                        Group Hosting, API Integrations &amp; Fallback Mail Defaults
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-[#475569]">
                      Configure group-wide defaults for <code>.env</code> / Vercel Environment Variables and inspect live API secret readiness. Raw API keys &amp; passwords are never stored in the database.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void fetchSystemStatus();
                        setHandoverManualTab('acquire-apis');
                        setShowHandoverManual(true);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>How to Acquire APIs &amp; Examples</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        void fetchSystemStatus();
                        setHandoverManualTab('env-builder');
                        setShowHandoverManual(true);
                      }}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Open .env Builder &amp; Handover Manual</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label>Group SMTP Host (SMTP_HOST)</Label>
                    <Input
                      value={groupDraft.smtpHost ?? 'smtp.gmail.com'}
                      placeholder="smtp.gmail.com"
                      onChange={(e) => setGroupDraft({ ...groupDraft, smtpHost: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Group SMTP Port (SMTP_PORT)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={groupDraft.smtpPort ?? 465}
                      onChange={(e) =>
                        setGroupDraft({ ...groupDraft, smtpPort: Number(e.target.value) || 465 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Group Sender Email (SMTP_USER)</Label>
                    <Input
                      type="email"
                      value={groupDraft.smtpUser ?? ''}
                      placeholder="noreply@yourgroup.co.za"
                      onChange={(e) => setGroupDraft({ ...groupDraft, smtpUser: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Group Display From (SMTP_FROM)</Label>
                    <Input
                      value={groupDraft.smtpFrom ?? ''}
                      placeholder="Your VW Group <noreply@yourgroup.co.za>"
                      onChange={(e) => setGroupDraft({ ...groupDraft, smtpFrom: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#CBD5E1] bg-white px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 font-medium text-[#091224] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupDraft.licenceScannerEnabled ?? true}
                        onChange={(e) =>
                          setGroupDraft({
                            ...groupDraft,
                            licenceScannerEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>Enable AI Licence Disc Scanner (<code>GEMINI_API_KEY</code>)</span>
                    </label>
                    <label className="inline-flex items-center gap-2 font-medium text-[#091224] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={groupDraft.autotraderSyncDefault ?? true}
                        onChange={(e) =>
                          setGroupDraft({
                            ...groupDraft,
                            autotraderSyncDefault: e.target.checked,
                          })
                        }
                      />
                      <span>Enable AutoTrader Scraper (<code>DECODO_API_KEY</code>)</span>
                    </label>
                  </div>

                  {systemStatus && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
                          systemStatus.apis.gemini.configured
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        )}
                      >
                        {systemStatus.apis.gemini.configured ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        GEMINI_API_KEY
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
                          systemStatus.apis.globalSmtp.configured
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        )}
                      >
                        {systemStatus.apis.globalSmtp.configured ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        SMTP_PASS
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
                          systemStatus.apis.decodo.configured
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        )}
                      >
                        DECODO_API_KEY: {systemStatus.apis.decodo.configured ? 'Connected' : 'Optional'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Automatic Lead Email Dispatch (Nodemailer SMTP) Status & Test */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Mail className="h-4 w-4 text-[#001E50]" />
                      <h3 className="font-display text-sm font-semibold text-[#091224]">
                        Automatic Customer Request Emails (Nodemailer SMTP)
                      </h3>
                      {emailStatus && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                            emailStatus.configured
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          )}
                        >
                          {emailStatus.configured ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {emailStatus.configured
                            ? 'SMTP_PASS Connected'
                            : 'Waiting for SMTP_PASS Secret'}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#475569]">
                      Dispatches real-time emails whenever visitors submit Test Drives, Service Bookings, Parts Enquiries, Finance Applications, Contact forms, Events, or Competitions.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSmtpGuideTarget('group')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Setup Guide &amp; Manual</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingEmailStatus}
                      onClick={() => void fetchEmailStatus(selectedBranchId)}
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', loadingEmailStatus && 'animate-spin')}
                      />
                      <span>Refresh Status</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={testingEmail || !emailStatus?.configured}
                      onClick={async () => {
                        if (!user) return;
                        setTestingEmail(true);
                        setEmailStatusError(null);
                        setTestEmailResult(null);
                        try {
                          const token = await user.getIdToken();
                          const response = await fetch('/api/notify-lead/test', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              branchId: selectedBranchId,
                              targetEmail:
                                groupDraft.defaultNotifyEmail?.trim() ||
                                branchDraft.salesNotifyEmail?.trim() ||
                                undefined,
                            }),
                          });
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data?.error || 'Unable to send test email.');
                          }
                          setTestEmailResult(
                            `Test email sent from ${data.from} to ${data.to}. Check your inbox!`
                          );
                        } catch (err) {
                          setEmailStatusError(
                            err instanceof Error ? err.message : 'Unable to send test email.'
                          );
                        } finally {
                          setTestingEmail(false);
                        }
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>{testingEmail ? 'Sending Test...' : 'Send Test Email'}</span>
                    </Button>
                  </div>
                </div>

                {emailStatus && (
                  <div className="grid grid-cols-1 gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-3 text-xs text-[#334155] sm:grid-cols-3">
                    <div>
                      <span className="font-semibold text-[#091224]">SMTP Host: </span>
                      {emailStatus.host}:{emailStatus.port}
                    </div>
                    <div>
                      <span className="font-semibold text-[#091224]">Sender Account: </span>
                      {emailStatus.senderEmail}
                    </div>
                    <div>
                      <span className="font-semibold text-[#091224]">Group Fallback Recipient: </span>
                      {groupDraft.defaultNotifyEmail || emailStatus.defaultRecipient}
                    </div>
                  </div>
                )}

                {emailStatus && !emailStatus.configured && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    To activate automatic emails, open AI Studio <strong>Settings &rarr; Secrets</strong> (or <code>.env</code> when self-hosting), add <code>SMTP_PASS</code> with your 16-character Gmail App Password, then click <strong>Refresh Status</strong> above.
                  </p>
                )}

                {testEmailResult && (
                  <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    {testEmailResult}
                  </p>
                )}

                {emailStatusError && (
                  <p className="text-xs text-red-900 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {emailStatusError}
                  </p>
                )}
              </div>
            </form>

            {/* Multi-Branch Directory & Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {allDealerships.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0',
                      selectedBranchId === branch.id
                        ? 'bg-[#001E50] text-white'
                        : branch.archived
                        ? 'border border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400'
                        : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#001E50]'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      ID {branch.id}: {branch.shortName}
                      {branch.archived ? ' (Archived)' : ''}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const nextNum = allDealerships.length + 1;
                    setAddBranchError(null);
                    setNewBranchDraft({
                      id: `branch-${nextNum}`,
                      name: '',
                      shortName: '',
                      referenceCode: `VW${nextNum}`,
                      legalEntity: groupProfile.legalEntity,
                      fspNumber: groupProfile.fspNumber,
                      domain: '',
                      receptionNumber: '',
                      whatsappNumber: '',
                      email: '',
                      salesNotifyEmail: '',
                      serviceNotifyEmail: '',
                      partsNotifyEmail: '',
                      financeNotifyEmail: '',
                      generalNotifyEmail: '',
                      smtpHost: 'smtp.gmail.com',
                      smtpPort: 465,
                      smtpUser: '',
                      smtpFrom: '',
                      defaultNotifyEmail: '',
                      smtpPassEnvKey: `SMTP_PASS_BRANCH_${nextNum}`,
                      physicalAddress: '',
                      postalAddress: '',
                      city: '',
                      province: 'KwaZulu-Natal',
                      salesHours: 'Mon-Fri: 08:00 - 17:00 | Sat: 08:00 - 12:00 | Sun: Closed',
                      serviceHours: 'Mon-Fri: 07:30 - 17:00 | Sat-Sun: Closed',
                      roadsideAssist: '0860 434 737',
                      vwFinancialServices: '0861 500 400',
                      volkswagensure: '0800 204 638',
                      mapEmbedUrl: '',
                      facebookUrl: '',
                      instagramUrl: '',
                      youtubeUrl: groupProfile.youtubeUrl,
                      autotraderDealerId: '',
                      autotraderUrl: '',
                      syncEnabled: false,
                      archived: false,
                      sortOrder: nextNum,
                    });
                    setShowAddBranchModal(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add New Branch</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    switchPreviewBranch(selectedBranchId);
                    showFlash(`Site preview switched to ${branchDraft.name} (?branch=${selectedBranchId}).`);
                  }}
                >
                  Preview {branchDraft.shortName} Live Site
                </Button>
              </div>
            </div>

            {branchDraft.archived && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs text-amber-950">
                <span>
                  <strong>{branchDraft.name}</strong> is currently <strong>Archived</strong> and hidden from public branch switchers. Existing historical vehicles and staff records remain intact until reassigned.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyAction}
                  onClick={async () => {
                    setBusyAction(true);
                    try {
                      await setDealershipArchived(branchDraft.id, false);
                      showFlash(`Restored ${branchDraft.name} to active public directories.`);
                    } catch (err) {
                      setActionError(
                        err instanceof Error ? err.message : 'Unable to restore branch.'
                      );
                    } finally {
                      setBusyAction(false);
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Branch</span>
                </Button>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusyAction(true);
                setBranchSaveError(null);
                try {
                  await saveDealershipSettings(branchDraft);
                  showFlash(`Saved live Firestore settings for ${branchDraft.name} (ID ${branchDraft.id}).`);
                } catch (err) {
                  setBranchSaveError(
                    err instanceof Error ? err.message : 'Unable to save branch settings.'
                  );
                } finally {
                  setBusyAction(false);
                }
              }}
              className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#091224]">
                    {branchDraft.name} Configuration (Document ID: {branchDraft.id})
                  </h2>
                  <p className="text-xs text-[#475569]">
                    Updates apply immediately to the navbar, footer, contact page, maps, SEO titles, social links, and lead routing for {branchDraft.domain}.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!branchDraft.archived && activeDealerships.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyAction}
                      onClick={async () => {
                        setBusyAction(true);
                        try {
                          await setDealershipArchived(branchDraft.id, true);
                          showFlash(`Archived ${branchDraft.name}. Public visitors can no longer select it.`);
                        } catch (err) {
                          setBranchSaveError(
                            err instanceof Error ? err.message : 'Unable to archive branch.'
                          );
                        } finally {
                          setBusyAction(false);
                        }
                      }}
                    >
                      <Archive className="h-4 w-4" />
                      <span>Archive Branch</span>
                    </Button>
                  )}
                  <Button type="submit" disabled={busyAction}>
                    <Save className="h-4 w-4" />
                    <span>Save Branch Settings</span>
                  </Button>
                </div>
              </div>

              {branchSaveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                  {branchSaveError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label>Dealership Display Name *</Label>
                  <Input
                    value={branchDraft.name}
                    onChange={(e) => setBranchDraft({ ...branchDraft, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Short Name *</Label>
                  <Input
                    value={branchDraft.shortName}
                    onChange={(e) => setBranchDraft({ ...branchDraft, shortName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Booking Reference Prefix (e.g. NVW, EVW) *</Label>
                  <Input
                    value={branchDraft.referenceCode ?? ''}
                    placeholder="e.g. NVW"
                    maxLength={10}
                    onChange={(e) =>
                      setBranchDraft({
                        ...branchDraft,
                        referenceCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Production Domain *</Label>
                  <Input
                    value={branchDraft.domain}
                    onChange={(e) => setBranchDraft({ ...branchDraft, domain: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Legal Entity *</Label>
                  <Input
                    value={branchDraft.legalEntity}
                    onChange={(e) => setBranchDraft({ ...branchDraft, legalEntity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Authorised FSP Number *</Label>
                  <Input
                    value={branchDraft.fspNumber}
                    onChange={(e) => setBranchDraft({ ...branchDraft, fspNumber: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Reception Telephone *</Label>
                  <Input
                    value={branchDraft.receptionNumber}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, receptionNumber: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>WhatsApp Number (Optional)</Label>
                  <Input
                    value={branchDraft.whatsappNumber}
                    placeholder="e.g. 082 512 5405 (blank if none)"
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, whatsappNumber: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Branch Enquiries Email *</Label>
                  <Input
                    type="email"
                    value={branchDraft.email}
                    onChange={(e) => setBranchDraft({ ...branchDraft, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={branchDraft.city}
                    onChange={(e) => setBranchDraft({ ...branchDraft, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Province *</Label>
                  <Input
                    value={branchDraft.province}
                    onChange={(e) => setBranchDraft({ ...branchDraft, province: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Sort Order (1, 2, 3...)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={branchDraft.sortOrder ?? 1}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, sortOrder: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Physical Street Address *</Label>
                  <Input
                    value={branchDraft.physicalAddress}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, physicalAddress: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Postal Address (Optional)</Label>
                  <Input
                    value={branchDraft.postalAddress}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, postalAddress: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Department Customer Request Notification Emails (Required) */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#091224]">
                      Department Customer Request Routing Emails (Required)
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Every customer request submitted for this branch is automatically emailed to the responsible department address below.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const fallback =
                        branchDraft.email.trim() ||
                        groupDraft.defaultNotifyEmail?.trim() ||
                        'smokeydhlamini@gmail.com';
                      setBranchDraft({
                        ...branchDraft,
                        salesNotifyEmail: fallback,
                        serviceNotifyEmail: fallback,
                        partsNotifyEmail: fallback,
                        financeNotifyEmail: fallback,
                        generalNotifyEmail: fallback,
                      });
                    }}
                  >
                    Fill All from Branch / Group Email
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>Sales &amp; Test-Drive Requests Email *</Label>
                    <Input
                      type="email"
                      value={branchDraft.salesNotifyEmail ?? ''}
                      placeholder="sales@branch.co.za"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, salesNotifyEmail: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Service Booking Requests Email *</Label>
                    <Input
                      type="email"
                      value={branchDraft.serviceNotifyEmail ?? ''}
                      placeholder="service@branch.co.za"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, serviceNotifyEmail: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Parts Enquiries Email *</Label>
                    <Input
                      type="email"
                      value={branchDraft.partsNotifyEmail ?? ''}
                      placeholder="parts@branch.co.za"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, partsNotifyEmail: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Finance Applications Email *</Label>
                    <Input
                      type="email"
                      value={branchDraft.financeNotifyEmail ?? ''}
                      placeholder="finance@branch.co.za"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, financeNotifyEmail: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Contact, Events &amp; Competitions Email *</Label>
                    <Input
                      type="email"
                      value={branchDraft.generalNotifyEmail ?? ''}
                      placeholder="enquiries@branch.co.za"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, generalNotifyEmail: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Branch Outgoing Email Server (Nodemailer SMTP - Required) */}
              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Server className="h-4 w-4 text-[#001E50]" />
                      <h3 className="font-display text-sm font-semibold text-[#091224]">
                        Branch Outgoing Email Server (Nodemailer SMTP — Required)
                      </h3>
                      {emailStatus?.branchStatus &&
                        emailStatus.branchStatus.branchId === branchDraft.id && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                              emailStatus.branchStatus.branchSecretConfigured
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            )}
                          >
                            {emailStatus.branchStatus.branchSecretConfigured ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {emailStatus.branchStatus.branchSecretConfigured
                              ? `${emailStatus.branchStatus.branchPassKey} Connected`
                              : `Add ${emailStatus.branchStatus.branchPassKey} in Secrets / .env`}
                          </span>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-[#475569]">
                      Customer enquiries submitted on {branchDraft.shortName} are sent from this branch&apos;s own email identity (e.g. <code>web@{branchDraft.domain.replace(/^www\./, '') || 'branch.co.za'}</code>).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSmtpGuideTarget('editBranch')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Help / Setup Guide &amp; Download Manual</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cleanDom =
                          branchDraft.domain
                            .trim()
                            .toLowerCase()
                            .replace(/^https?:\/\//i, '')
                            .replace(/^www\./, '') || 'branchvw.co.za';
                        const senderEmail = `web@${cleanDom}`;
                        const branchSlug =
                          branchDraft.id
                            .toUpperCase()
                            .replace(/[^A-Z0-9]+/g, '_')
                            .replace(/^_+|_+$/g, '') || 'MAIN';
                        setBranchDraft({
                          ...branchDraft,
                          smtpHost: branchDraft.smtpHost?.trim() || `mail.${cleanDom}`,
                          smtpPort: branchDraft.smtpPort || 465,
                          smtpUser: senderEmail,
                          smtpFrom: `${branchDraft.name || 'Dealership'} <${senderEmail}>`,
                          defaultNotifyEmail:
                            branchDraft.defaultNotifyEmail?.trim() ||
                            branchDraft.email.trim() ||
                            `leads@${cleanDom}`,
                          smtpPassEnvKey:
                            branchDraft.smtpPassEnvKey?.trim() ||
                            `SMTP_PASS_BRANCH_${branchSlug}`,
                        });
                      }}
                    >
                      Auto-Fill from Domain
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={testingEmail}
                      onClick={async () => {
                        if (!user) return;
                        setTestingEmail(true);
                        setEmailStatusError(null);
                        setTestEmailResult(null);
                        try {
                          const token = await user.getIdToken();
                          const response = await fetch('/api/notify-lead/test', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              branchId: branchDraft.id,
                              targetEmail:
                                branchDraft.defaultNotifyEmail?.trim() ||
                                branchDraft.salesNotifyEmail?.trim() ||
                                undefined,
                            }),
                          });
                          const data = await response.json();
                          if (!response.ok) {
                            throw new Error(data?.error || 'Unable to send branch test email.');
                          }
                          showFlash(
                            `Sent branch test email from ${data.from} to ${data.to}.`
                          );
                        } catch (err) {
                          setBranchSaveError(
                            err instanceof Error ? err.message : 'Unable to send branch test email.'
                          );
                        } finally {
                          setTestingEmail(false);
                        }
                      }}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>{testingEmail ? 'Testing...' : 'Send Branch Test Email'}</span>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>SMTP Host (SMTP_HOST) *</Label>
                    <Input
                      value={branchDraft.smtpHost ?? ''}
                      placeholder="mail.ladysmithvw.co.za or smtp.gmail.com"
                      onChange={(e) => setBranchDraft({ ...branchDraft, smtpHost: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>SMTP Port (SMTP_PORT) *</Label>
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      value={branchDraft.smtpPort ?? 465}
                      placeholder="465"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, smtpPort: Number(e.target.value) || 465 })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Sender Mailbox / Login (SMTP_USER) *</Label>
                    <Input
                      type="email"
                      value={branchDraft.smtpUser ?? ''}
                      placeholder="web@ladysmithvw.co.za"
                      onChange={(e) => setBranchDraft({ ...branchDraft, smtpUser: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Sender Display Header (SMTP_FROM) *</Label>
                    <Input
                      value={branchDraft.smtpFrom ?? ''}
                      placeholder="Ladysmith Volkswagen <web@ladysmithvw.co.za>"
                      onChange={(e) => setBranchDraft({ ...branchDraft, smtpFrom: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Default Branch Lead Inbox (DEFAULT_LEAD_NOTIFY_EMAIL) *</Label>
                    <Input
                      type="email"
                      value={branchDraft.defaultNotifyEmail ?? ''}
                      placeholder="leads@ladysmithvw.co.za"
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, defaultNotifyEmail: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Password Secret Variable (SMTP_PASS Key) *</Label>
                    <Input
                      value={
                        branchDraft.smtpPassEnvKey ??
                        `SMTP_PASS_BRANCH_${branchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
                      }
                      placeholder="SMTP_PASS_BRANCH_LADYSMITH"
                      onChange={(e) =>
                        setBranchDraft({
                          ...branchDraft,
                          smtpPassEnvKey: e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_]/g, ''),
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#CBD5E1] bg-white px-4 py-3 text-xs text-[#334155]">
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-[#001E50] mt-0.5 shrink-0" />
                    <span>
                      <strong>SMTP_PASS Security:</strong> To keep mail passwords private from website visitors, add{' '}
                      <code className="rounded bg-[#F1F5F9] px-1.5 py-0.5 font-semibold text-[#001E50]">
                        {branchDraft.smtpPassEnvKey || `SMTP_PASS_BRANCH_${branchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`}
                      </code>{' '}
                      in AI Studio <strong>Settings &rarr; Secrets</strong> or your server&apos;s <code>.env</code> file.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const passKey =
                        branchDraft.smtpPassEnvKey ||
                        `SMTP_PASS_BRANCH_${branchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
                      const block = [
                        `SMTP_HOST="${branchDraft.smtpHost || ''}"`,
                        `SMTP_PORT="${branchDraft.smtpPort || 465}"`,
                        `SMTP_USER="${branchDraft.smtpUser || ''}"`,
                        `${passKey}="PASTE_MAILBOX_PASSWORD_HERE"`,
                        `SMTP_FROM="${branchDraft.smtpFrom || ''}"`,
                        `DEFAULT_LEAD_NOTIFY_EMAIL="${branchDraft.defaultNotifyEmail || ''}"`,
                      ].join('\n');
                      void copyText(`branch-env-${branchDraft.id}`, block);
                    }}
                  >
                    {copiedKey === `branch-env-${branchDraft.id}` ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {copiedKey === `branch-env-${branchDraft.id}`
                        ? 'Copied .env Block!'
                        : 'Copy Branch .env Block'}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Facebook Page URL (Optional)</Label>
                  <Input
                    type="url"
                    value={branchDraft.facebookUrl ?? ''}
                    placeholder="https://www.facebook.com/..."
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, facebookUrl: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Instagram URL (Optional)</Label>
                  <Input
                    type="url"
                    value={branchDraft.instagramUrl ?? ''}
                    placeholder="https://www.instagram.com/..."
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, instagramUrl: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>YouTube URL (Optional)</Label>
                  <Input
                    type="url"
                    value={branchDraft.youtubeUrl ?? ''}
                    placeholder="https://www.youtube.com/@..."
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, youtubeUrl: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Sales Trading Hours *</Label>
                  <Input
                    value={branchDraft.salesHours}
                    onChange={(e) => setBranchDraft({ ...branchDraft, salesHours: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Service &amp; Parts Trading Hours *</Label>
                  <Input
                    value={branchDraft.serviceHours}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, serviceHours: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>VW Roadside Assist *</Label>
                  <Input
                    value={branchDraft.roadsideAssist}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, roadsideAssist: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>VW Financial Services *</Label>
                  <Input
                    value={branchDraft.vwFinancialServices}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, vwFinancialServices: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>VolkswagenSure *</Label>
                  <Input
                    value={branchDraft.volkswagensure}
                    onChange={(e) =>
                      setBranchDraft({ ...branchDraft, volkswagensure: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* AutoTrader Dealer Integration Settings */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#091224]">
                      AutoTrader Stock Sync Integration
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Leave Dealer ID &amp; URL blank and disable sync if this branch is not listed on AutoTrader (manual vehicle entry remains active).
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#091224] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(branchDraft.syncEnabled)}
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, syncEnabled: e.target.checked })
                      }
                    />
                    <span>AutoTrader Sync Enabled</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>AutoTrader Dealer ID</Label>
                    <Input
                      value={branchDraft.autotraderDealerId ?? ''}
                      placeholder="e.g. 168682 (blank if none)"
                      onChange={(e) =>
                        setBranchDraft({
                          ...branchDraft,
                          autotraderDealerId: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>AutoTrader Dealer Showroom URL</Label>
                    <Input
                      type="url"
                      value={branchDraft.autotraderUrl ?? ''}
                      placeholder="https://www.autotrader.co.za/dealer/..."
                      onChange={(e) =>
                        setBranchDraft({ ...branchDraft, autotraderUrl: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Google Maps Embed URL *</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setBranchDraft({
                        ...branchDraft,
                        mapEmbedUrl: toGoogleMapsEmbedUrl(branchDraft.physicalAddress),
                      })
                    }
                    className="text-xs font-semibold text-[#00437A] hover:underline cursor-pointer"
                  >
                    Auto-Generate from Physical Address
                  </button>
                </div>
                <Input
                  value={branchDraft.mapEmbedUrl}
                  onChange={(e) => setBranchDraft({ ...branchDraft, mapEmbedUrl: e.target.value })}
                  required
                />
              </div>

              {/* Guarded Branch Removal & Dependency Check */}
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-[#091224]">
                      Branch Lifecycle &amp; Safe Removal
                    </h3>
                    <p className="text-xs text-[#475569]">
                      Deletion is blocked while any vehicles, branch-scoped campaigns, or assigned staff users reference{' '}
                      <strong>{branchDraft.shortName}</strong>.
                    </p>
                  </div>

                  {allDealerships.length > 1 && isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedBranchDeps.totalCount > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyAction || Boolean(branchDraft.archived)}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              await setDealershipArchived(branchDraft.id, true);
                              showFlash(`Archived ${branchDraft.name}.`);
                            } catch (err) {
                              setBranchSaveError(
                                err instanceof Error ? err.message : 'Unable to archive branch.'
                              );
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>
                            {branchDraft.archived ? 'Branch Archived' : 'Archive Branch Instead'}
                          </span>
                        </Button>
                      ) : confirmDeleteBranchId === branchDraft.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDeleteBranchId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={busyAction}
                            onClick={async () => {
                              setBusyAction(true);
                              setBranchSaveError(null);
                              try {
                                const deletedName = branchDraft.name;
                                await deleteBranchIfUnused(branchDraft.id);
                                setConfirmDeleteBranchId(null);
                                showFlash(`Deleted branch "${deletedName}".`);
                              } catch (err) {
                                setBranchSaveError(
                                  err instanceof Error ? err.message : 'Unable to delete branch.'
                                );
                              } finally {
                                setBusyAction(false);
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Confirm Permanent Delete</span>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmDeleteBranchId(branchDraft.id)}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete Branch Permanently</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {selectedBranchDeps.totalCount > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 space-y-2">
                    <p>
                      <strong>Deletion blocked:</strong> This branch currently holds{' '}
                      <span className="font-mono font-semibold tabular-nums">
                        {selectedBranchDeps.vehiclesCount}
                      </span>{' '}
                      vehicle(s),{' '}
                      <span className="font-mono font-semibold tabular-nums">
                        {selectedBranchDeps.promotionsCount}
                      </span>{' '}
                      branch promotion(s), and{' '}
                      <span className="font-mono font-semibold tabular-nums">
                        {selectedBranchDeps.staffCount}
                      </span>{' '}
                      assigned staff user(s). Archive it now or reassign those records first:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedBranchDeps.vehiclesCount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setVehicleBranchFilter(branchDraft.id);
                            setActiveTab('vehicles');
                          }}
                        >
                          Reassign Vehicles
                        </Button>
                      )}
                      {selectedBranchDeps.promotionsCount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPromoScopeFilter(branchDraft.id);
                            setActiveTab('promotions');
                          }}
                        >
                          Manage Branch Promotions
                        </Button>
                      )}
                      {selectedBranchDeps.staffCount > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveTab('users')}
                        >
                          Reassign Staff Users
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800">
                    Zero vehicles, branch promotions, or assigned staff users reference this branch. Safe to delete permanently if no longer needed.
                  </p>
                )}
              </div>
            </form>
          </div>
        )}

        {/* NEWS TAB */}
        {canViewNews && activeTab === 'news' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-[#091224]">
                Motoring News Articles
              </h2>
              <Button
                onClick={() =>
                  setEditingNews({
                    id: `news-${Date.now()}`,
                    title: '',
                    category: 'Dealership News',
                    publishedDate: todayISO,
                    readTime: '3 min read',
                    excerpt: '',
                    bodyText: '',
                    featured: false,
                    archived: false,
                    imageSrc: '/assets/aistudio/motoringNews1_18472e5f.jpg',
                  })
                }
              >
                <Plus className="h-4 w-4" />
                <span>Publish News Article</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredNews.map((article) => (
                <div
                  key={article.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4"
                >
                  <div className="flex gap-4">
                    <img
                      src={article.imageSrc}
                      alt={article.title}
                      className="h-20 w-28 rounded-lg object-cover border border-[#E2E8F0] shrink-0"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-[#00437A]">
                        {article.category} · {article.publishedDate}
                        {article.featured ? ' · Featured' : ''}
                        {article.archived ? ' · Archived' : ''}
                      </p>
                      <h3 className="font-display text-base font-semibold text-[#091224]">
                        {article.title}
                      </h3>
                      <p className="text-xs text-[#475569] line-clamp-2">{article.excerpt}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingNews({ ...article })}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await deleteNews(article.id);
                        showFlash(`Deleted article "${article.title}".`);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEADS TAB */}
        {canViewLeads && activeTab === 'leads' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#091224]">
                  {isAdmin || isItManager
                    ? 'Customer Leads & Booking Inbox'
                    : isBranchAdmin
                    ? `${allocatedBranch?.shortName ?? 'Branch'} Customer Leads & Booking Inbox`
                    : isPartsExec
                    ? `${allocatedBranch?.shortName ?? 'Branch'} Parts Requests Inbox`
                    : isServiceClerk
                    ? `${allocatedBranch?.shortName ?? 'Branch'} Service Bookings Inbox`
                    : `${allocatedBranch?.shortName ?? 'Branch'} Spotter Leads Inbox`}
                </h2>
                {!isAdmin && (
                  <p className="text-xs text-[#475569]">
                    {isSalesAgent && !isBranchAdmin && !isItManager
                      ? 'Spotter referral leads routed to your dealership sales desk. Update follow-up statuses below.'
                      : 'Update customer follow-up statuses below. Deleting lead records is restricted to Group Administrators.'}
                  </p>
                )}
              </div>
              {(isAdmin || isItManager) && (
                <Select
                  value={leadBranchFilter}
                  onChange={(e) => setLeadBranchFilter(e.target.value as 'All' | DealershipId)}
                  className="w-56 bg-white"
                >
                  <option value="All">Submitted at Any Branch</option>
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      From Site: {b.shortName} (ID {b.id})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {canFilterLeadSections && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-2">
                {(
                  [
                    { id: 'all', label: 'All Requests', count: leadSectionCounts.all },
                    { id: 'parts', label: 'Parts Only', count: leadSectionCounts.parts },
                    { id: 'service', label: 'Service Bookings', count: leadSectionCounts.service },
                    { id: 'spotters', label: 'Spotters', count: leadSectionCounts.spotters },
                    {
                      id: 'sales-other',
                      label: 'Sales & Other',
                      count: leadSectionCounts['sales-other'],
                    },
                  ] as const
                ).map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setLeadSectionFilter(sec.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                      leadSectionFilter === sec.id
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#091224]'
                    )}
                  >
                    <span>{sec.label}</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
                        leadSectionFilter === sec.id
                          ? 'bg-white/20 text-white'
                          : 'bg-[#F1F5F9] text-[#334155]'
                      )}
                    >
                      {sec.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {sortedLeads.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center text-sm text-[#475569]">
                No customer requests match your current section or search filter. Submissions appear here in real time.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedLeads.map((lead) => {
                  const submittedBranch = dealershipsById[lead.submittedAtDealershipId];
                  const homeBranch = lead.homeDealershipId
                    ? dealershipsById[lead.homeDealershipId]
                    : null;

                  return (
                    <div
                      key={lead.id}
                      className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 font-mono text-[11px] font-semibold uppercase',
                                isSpotterLead(lead)
                                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                                  : 'bg-[#001E50]/10 text-[#001E50]'
                              )}
                            >
                              {formatLeadTypeBadge(lead)}
                            </span>
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#00437A]">
                              From Site: {submittedBranch?.shortName ?? `ID ${lead.submittedAtDealershipId}`}
                            </span>
                            {homeBranch && (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#334155]">
                                Stock Branch: {homeBranch.shortName}
                              </span>
                            )}
                            <span className="font-mono text-xs text-[#64748B]">{lead.id}</span>
                          </div>
                          <h3 className="font-display text-base font-semibold text-[#091224]">
                            {lead.subject}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={lead.status}
                            onChange={async (e) => {
                              try {
                                await updateLeadStatus(
                                  lead.id,
                                  e.target.value as CmsLeadSubmission['status']
                                );
                                showFlash(`Updated lead status for ${lead.fullName}.`);
                              } catch (err) {
                                setActionError(
                                  err instanceof Error ? err.message : 'Unable to update status.'
                                );
                              }
                            }}
                            className="w-36"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="archived">Archived</option>
                          </Select>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void deleteLead(lead.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-xs text-[#334155] sm:grid-cols-3">
                        <p>
                          <strong className="text-[#091224]">Customer:</strong> {lead.fullName}
                        </p>
                        <p>
                          <strong className="text-[#091224]">Phone:</strong>{' '}
                          <span className="font-mono">{lead.phone}</span>
                        </p>
                        <p>
                          <strong className="text-[#091224]">Email:</strong> {lead.email}
                        </p>
                      </div>
                      <p className="rounded-lg bg-[#F8FAFC] p-3 font-mono text-xs text-[#475569] whitespace-pre-wrap leading-relaxed">
                        {lead.details}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CAREERS & APPLICATIONS TAB (GROUP ADMIN, IT MANAGER & BRANCH ADMIN) */}
        {canViewCareers && activeTab === 'careers' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setCareerSubTab('jobs')}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap shrink-0',
                    careerSubTab === 'jobs'
                      ? 'bg-[#001E50] text-white'
                      : 'text-[#475569] hover:text-[#091224]'
                  )}
                >
                  Job Openings ({allJobs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCareerSubTab('applications')}
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap shrink-0',
                    careerSubTab === 'applications'
                      ? 'bg-[#001E50] text-white'
                      : 'text-[#475569] hover:text-[#091224]'
                  )}
                >
                  Received Applications ({scopedJobApplications.length})
                </button>
              </div>

              {careerSubTab === 'jobs' ? (
                (isAdmin || isItManager) ? (
                  <Button
                    onClick={() =>
                      setEditingJob({
                        id: `job-${Date.now()}`,
                        title: '',
                        department: 'Vehicle Sales',
                        dealershipId: activeDealership.id,
                        locationLabel: `${activeDealership.city}, ${activeDealership.province}`,
                        employmentType: 'Full-Time',
                        summary: '',
                        requirements: '',
                        responsibilities: '',
                        applicationMode: 'internal',
                        externalApplyUrl: '',
                        requiresLicence: true,
                        licenceDescription: "Valid Code 8 (B) Driver's Licence",
                        closingDate: addDaysISO(todayISO, 45),
                        active: true,
                      })
                    }
                  >
                    <Plus className="h-4 w-4" />
                    <span>Post New Job Opening</span>
                  </Button>
                ) : (
                  <span className="text-xs text-[#64748B]">
                    Job openings are published group-wide by Group Admin / IT Manager.
                  </span>
                )
              ) : (
                <Select
                  aria-label="Filter applications by job opening"
                  value={applicationJobFilter}
                  onChange={(e) => setApplicationJobFilter(e.target.value)}
                  className="w-64 bg-white"
                >
                  <option value="All">All Positions ({scopedJobApplications.length})</option>
                  {allJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {careerSubTab === 'jobs' ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {allJobs.map((job) => {
                  const branchName =
                    job.dealershipId === null
                      ? `${groupProfile.groupName} Group`
                      : dealershipsById[job.dealershipId]?.name ?? job.locationLabel;
                  return (
                    <div
                      key={job.id}
                      className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-[11px] font-semibold text-[#00437A]">
                            {job.department} · {job.employmentType} · Closes {job.closingDate}
                          </p>
                          <h3 className="mt-1 font-display text-lg font-semibold text-[#091224]">
                            {job.title}
                          </h3>
                          <p className="text-xs text-[#64748B]">
                            {branchName} · {job.locationLabel}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={cn(
                              'rounded px-2 py-0.5 text-[11px] font-semibold',
                              job.active
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {job.active ? 'Active' : 'Closed'}
                          </span>
                          {(isAdmin || isItManager) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingJob(job)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await deleteJobOpening(job.id);
                                  showFlash(`Removed "${job.title}".`);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to delete job opening.'
                                  );
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#334155] leading-relaxed">{job.summary}</p>

                      <div className="border-t border-[#E2E8F0] pt-3 text-[11px] text-[#475569] space-y-1">
                        <p>
                          <strong>Application Source:</strong>{' '}
                          {job.applicationMode === 'external'
                            ? `External URL (${job.externalApplyUrl})`
                            : 'On-Site Application Form (with CV, Qualifications, ID & Licence uploads)'}
                        </p>
                        {job.applicationMode === 'internal' && (
                          <p>
                            <strong>Licence Requirement:</strong>{' '}
                            {job.requiresLicence
                              ? `Required — ${job.licenceDescription || "Driver's / Trade Licence"}`
                              : 'Optional'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              (() => {
                const visibleApps = scopedJobApplications.filter((app) =>
                  applicationJobFilter === 'All' ? true : app.jobId === applicationJobFilter
                );
                if (visibleApps.length === 0) {
                  return (
                    <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center text-sm text-[#475569]">
                      No candidate applications match your current filter yet.
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {visibleApps.map((app) => {
                      const appDocs = [
                        { key: 'cv', label: 'CV / Resume', doc: app.resumeDoc },
                        { key: 'qual', label: 'Qualifications', doc: app.qualificationDoc },
                        { key: 'id', label: 'Copy of ID', doc: app.idCopyDoc },
                        ...(app.licenceDoc
                          ? [{ key: 'lic', label: 'Licence', doc: app.licenceDoc }]
                          : []),
                      ];

                      return (
                        <div
                          key={app.id}
                          className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-[11px] font-semibold text-[#00437A]">
                                {app.jobTitle} · Ref: {app.id}
                              </p>
                              <h3 className="mt-1 font-display text-lg font-semibold text-[#091224]">
                                {app.fullName}
                              </h3>
                              <p className="text-xs text-[#64748B]">
                                {app.cityOrSuburb} · {app.yearsExperience} yrs experience · Highest
                                Qual: {app.highestQualification}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                aria-label="Application status"
                                value={app.status}
                                onChange={(e) => {
                                  const nextStatus = e.target.value as JobApplicationStatus;
                                  setPendingStatusEmail({
                                    application: app,
                                    targetStatus: nextStatus,
                                  });
                                }}
                                className="w-40"
                              >
                                <option value="new">New</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="interview">Interview</option>
                                <option value="rejected">Rejected</option>
                                <option value="archived">Archived</option>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                title="Open email draft & status update window"
                                onClick={() =>
                                  setPendingStatusEmail({
                                    application: app,
                                    targetStatus: app.status,
                                  })
                                }
                              >
                                <Mail className="h-3.5 w-3.5 text-[#00437A]" />
                                <span>Draft Update</span>
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void deleteJobApplication(app.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-xs text-[#334155] sm:grid-cols-2 lg:grid-cols-4">
                            <p>
                              <strong className="text-[#091224]">Email:</strong> {app.email}
                            </p>
                            <p>
                              <strong className="text-[#091224]">Phone:</strong>{' '}
                              <span className="font-mono">{app.phone}</span>
                            </p>
                            <p>
                              <strong className="text-[#091224]">ID / Passport:</strong>{' '}
                              <span className="font-mono">{app.idNumber}</span>
                            </p>
                            <p>
                              <strong className="text-[#091224]">Licence:</strong>{' '}
                              {app.driversLicenceCode || 'None specified'}
                            </p>
                          </div>

                          {app.coverNote && (
                            <p className="rounded-lg bg-[#F8FAFC] p-3 text-xs text-[#475569] whitespace-pre-wrap">
                              {app.coverNote}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-3">
                            <span className="text-xs font-semibold text-[#091224] mr-1 inline-flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5 text-[#00437A]" />
                              Documents:
                            </span>
                            {appDocs.map((entry) => {
                              const dlKey = `${app.id}:${entry.key}`;
                              return (
                                <div
                                  key={dlKey}
                                  className="inline-flex items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs font-semibold text-[#001E50]"
                                    onClick={() =>
                                      setViewingCareerDoc({
                                        url: entry.doc.url,
                                        fileName: entry.doc.fileName,
                                        mimeType: entry.doc.mimeType,
                                        docLabel: entry.label,
                                        applicantName: app.fullName,
                                      })
                                    }
                                  >
                                    <Eye className="h-3.5 w-3.5 text-[#00437A]" />
                                    <span>View {entry.label}</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    title={`Download ${entry.doc.fileName}`}
                                    aria-label={`Download ${entry.label}`}
                                    className="h-7 px-2 text-[#475569] hover:text-[#091224]"
                                    disabled={downloadingDocKey === dlKey}
                                    onClick={async () => {
                                      setDownloadingDocKey(dlKey);
                                      try {
                                        await downloadProtectedCareerDoc(
                                          entry.doc.url,
                                          entry.doc.fileName,
                                          user
                                        );
                                      } catch (err) {
                                        setActionError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Unable to download applicant document.'
                                        );
                                      } finally {
                                        setDownloadingDocKey(null);
                                      }
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* IT ESCALATION TICKETS TAB */}
        {canViewItTickets && activeTab === 'it-tickets' && <ItEscalationCenter />}
      </div>

      {/* JOB OPENING ADD / EDIT MODAL */}
      {editingJob && (
        <Dialog
          open
          onClose={() => setEditingJob(null)}
          title="Save Career Job Opening"
          subtitle="Choose Direct On-Site Application (requires CV, Qualifications, ID & optional/required Licence) or External Portal Redirect."
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await saveJobOpening(editingJob);
                setEditingJob(null);
                showFlash(`Saved career opportunity "${editingJob.title}".`);
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Unable to save job opening.'
                );
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Job Title *</Label>
                <Input
                  value={editingJob.title}
                  placeholder="e.g. New & MasterCars Sales Executive"
                  onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Department *</Label>
                <Input
                  value={editingJob.department}
                  placeholder="e.g. Vehicle Sales, Aftersales, Parts, Finance"
                  onChange={(e) => setEditingJob({ ...editingJob, department: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Dealership / Scope *</Label>
                <Select
                  value={editingJob.dealershipId ?? 'MASTER'}
                  onChange={(e) =>
                    setEditingJob({
                      ...editingJob,
                      dealershipId:
                        e.target.value === 'MASTER' ? null : (e.target.value as DealershipId),
                    })
                  }
                >
                  <option value="MASTER">Group-Wide (All Branches)</option>
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID {b.id})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Employment Type *</Label>
                <Select
                  value={editingJob.employmentType}
                  onChange={(e) =>
                    setEditingJob({
                      ...editingJob,
                      employmentType: e.target.value as JobEmploymentType,
                    })
                  }
                >
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Fixed-Term">Fixed-Term</option>
                  <option value="Apprenticeship">Apprenticeship</option>
                </Select>
              </div>
              <div>
                <Label>Closing Date *</Label>
                <Input
                  type="date"
                  value={editingJob.closingDate}
                  onChange={(e) => setEditingJob({ ...editingJob, closingDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Location Display *</Label>
                <Input
                  value={editingJob.locationLabel}
                  placeholder="e.g. Newcastle, KwaZulu-Natal"
                  onChange={(e) =>
                    setEditingJob({ ...editingJob, locationLabel: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Listing Status *</Label>
                <Select
                  value={editingJob.active ? 'active' : 'closed'}
                  onChange={(e) =>
                    setEditingJob({ ...editingJob, active: e.target.value === 'active' })
                  }
                >
                  <option value="active">Active (Visible on Careers Page)</option>
                  <option value="closed">Closed / Hidden</option>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4 space-y-3">
              <div>
                <Label>Application Workflow *</Label>
                <Select
                  value={editingJob.applicationMode}
                  onChange={(e) =>
                    setEditingJob({
                      ...editingJob,
                      applicationMode: e.target.value as JobApplicationMode,
                    })
                  }
                >
                  <option value="internal">
                    Direct On-Site Application (Uploads CV, Qualifications, ID &amp; Licence here)
                  </option>
                  <option value="external">
                    External Source Link (Redirect Applicant to External URL)
                  </option>
                </Select>
              </div>

              {editingJob.applicationMode === 'external' ? (
                <div>
                  <Label>External Application URL (https://...) *</Label>
                  <Input
                    type="url"
                    value={editingJob.externalApplyUrl ?? ''}
                    placeholder="https://www.vw.co.za/en/about-volkswagen/careers.html"
                    onChange={(e) =>
                      setEditingJob({ ...editingJob, externalApplyUrl: e.target.value })
                    }
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2.5 text-xs font-medium text-[#091224] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingJob.requiresLicence}
                      onChange={(e) =>
                        setEditingJob({ ...editingJob, requiresLicence: e.target.checked })
                      }
                      className="h-4 w-4 rounded accent-[#001E50]"
                    />
                    <span>
                      Require Applicant to Upload a Driver&apos;s Licence or Occupational Licence
                    </span>
                  </label>
                  {editingJob.requiresLicence && (
                    <div>
                      <Label>Required Licence Description</Label>
                      <Input
                        value={editingJob.licenceDescription ?? ''}
                        placeholder="e.g. Valid Code 8 (B) Driver's Licence / Red Seal Trade Licence"
                        onChange={(e) =>
                          setEditingJob({ ...editingJob, licenceDescription: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Role Summary *</Label>
              <Textarea
                rows={2}
                value={editingJob.summary}
                onChange={(e) => setEditingJob({ ...editingJob, summary: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Requirements &amp; Qualifications *</Label>
              <Textarea
                rows={2}
                value={editingJob.requirements}
                onChange={(e) => setEditingJob({ ...editingJob, requirements: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Key Responsibilities (Optional)</Label>
              <Textarea
                rows={2}
                value={editingJob.responsibilities ?? ''}
                onChange={(e) =>
                  setEditingJob({ ...editingJob, responsibilities: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditingJob(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Job Opening</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* VEHICLE ADD/EDIT MODAL */}
      {editingVehicle && (
        <Dialog
          open
          onClose={() => setEditingVehicle(null)}
          title="Save Master Group Stock Vehicle"
          subtitle={`All available stock automatically appears across active ${groupProfile.groupName} dealership sites with its Holding Branch badge.`}
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const extraUrls = editingVehicle.extraImagesText
                  .split(/[\n,]+/)
                  .map((u) => u.trim())
                  .filter(Boolean);
                const combinedImages = [editingVehicle.images[0], ...extraUrls].filter(Boolean);
                const { extraImagesText: _ignoreExtra, ...vehiclePayload } = editingVehicle;

                await saveVehicle({
                  ...vehiclePayload,
                  images: combinedImages,
                });
                setEditingVehicle(null);
                showFlash(`Saved "${editingVehicle.title}" to stock.`);
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Unable to save vehicle details.'
                );
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Vehicle Display Title *</Label>
                <Input
                  value={editingVehicle.title}
                  placeholder="e.g. 2026 Volkswagen T-Cross 1.0 TSI R-Line"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, title: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Model / Derivative *</Label>
                <Input
                  value={editingVehicle.model}
                  placeholder="e.g. T-Cross 1.0 TSI R-Line DSG"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, model: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Holding Dealership *</Label>
                {(isSalesAgent || isBranchAdmin) && !isAdmin && !isItManager ? (
                  <Input
                    value={`${allocatedBranch?.name ?? 'Assigned Branch'} (ID ${allocatedBranchId})`}
                    disabled
                    className="bg-[#F1F5F9] text-[#334155]"
                  />
                ) : (
                  <Select
                    value={editingVehicle.homeDealershipId}
                    onChange={(e) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        homeDealershipId: e.target.value as DealershipId,
                      })
                    }
                  >
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (ID {b.id})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div>
                <Label>Condition / Category *</Label>
                <Select
                  value={editingVehicle.category}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      category: e.target.value as CmsVehicle['category'],
                    })
                  }
                >
                  <option value="New">New</option>
                  <option value="Demo">Demo</option>
                  <option value="MasterCars">MasterCars</option>
                  <option value="Used">Used</option>
                </Select>
              </div>
              <div>
                <Label>Inventory Status *</Label>
                <Select
                  value={editingVehicle.status}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      status: e.target.value as VehicleStatus,
                    })
                  }
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <Label>Year *</Label>
                <Input
                  type="number"
                  min={2010}
                  max={2035}
                  value={editingVehicle.year}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, year: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label>Selling Price (ZAR) *</Label>
                <Input
                  type="number"
                  min={1000}
                  value={editingVehicle.price}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, price: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label>Monthly From (ZAR) *</Label>
                <Input
                  type="number"
                  min={100}
                  value={editingVehicle.monthlyFrom}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      monthlyFrom: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label>Mileage (km) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingVehicle.mileage}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, mileage: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Body Style *</Label>
                <Select
                  value={editingVehicle.bodyStyle}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      bodyStyle: e.target.value as CmsVehicle['bodyStyle'],
                    })
                  }
                >
                  <option value="Hatchbacks & Sedans">Hatchbacks &amp; Sedans</option>
                  <option value="SUVs">SUVs</option>
                  <option value="Commercial">Commercial</option>
                </Select>
              </div>
              <div>
                <Label>Transmission *</Label>
                <Input
                  value={editingVehicle.transmission}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, transmission: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Fuel Type *</Label>
                <Select
                  value={editingVehicle.fuelType}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, fuelType: e.target.value })
                  }
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Plug-in Hybrid">Plug-in Hybrid</option>
                  <option value="Electric">Electric</option>
                  {!['Petrol', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Electric'].includes(
                    editingVehicle.fuelType
                  ) && (
                    <option value={editingVehicle.fuelType}>
                      {editingVehicle.fuelType}
                    </option>
                  )}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Power Output (Optional)</Label>
                <Input
                  value={editingVehicle.powerKw}
                  placeholder="Optional (e.g. 85 kW)"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, powerKw: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Fuel Economy (Optional)</Label>
                <Input
                  value={editingVehicle.fuelEconomy}
                  placeholder="Optional (e.g. 5.6 L/100km)"
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, fuelEconomy: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Exterior Colour *</Label>
                <Input
                  value={editingVehicle.colour}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, colour: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <ImageSourceField
              uploadCategory="vehicles"
              value={editingVehicle.images[0] ?? ''}
              onChange={(url) =>
                setEditingVehicle({
                  ...editingVehicle,
                  images: [url, ...editingVehicle.images.slice(1)],
                })
              }
            />

            <div>
              <Label>Additional Gallery Image URLs (Optional, one per line)</Label>
              <Textarea
                rows={2}
                value={editingVehicle.extraImagesText}
                placeholder="https://... or /assets/..."
                onChange={(e) =>
                  setEditingVehicle({ ...editingVehicle, extraImagesText: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setEditingVehicle(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Vehicle</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* PROMOTION / EVENT / COMPETITION MODAL WITH DYNAMIC VISIBILITY SELECTOR */}
      {editingPromo && (
        <Dialog
          open
          onClose={() => setEditingPromo(null)}
          title="Save Special, Event, or Competition"
          subtitle="Select visibility across all dealerships or a single branch, and set an automatic expiry date."
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const isBranchLimited = !(isAdmin || isItManager || isMarketing);
                const scope: PromotionScope =
                  isBranchLimited || editingPromo.visibilityChoice !== 'MASTER'
                    ? 'BRANCH'
                    : 'MASTER';
                const dealershipId: DealershipId | null = isBranchLimited
                  ? allocatedBranchId
                  : editingPromo.visibilityChoice === 'MASTER'
                  ? null
                  : editingPromo.visibilityChoice;
                const { visibilityChoice: _ignoreVis, ...promoPayload } = editingPromo;

                await savePromotion({
                  ...promoPayload,
                  type: isPartsExec || isServiceClerk ? 'special' : promoPayload.type,
                  scope,
                  dealershipId,
                });
                setEditingPromo(null);
                showFlash(`Saved "${editingPromo.title}".`);
              } catch (err) {
                setActionError(
                  err instanceof Error ? err.message : 'Unable to save campaign.'
                );
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Campaign Title *</Label>
                <Input
                  value={editingPromo.title}
                  onChange={(e) => setEditingPromo({ ...editingPromo, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Campaign Type *</Label>
                {isPartsExec || isServiceClerk ? (
                  <Input
                    value={isPartsExec ? 'Department Special (Parts)' : 'Department Special (Service)'}
                    disabled
                    className="bg-[#F1F5F9] text-[#334155]"
                  />
                ) : (
                  <Select
                    value={editingPromo.type}
                    onChange={(e) =>
                      setEditingPromo({
                        ...editingPromo,
                        type: e.target.value as PromotionType,
                      })
                    }
                  >
                    <option value="special">Monthly Special</option>
                    <option value="event">Dealership Event</option>
                    {(isAdmin || isItManager || isMarketing || isBranchAdmin) && (
                      <option value="competition">Competition / Prize Draw</option>
                    )}
                  </Select>
                )}
              </div>
            </div>

            {/* Visibility Selector */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Visibility Scope *</Label>
                {!(isAdmin || isItManager || isMarketing) ? (
                  <Input
                    value={`${allocatedBranch?.name ?? 'Assigned Branch'} Only (ID ${allocatedBranchId})`}
                    disabled
                    className="bg-[#F1F5F9] text-[#334155]"
                  />
                ) : (
                  <Select
                    value={editingPromo.visibilityChoice}
                    onChange={(e) =>
                      setEditingPromo({
                        ...editingPromo,
                        visibilityChoice: e.target.value as VisibilityChoice,
                      })
                    }
                  >
                    <option value="MASTER">All Dealerships (Master)</option>
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.shortName} Only (ID {b.id}){b.archived ? ' [Archived]' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <div>
                <Label>Valid Until / Event Date (YYYY-MM-DD) *</Label>
                <Input
                  type="date"
                  value={editingPromo.validUntil}
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, validUntil: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Associated Model / Subtitle</Label>
                <Input
                  value={editingPromo.vehicleName}
                  placeholder="e.g. Volkswagen T-Cross"
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, vehicleName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Offer Price (ZAR, 0 if N/A)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingPromo.offerPrice}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      offerPrice: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Monthly From (ZAR, 0 if N/A)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingPromo.monthlyFrom}
                  onChange={(e) =>
                    setEditingPromo({
                      ...editingPromo,
                      monthlyFrom: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Event / Operating Time (Optional)</Label>
                <Input
                  value={editingPromo.eventTime}
                  placeholder="e.g. 09:00 – 13:00"
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, eventTime: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Location / Venue Label</Label>
                <Input
                  value={editingPromo.location}
                  placeholder="e.g. 52 Kerk Street, Ermelo"
                  onChange={(e) =>
                    setEditingPromo({ ...editingPromo, location: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Campaign Description *</Label>
              <Textarea
                rows={3}
                value={editingPromo.description}
                onChange={(e) =>
                  setEditingPromo({ ...editingPromo, description: e.target.value })
                }
                required
              />
            </div>

            <ImageSourceField
              uploadCategory="promotions"
              allowVideo
              value={editingPromo.imageUrl}
              mediaType={editingPromo.mediaType}
              onChange={(url) => setEditingPromo({ ...editingPromo, imageUrl: url })}
              onMediaTypeChange={(mt) => setEditingPromo({ ...editingPromo, mediaType: mt })}
            />

            <label className="flex items-center gap-2 text-xs text-[#334155]">
              <input
                type="checkbox"
                checked={editingPromo.active}
                onChange={(e) => setEditingPromo({ ...editingPromo, active: e.target.checked })}
              />
              <span>Publish Live (if Valid Until is today or later)</span>
            </label>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setEditingPromo(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Campaign</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* BRING BACK ARCHIVED PROMOTION MODAL */}
      {reactivatingPromo && (
        <Dialog
          open
          onClose={() => setReactivatingPromo(null)}
          title="Bring Back Campaign with New Date"
          subtitle={reactivatingPromo.title}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await reactivatePromotion(reactivatingPromo.id, reactivateExpiryDate);
              setReactivatingPromo(null);
              showFlash(`Reactivated "${reactivatingPromo.title}" through ${reactivateExpiryDate}.`);
            }}
            className="space-y-4"
          >
            <div>
              <Label>New Valid Until / Expiry Date *</Label>
              <Input
                type="date"
                min={todayISO}
                value={reactivateExpiryDate}
                onChange={(e) => setReactivateExpiryDate(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setReactivatingPromo(null)}>
                Cancel
              </Button>
              <Button type="submit">Restore &amp; Publish</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* NEWS MODAL */}
      {editingNews && (
        <Dialog
          open
          onClose={() => setEditingNews(null)}
          title="Publish or Edit Motoring News"
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveNews(editingNews);
              setEditingNews(null);
              showFlash(`Saved article "${editingNews.title}".`);
            }}
            className="space-y-4"
          >
            <div>
              <Label>Article Headline *</Label>
              <Input
                value={editingNews.title}
                onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Category *</Label>
                <Input
                  value={editingNews.category}
                  onChange={(e) => setEditingNews({ ...editingNews, category: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Published Date Label *</Label>
                <Input
                  value={editingNews.publishedDate}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, publishedDate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Read Time</Label>
                <Input
                  value={editingNews.readTime}
                  onChange={(e) => setEditingNews({ ...editingNews, readTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Summary Excerpt *</Label>
              <Textarea
                rows={2}
                value={editingNews.excerpt}
                onChange={(e) => setEditingNews({ ...editingNews, excerpt: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Full Article Body (separate paragraphs with blank lines) *</Label>
              <Textarea
                rows={5}
                value={editingNews.bodyText}
                onChange={(e) => setEditingNews({ ...editingNews, bodyText: e.target.value })}
                required
              />
            </div>
            <ImageSourceField
              uploadCategory="news"
              value={editingNews.imageSrc}
              onChange={(url) => setEditingNews({ ...editingNews, imageSrc: url })}
            />
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-xs text-[#334155]">
                <input
                  type="checkbox"
                  checked={editingNews.featured}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, featured: e.target.checked })
                  }
                />
                <span>Featured Story</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-[#334155]">
                <input
                  type="checkbox"
                  checked={editingNews.archived}
                  onChange={(e) =>
                    setEditingNews({ ...editingNews, archived: e.target.checked })
                  }
                />
                <span>Archive (hide from site)</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setEditingNews(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Article</Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* PASTE AUTOTRADER JSON / DECODO EXPORT MODAL */}
      {showJsonImportModal && (
        <Dialog
          open
          onClose={() => setShowJsonImportModal(false)}
          title="Paste AutoTrader JSON / Decodo Output"
          subtitle="Import AutoTrader dealer listings directly into Master Group Stock using your authenticated Admin session."
          maxWidthClass="max-w-2xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              setSyncError(null);
              try {
                const report = await importAutoTraderJson(
                  jsonImportRaw,
                  jsonImportBranchId,
                  jsonImportReconcile
                );
                setSyncReport(report);
                setShowJsonImportModal(false);
                setJsonImportRaw('');
                showFlash('Imported AutoTrader vehicle listings into Master Group Stock.');
              } catch (err) {
                setSyncError(
                  err instanceof Error ? err.message : 'Unable to parse and import AutoTrader JSON.'
                );
              } finally {
                setBusyAction(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Default Target Holding Branch *</Label>
                <Select
                  value={jsonImportBranchId}
                  onChange={(e) => setJsonImportBranchId(e.target.value as DealershipId)}
                >
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID {b.id})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <button
                  type="button"
                  onClick={() =>
                    setJsonImportRaw(
                      JSON.stringify(
                        [
                          {
                            listingId: '28194501',
                            title: '2025 Volkswagen Polo 1.0 TSI Life DSG',
                            year: 2025,
                            price: 389900,
                            mileage: 14200,
                            transmission: 'Automatic',
                            fuelType: 'Petrol',
                            category: 'MasterCars',
                            images: ['/assets/online/vw-polo-2024.jpg'],
                            canonicalUrl:
                              'https://www.autotrader.co.za/car-for-sale/volkswagen/polo/newcastle/28194501',
                          },
                        ],
                        null,
                        2
                      )
                    )
                  }
                  className="text-xs font-semibold text-[#00437A] hover:underline cursor-pointer"
                >
                  Insert Sample JSON Template
                </button>
              </div>
            </div>

            <div>
              <Label>AutoTrader JSON Array, Decodo Response JSON, or Dealer HTML *</Label>
              <Textarea
                rows={10}
                value={jsonImportRaw}
                onChange={(e) => setJsonImportRaw(e.target.value)}
                placeholder='Paste JSON array ([{ "listingId": "...", "title": "...", "price": 399900, ... }]) or raw Decodo { "results": [{ "content": "<html>..." }] }'
                className="font-mono text-xs"
                required
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={jsonImportReconcile}
                onChange={(e) => setJsonImportReconcile(e.target.checked)}
              />
              <span>
                Mark existing AutoTrader vehicles at this branch as Sold if omitted from this import (manual vehicles are never modified)
              </span>
            </label>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button variant="ghost" onClick={() => setShowJsonImportModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyAction}>
                <Upload className="h-4 w-4" />
                <span>{busyAction ? 'Importing...' : 'Import to Firestore'}</span>
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ADD STAFF USER MODAL (GROUP ADMIN & IT MANAGER) */}
      {(isAdmin || isItManager) && showCreateStaffModal && (
        <Dialog
          open
          onClose={() => {
            setShowCreateStaffModal(false);
            setCreatedStaffReceipt(null);
            setStaffModalError(null);
          }}
          title={createdStaffReceipt ? 'Staff Account Created' : 'Add New Staff User'}
          subtitle={
            createdStaffReceipt
              ? 'Share these temporary sign-in credentials securely. The user will be prompted to create a personal password on first sign-in.'
              : 'Create a staff account across dealership or group roles with a temporary random password.'
          }
          maxWidthClass="max-w-xl"
        >
          {createdStaffReceipt ? (
            (() => {
              const welcomeMessage = buildStaffWelcomeMessage(
                createdStaffReceipt.profile,
                createdStaffReceipt.temporaryPassword
              );
              const branchLabel = createdStaffReceipt.profile.allocatedDealershipId
                ? dealershipsById[createdStaffReceipt.profile.allocatedDealershipId]?.name ??
                  `Branch ${createdStaffReceipt.profile.allocatedDealershipId}`
                : `All ${groupProfile.groupName} VW Dealerships`;
              const mailSubject = `Welcome to ${branchLabel} — Your Dealership Portal Access`;
              const mailtoHref = `mailto:${encodeURIComponent(
                createdStaffReceipt.profile.email
              )}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(
                welcomeMessage
              )}`;
              const whatsappHref = toWhatsAppMessageHref(
                createdStaffReceipt.profile.phone,
                welcomeMessage
              );

              return (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="font-semibold text-sm">
                        {createdStaffReceipt.profile.fullName} added as{' '}
                        {STAFF_ROLE_META[createdStaffReceipt.profile.role].label}
                      </p>
                    </div>
                    <p>
                      <strong>Allocated Dealership:</strong> {branchLabel}
                    </p>
                    <p className="text-emerald-900">
                      Your welcome message with their username, temporary password, and sign-in link is ready below. Send it with one click via WhatsApp or your Email App.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#475569]">Username (Work Email):</span>
                      <span className="font-mono font-semibold text-[#091224]">
                        {createdStaffReceipt.profile.email}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#475569]">Temporary Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-[#001E50] bg-white border border-[#E2E8F0] rounded px-2 py-0.5">
                          {createdStaffReceipt.temporaryPassword}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void copyText('receipt-pw', createdStaffReceipt.temporaryPassword)
                          }
                        >
                          {copiedKey === 'receipt-pw' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Welcome Message Preview</Label>
                    <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-white p-3.5 font-sans text-xs leading-relaxed text-[#334155]">
                      {welcomeMessage}
                    </pre>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E2E8F0] pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {whatsappHref && (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Send via WhatsApp</span>
                        </a>
                      )}
                      <a
                        href={mailtoHref}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-xs font-medium text-[#091224] transition-colors hover:border-[#001E50] hover:text-[#001E50]"
                      >
                        <Mail className="h-3.5 w-3.5 text-[#00437A]" />
                        <span>Open Email App</span>
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText('receipt-all', welcomeMessage)}
                      >
                        {copiedKey === 'receipt-all' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {copiedKey === 'receipt-all' ? 'Copied Message' : 'Copy Welcome Message'}
                        </span>
                      </Button>
                    </div>

                    <Button
                      type="button"
                      onClick={() => {
                        setShowCreateStaffModal(false);
                        setCreatedStaffReceipt(null);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusyAction(true);
                setStaffModalError(null);
                try {
                  const tempPassword = newStaffPassword;
                  const roleRequiresBranch = STAFF_ROLE_META[newStaffRole].branchRequired;
                  const resolvedBranchId = roleRequiresBranch
                    ? newStaffBranchId || activeDealerships[0]?.id || '1'
                    : newStaffBranchId || null;

                  const profile = await createStaffUser({
                    fullName: newStaffFullName,
                    phone: newStaffPhone,
                    email: newStaffEmail,
                    role: newStaffRole,
                    allocatedDealershipId: resolvedBranchId,
                    defaultPassword: tempPassword,
                  });

                  setCreatedStaffReceipt({
                    profile,
                    temporaryPassword: tempPassword,
                  });
                  showFlash(
                    `Created account for ${profile.fullName}. Send their welcome message using WhatsApp, Email App, or Copy.`
                  );
                } catch (err) {
                  setStaffModalError(
                    err instanceof Error ? err.message : 'Unable to create staff account.'
                  );
                } finally {
                  setBusyAction(false);
                }
              }}
              className="space-y-4"
            >
              {staffModalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                  {staffModalError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={newStaffFullName}
                    onChange={(e) => setNewStaffFullName(e.target.value)}
                    placeholder="e.g. Sipho Mkhize"
                    required
                  />
                </div>
                <div>
                  <Label>Contact Number *</Label>
                  <Input
                    type="tel"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="e.g. 082 555 0142"
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Work Email Address *</Label>
                <Input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="e.g. sipho@newcastlevw.co.za"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Role Privilege *</Label>
                  <Select
                    value={newStaffRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as StaffRole;
                      setNewStaffRole(nextRole);
                      if (STAFF_ROLE_META[nextRole].branchRequired && !newStaffBranchId) {
                        setNewStaffBranchId(activeDealerships[0]?.id ?? activeDealership.id);
                      } else if (!STAFF_ROLE_META[nextRole].branchRequired) {
                        setNewStaffBranchId('');
                      }
                    }}
                  >
                    {(Object.keys(STAFF_ROLE_META) as StaffRole[])
                      .filter((r) => isAdmin || (r !== 'admin' && r !== 'it_manager'))
                      .map((roleKey) => (
                        <option key={roleKey} value={roleKey}>
                          {STAFF_ROLE_META[roleKey].label} ({STAFF_ROLE_META[roleKey].scopeSummary})
                        </option>
                      ))}
                  </Select>
                </div>
                <div>
                  <Label>
                    {STAFF_ROLE_META[newStaffRole].branchRequired
                      ? 'Allocated Dealership *'
                      : 'Primary Dealership (Optional / Group-Wide)'}
                  </Label>
                  <Select
                    value={newStaffBranchId}
                    onChange={(e) => setNewStaffBranchId(e.target.value)}
                    required={STAFF_ROLE_META[newStaffRole].branchRequired}
                  >
                    {!STAFF_ROLE_META[newStaffRole].branchRequired && (
                      <option value="">All Group Dealerships (Group-Wide)</option>
                    )}
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (ID {b.id}){b.archived ? ' [Archived]' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label>Default Temporary Password *</Label>
                  <button
                    type="button"
                    onClick={() => setNewStaffPassword(generateSecureRandomPassword(12))}
                    className="text-xs font-semibold text-[#00437A] hover:underline cursor-pointer"
                  >
                    Generate New Random Password
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    minLength={8}
                    className="font-mono"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyText('draft-pw', newStaffPassword)}
                  >
                    {copiedKey === 'draft-pw' ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Must be at least 8 characters. On first sign-in, this staff member will be forced to replace it with their own password.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateStaffModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={busyAction}>
                  <UserPlus className="h-4 w-4" />
                  <span>{busyAction ? 'Creating User...' : 'Create Staff Account'}</span>
                </Button>
              </div>
            </form>
          )}
        </Dialog>
      )}

      {/* EDIT STAFF USER MODAL (GROUP ADMIN & IT MANAGER) */}
      {(isAdmin || isItManager) && editingStaffUser && (
        <Dialog
          open
          onClose={() => {
            setEditingStaffUser(null);
            setStaffModalError(null);
          }}
          title="Edit Staff User Permissions"
          subtitle={editingStaffUser.email}
          maxWidthClass="max-w-lg"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              setStaffModalError(null);
              try {
                const roleRequiresBranch = STAFF_ROLE_META[editingStaffUser.role].branchRequired;
                await updateStaffUser(editingStaffUser.uid, {
                  fullName: editingStaffUser.fullName,
                  phone: editingStaffUser.phone,
                  role: editingStaffUser.role,
                  allocatedDealershipId: roleRequiresBranch
                    ? editingStaffUser.allocatedDealershipId || activeDealerships[0]?.id || '1'
                    : editingStaffUser.allocatedDealershipId || null,
                  active: editingStaffUser.active,
                });
                setEditingStaffUser(null);
                showFlash(`Updated permissions for ${editingStaffUser.fullName}.`);
              } catch (err) {
                setStaffModalError(
                  err instanceof Error ? err.message : 'Unable to update staff profile.'
                );
              } finally {
                setBusyAction(false);
              }
            }}
            className="space-y-4"
          >
            {staffModalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                {staffModalError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={editingStaffUser.fullName}
                  onChange={(e) =>
                    setEditingStaffUser({ ...editingStaffUser, fullName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Contact Number *</Label>
                <Input
                  value={editingStaffUser.phone}
                  onChange={(e) =>
                    setEditingStaffUser({ ...editingStaffUser, phone: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Role Privilege *</Label>
                <Select
                  value={editingStaffUser.role}
                  onChange={(e) => {
                    const nextRole = e.target.value as StaffRole;
                    const needsBranch = STAFF_ROLE_META[nextRole].branchRequired;
                    setEditingStaffUser({
                      ...editingStaffUser,
                      role: nextRole,
                      allocatedDealershipId: needsBranch
                        ? editingStaffUser.allocatedDealershipId ?? activeDealerships[0]?.id ?? '1'
                        : null,
                    });
                  }}
                >
                  {(Object.keys(STAFF_ROLE_META) as StaffRole[])
                    .filter((r) => isAdmin || (r !== 'admin' && r !== 'it_manager'))
                    .map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {STAFF_ROLE_META[roleKey].label}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label>
                  {STAFF_ROLE_META[editingStaffUser.role].branchRequired
                    ? 'Allocated Dealership *'
                    : 'Allocated Dealership (Optional)'}
                </Label>
                <Select
                  value={editingStaffUser.allocatedDealershipId ?? ''}
                  onChange={(e) =>
                    setEditingStaffUser({
                      ...editingStaffUser,
                      allocatedDealershipId: e.target.value || null,
                    })
                  }
                  required={STAFF_ROLE_META[editingStaffUser.role].branchRequired}
                >
                  {!STAFF_ROLE_META[editingStaffUser.role].branchRequired && (
                    <option value="">All Group Dealerships (Group-Wide)</option>
                  )}
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID {b.id}){b.archived ? ' [Archived]' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#334155] cursor-pointer">
              <input
                type="checkbox"
                checked={editingStaffUser.active}
                onChange={(e) =>
                  setEditingStaffUser({ ...editingStaffUser, active: e.target.checked })
                }
              />
              <span>Account Active (uncheck to suspend dealership access)</span>
            </label>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingStaffUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busyAction}>
                <Save className="h-4 w-4" />
                <span>{busyAction ? 'Saving...' : 'Save Changes'}</span>
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ADD NEW DEALERSHIP BRANCH MODAL (GROUP ADMIN & IT MANAGER) */}
      {(isAdmin || isItManager) && showAddBranchModal && newBranchDraft && (
        <Dialog
          open
          onClose={() => {
            setShowAddBranchModal(false);
            setNewBranchDraft(null);
            setAddBranchError(null);
          }}
          title="Register New Dealership Branch"
          subtitle="Register a dealership branch with its domain, legal/FSP identity, hours, department email routing, Nodemailer SMTP server, and AutoTrader/API integrations."
          maxWidthClass="max-w-3xl"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAddBranchError(null);
              const cleanedId = newBranchDraft.id.trim();
              if (!isValidBranchIdFormat(cleanedId)) {
                setAddBranchError(
                  'Branch ID must be 1–64 characters using only letters, numbers, hyphens (-), or underscores (_).'
                );
                return;
              }
              if (dealershipsById[cleanedId]) {
                setAddBranchError(
                  `A dealership branch with ID "${cleanedId}" already exists. Choose a unique slug or numeric ID.`
                );
                return;
              }

              setBusyAction(true);
              try {
                const payload: DealershipRecord = {
                  ...newBranchDraft,
                  id: cleanedId,
                  mapEmbedUrl:
                    newBranchDraft.mapEmbedUrl.trim() ||
                    toGoogleMapsEmbedUrl(newBranchDraft.physicalAddress),
                };
                await saveDealershipSettings(payload);
                setSelectedBranchId(cleanedId);
                setShowAddBranchModal(false);
                setNewBranchDraft(null);
                showFlash(`Registered new branch "${payload.name}" (ID ${cleanedId}).`);
              } catch (err) {
                setAddBranchError(
                  err instanceof Error ? err.message : 'Unable to register new branch.'
                );
              } finally {
                setBusyAction(false);
              }
            }}
            className="space-y-4"
          >
            {addBranchError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                {addBranchError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Branch ID / Slug *</Label>
                <Input
                  value={newBranchDraft.id}
                  placeholder="e.g. 4 or pietermaritzburg"
                  onChange={(e) =>
                    setNewBranchDraft({
                      ...newBranchDraft,
                      id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label>Dealership Display Name *</Label>
                <Input
                  value={newBranchDraft.name}
                  placeholder="e.g. Ladysmith Volkswagen"
                  onChange={(e) => setNewBranchDraft({ ...newBranchDraft, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Short Name *</Label>
                <Input
                  value={newBranchDraft.shortName}
                  placeholder="e.g. Ladysmith VW"
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, shortName: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Booking Reference Prefix *</Label>
                <Input
                  value={newBranchDraft.referenceCode ?? ''}
                  placeholder="e.g. LVW"
                  maxLength={10}
                  onChange={(e) =>
                    setNewBranchDraft({
                      ...newBranchDraft,
                      referenceCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label>Production Domain *</Label>
                <Input
                  value={newBranchDraft.domain}
                  placeholder="www.ladysmithvw.co.za"
                  onChange={(e) => setNewBranchDraft({ ...newBranchDraft, domain: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Enquiries Email *</Label>
                <Input
                  type="email"
                  value={newBranchDraft.email}
                  placeholder="enquiries@ladysmithvw.co.za"
                  onChange={(e) => setNewBranchDraft({ ...newBranchDraft, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Reception Telephone *</Label>
                <Input
                  value={newBranchDraft.receptionNumber}
                  placeholder="036 631 0000"
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, receptionNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>WhatsApp Number (Optional)</Label>
                <Input
                  value={newBranchDraft.whatsappNumber}
                  placeholder="082 555 0100"
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, whatsappNumber: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <Label>City *</Label>
                <Input
                  value={newBranchDraft.city}
                  placeholder="Ladysmith"
                  onChange={(e) => setNewBranchDraft({ ...newBranchDraft, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Province *</Label>
                <Input
                  value={newBranchDraft.province}
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, province: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  value={newBranchDraft.sortOrder ?? 4}
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Physical Street Address *</Label>
              <Input
                value={newBranchDraft.physicalAddress}
                placeholder="123 Murchison Street, Ladysmith, 3370"
                onChange={(e) =>
                  setNewBranchDraft({ ...newBranchDraft, physicalAddress: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Legal Entity *</Label>
                <Input
                  value={newBranchDraft.legalEntity}
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, legalEntity: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Authorised FSP Number *</Label>
                <Input
                  value={newBranchDraft.fspNumber}
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, fspNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Postal Address (Optional)</Label>
                <Input
                  value={newBranchDraft.postalAddress}
                  placeholder="P.O. Box 123, Ladysmith, 3370"
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, postalAddress: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Sales Trading Hours *</Label>
                <Input
                  value={newBranchDraft.salesHours}
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, salesHours: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Service &amp; Parts Trading Hours *</Label>
                <Input
                  value={newBranchDraft.serviceHours}
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, serviceHours: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[#091224]">
                    Department Request Notification Emails (Required)
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Assign department recipients to automatically receive customer requests via email.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const fallback =
                      newBranchDraft.email.trim() ||
                      groupProfile.defaultNotifyEmail?.trim() ||
                      '';
                    if (!fallback) {
                      setAddBranchError('Enter the Enquiries Email above first to auto-fill.');
                      return;
                    }
                    setAddBranchError(null);
                    setNewBranchDraft({
                      ...newBranchDraft,
                      salesNotifyEmail: fallback,
                      serviceNotifyEmail: fallback,
                      partsNotifyEmail: fallback,
                      financeNotifyEmail: fallback,
                      generalNotifyEmail: fallback,
                    });
                  }}
                >
                  Use Enquiries Email for All
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Sales &amp; Test-Drive Email *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.salesNotifyEmail ?? ''}
                    placeholder="sales@ladysmithvw.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, salesNotifyEmail: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Service Booking Email *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.serviceNotifyEmail ?? ''}
                    placeholder="service@ladysmithvw.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, serviceNotifyEmail: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Parts Enquiries Email *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.partsNotifyEmail ?? ''}
                    placeholder="parts@ladysmithvw.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, partsNotifyEmail: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Finance Applications Email *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.financeNotifyEmail ?? ''}
                    placeholder="finance@ladysmithvw.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, financeNotifyEmail: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>General Enquiries, Events &amp; Competitions Email *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.generalNotifyEmail ?? ''}
                    placeholder="enquiries@ladysmithvw.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, generalNotifyEmail: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* New Branch Outgoing Email Server (Nodemailer SMTP - Required) */}
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[#091224] flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-[#001E50]" />
                    <span>Branch Outgoing Email Server (Nodemailer SMTP — Required)</span>
                  </h4>
                  <p className="text-[11px] text-[#475569]">
                    Sets the branch sender address (e.g. <code>web@ladysmithvw.co.za</code>) used to email customer requests.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSmtpGuideTarget('newBranch')}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Help / Setup Guide</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const cleanDom =
                        newBranchDraft.domain
                          .trim()
                          .toLowerCase()
                          .replace(/^https?:\/\//i, '')
                          .replace(/^www\./, '') || 'ladysmithvolkswagen.co.za';
                      const senderEmail = `web@${cleanDom}`;
                      const branchSlug =
                        newBranchDraft.id
                          .toUpperCase()
                          .replace(/[^A-Z0-9]+/g, '_')
                          .replace(/^_+|_+$/g, '') || 'NEW';
                      setAddBranchError(null);
                      setNewBranchDraft({
                        ...newBranchDraft,
                        smtpHost: `mail.${cleanDom}`,
                        smtpPort: 465,
                        smtpUser: senderEmail,
                        smtpFrom: `${newBranchDraft.name.trim() || 'Dealership'} <${senderEmail}>`,
                        defaultNotifyEmail:
                          newBranchDraft.email.trim() || `leads@${cleanDom}`,
                        smtpPassEnvKey: `SMTP_PASS_BRANCH_${branchSlug}`,
                      });
                    }}
                  >
                    Auto-Fill from Domain
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>SMTP Host (SMTP_HOST) *</Label>
                  <Input
                    value={newBranchDraft.smtpHost ?? ''}
                    placeholder="mail.ladysmithvolkswagen.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, smtpHost: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>SMTP Port (SMTP_PORT) *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={newBranchDraft.smtpPort ?? 465}
                    placeholder="465"
                    onChange={(e) =>
                      setNewBranchDraft({
                        ...newBranchDraft,
                        smtpPort: Number(e.target.value) || 465,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Branch Sender Email / Login (SMTP_USER) *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.smtpUser ?? ''}
                    placeholder="web@ladysmithvolkswagen.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, smtpUser: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Sender Display Header (SMTP_FROM) *</Label>
                  <Input
                    value={newBranchDraft.smtpFrom ?? ''}
                    placeholder="Ladysmith Volkswagen <web@ladysmithvolkswagen.co.za>"
                    onChange={(e) =>
                      setNewBranchDraft({ ...newBranchDraft, smtpFrom: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Default Branch Lead Inbox (DEFAULT_LEAD_NOTIFY_EMAIL) *</Label>
                  <Input
                    type="email"
                    value={newBranchDraft.defaultNotifyEmail ?? ''}
                    placeholder="leads@ladysmithvolkswagen.co.za"
                    onChange={(e) =>
                      setNewBranchDraft({
                        ...newBranchDraft,
                        defaultNotifyEmail: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Password Secret Variable (SMTP_PASS Key) *</Label>
                  <Input
                    value={
                      newBranchDraft.smtpPassEnvKey ??
                      `SMTP_PASS_BRANCH_${newBranchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
                    }
                    placeholder="SMTP_PASS_BRANCH_LADYSMITH"
                    onChange={(e) =>
                      setNewBranchDraft({
                        ...newBranchDraft,
                        smtpPassEnvKey: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_]/g, ''),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2.5 text-[11px] text-[#334155]">
                <span>
                  After registering, add{' '}
                  <code className="rounded bg-[#F1F5F9] px-1 py-0.5 font-semibold text-[#001E50]">
                    {newBranchDraft.smtpPassEnvKey || `SMTP_PASS_BRANCH_${newBranchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`}
                  </code>{' '}
                  in Vercel Env / AI Studio <strong>Settings &rarr; Secrets</strong> / <code>.env</code> so passwords stay off the public database.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const passKey =
                      newBranchDraft.smtpPassEnvKey ||
                      `SMTP_PASS_BRANCH_${newBranchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
                    const block = [
                      `SMTP_HOST="${newBranchDraft.smtpHost || ''}"`,
                      `SMTP_PORT="${newBranchDraft.smtpPort || 465}"`,
                      `SMTP_USER="${newBranchDraft.smtpUser || ''}"`,
                      `${passKey}="PASTE_MAILBOX_PASSWORD_HERE"`,
                      `SMTP_FROM="${newBranchDraft.smtpFrom || ''}"`,
                      `DEFAULT_LEAD_NOTIFY_EMAIL="${newBranchDraft.defaultNotifyEmail || ''}"`,
                    ].join('\n');
                    void copyText('new-branch-env', block);
                  }}
                >
                  {copiedKey === 'new-branch-env' ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>
                    {copiedKey === 'new-branch-env' ? 'Copied!' : 'Copy .env Block'}
                  </span>
                </Button>
              </div>
            </div>

            {/* AutoTrader & Platform APIs Checklist for New Branch */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-[#091224]">
                    AutoTrader Stock Sync &amp; Hosting / API Readiness
                  </h4>
                  <p className="text-[11px] text-[#64748B]">
                    Optional AutoTrader Dealer URL (uses <code>DECODO_API_KEY</code> when enabled) plus Firebase/Vercel domain reminder.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-medium text-[#091224] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(newBranchDraft.syncEnabled)}
                      onChange={(e) =>
                        setNewBranchDraft({ ...newBranchDraft, syncEnabled: e.target.checked })
                      }
                    />
                    <span>Enable AutoTrader Sync</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHandoverManualTab('acquire-apis');
                      setShowHandoverManual(true);
                    }}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>API &amp; Vercel Manual</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>AutoTrader Dealer ID (Optional)</Label>
                  <Input
                    value={newBranchDraft.autotraderDealerId ?? ''}
                    placeholder="e.g. 168682"
                    onChange={(e) =>
                      setNewBranchDraft({
                        ...newBranchDraft,
                        autotraderDealerId: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>AutoTrader Showroom URL (Optional)</Label>
                  <Input
                    type="url"
                    value={newBranchDraft.autotraderUrl ?? ''}
                    placeholder="https://www.autotrader.co.za/dealer/..."
                    onChange={(e) =>
                      setNewBranchDraft({
                        ...newBranchDraft,
                        autotraderUrl: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] text-[#475569] space-y-1">
                <p>
                  <strong>Checklist after creating this branch:</strong>
                </p>
                <p>
                  1. Add <code>{newBranchDraft.domain || 'www.yourbranch.co.za'}</code> (and your <code>*.vercel.app</code> test URL) to <strong>Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains</strong>.
                </p>
                <p>
                  2. Ensure server environment variables include <code>GEMINI_API_KEY</code> (Licence Disc OCR) and <code>{newBranchDraft.smtpPassEnvKey || `SMTP_PASS_BRANCH_${newBranchDraft.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`}</code> (Branch Emails).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Facebook Page URL (Optional)</Label>
                <Input
                  type="url"
                  value={newBranchDraft.facebookUrl ?? ''}
                  placeholder="https://www.facebook.com/..."
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, facebookUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Instagram URL (Optional)</Label>
                <Input
                  type="url"
                  value={newBranchDraft.instagramUrl ?? ''}
                  placeholder="https://www.instagram.com/..."
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, instagramUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>YouTube URL (Optional)</Label>
                <Input
                  type="url"
                  value={newBranchDraft.youtubeUrl ?? ''}
                  placeholder="https://www.youtube.com/@..."
                  onChange={(e) =>
                    setNewBranchDraft({ ...newBranchDraft, youtubeUrl: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowAddBranchModal(false);
                  setNewBranchDraft(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busyAction}>
                <Plus className="h-4 w-4" />
                <span>{busyAction ? 'Creating Branch...' : 'Register Branch'}</span>
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Mini Help Window & Downloadable Guide for Branch Nodemailer SMTP Setup */}
      <SmtpSetupGuideModal
        open={Boolean(smtpGuideTarget)}
        onClose={() => setSmtpGuideTarget(null)}
        branchName={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.name || 'New Dealership Branch'
            : branchDraft.name
        }
        branchDomain={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.domain || ''
            : branchDraft.domain
        }
        smtpHost={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.smtpHost
            : branchDraft.smtpHost
        }
        smtpPort={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.smtpPort
            : branchDraft.smtpPort
        }
        smtpUser={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.smtpUser
            : branchDraft.smtpUser
        }
        smtpFrom={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.smtpFrom
            : branchDraft.smtpFrom
        }
        defaultNotifyEmail={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.defaultNotifyEmail
            : smtpGuideTarget === 'group'
            ? groupDraft.defaultNotifyEmail
            : branchDraft.defaultNotifyEmail
        }
        smtpPassEnvKey={
          smtpGuideTarget === 'newBranch'
            ? newBranchDraft?.smtpPassEnvKey
            : smtpGuideTarget === 'group'
            ? 'SMTP_PASS'
            : branchDraft.smtpPassEnvKey
        }
        onApplyPreset={
          smtpGuideTarget === 'group'
            ? undefined
            : (preset: SmtpPresetSelection) => {
                if (smtpGuideTarget === 'newBranch' && newBranchDraft) {
                  setNewBranchDraft({
                    ...newBranchDraft,
                    smtpHost: preset.smtpHost,
                    smtpPort: preset.smtpPort,
                    smtpUser: preset.smtpUser,
                    smtpFrom: preset.smtpFrom,
                  });
                } else if (smtpGuideTarget === 'editBranch') {
                  setBranchDraft({
                    ...branchDraft,
                    smtpHost: preset.smtpHost,
                    smtpPort: preset.smtpPort,
                    smtpUser: preset.smtpUser,
                    smtpFrom: preset.smtpFrom,
                  });
                }
              }
        }
      />

      <SystemHandoverManualModal
        open={showHandoverManual}
        initialTab={handoverManualTab}
        onClose={() => setShowHandoverManual(false)}
        groupProfile={groupDraft}
        branches={allDealerships}
        systemStatus={systemStatus}
        loadingStatus={loadingSystemStatus}
        onRefreshStatus={() => void fetchSystemStatus()}
        onUpdateGroupDraft={(patch) => setGroupDraft((prev) => ({ ...prev, ...patch }))}
      />

      {/* In-Browser Applicant Document Preview Modal (No Download Required) */}
      <CareerDocumentViewerModal
        open={Boolean(viewingCareerDoc)}
        target={viewingCareerDoc}
        user={user}
        onClose={() => setViewingCareerDoc(null)}
        onError={(msg) => setActionError(msg)}
      />

      {/* Candidate Status Update & Branch Careers Email Draft Modal */}
      <CandidateStatusEmailModal
        open={Boolean(pendingStatusEmail)}
        application={pendingStatusEmail?.application ?? null}
        initialStatus={pendingStatusEmail?.targetStatus ?? 'new'}
        groupName={groupProfile.groupName}
        defaultBranchId={groupProfile.defaultBranchId || '1'}
        dealershipsById={dealershipsById}
        user={user}
        onConfirmStatus={updateJobApplicationStatus}
        onClose={() => setPendingStatusEmail(null)}
        onSuccessFlash={(msg) => showFlash(msg)}
        onError={(msg) => setActionError(msg)}
      />
    </div>
  );
}
