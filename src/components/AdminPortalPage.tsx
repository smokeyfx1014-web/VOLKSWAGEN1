import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Building2,
  Car,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
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
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { useDealership } from '../context/DealershipContext';
import { useDealershipData } from '../context/DealershipDataContext';
import { DEALERSHIP_IMAGE_LIBRARY, GROUP_CORPORATE_INFO } from '../data/dealership';
import { cn, formatZAR, toGoogleMapsEmbedUrl, toWhatsAppMessageHref } from '../lib/utils';
import {
  AutoTraderSyncReport,
  CmsLeadSubmission,
  CmsNewsArticle,
  CmsPromotion,
  CmsVehicle,
  DealershipId,
  DealershipRecord,
  PromotionScope,
  PromotionType,
  StaffRole,
  StaffUserProfile,
  StaffWelcomeEmailResult,
  VehicleStatus,
} from '../types/dealership';
import { Button, Dialog, Input, Label, Select, Textarea } from './ui/shadcn';

type AdminTab =
  | 'overview'
  | 'vehicles'
  | 'promotions'
  | 'users'
  | 'branches'
  | 'news'
  | 'leads';
type VisibilityChoice = 'MASTER' | DealershipId;

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

function ImageSourceField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Choose Dealership Image Preset</Label>
          <Select
            value={
              DEALERSHIP_IMAGE_LIBRARY.some((item) => item.src === value) ? value : 'custom'
            }
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                onChange(e.target.value);
              }
            }}
          >
            {DEALERSHIP_IMAGE_LIBRARY.map((item) => (
              <option key={item.src} value={item.src}>
                {item.category}: {item.label}
              </option>
            ))}
            <option value="custom">Custom URL / Path</option>
          </Select>
        </div>
        <div>
          <Label>Or Enter Image URL / Path *</Label>
          <Input
            value={value}
            placeholder="/assets/... or https://..."
            onChange={(e) => onChange(e.target.value)}
            required
          />
        </div>
      </div>
      {value && (
        <div className="h-28 w-48 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F1F5F9]">
          <img
            src={value}
            alt="Preview"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

export function AdminPortalPage() {
  const {
    activeDealership,
    dealershipsById,
    allDealerships,
    switchPreviewBranch,
    saveDealershipSettings,
  } = useDealership();

  const {
    todayISO,
    user,
    authReady,
    isAdmin,
    isSalesAgent,
    canAccessPortal,
    allocatedBranchId,
    staffProfile,
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
    activePromotions,
    allPromotions,
    archivedPromotions,
    allNews,
    leads,
    staffUsers,
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
    updateLeadStatus,
    deleteLead,
    createStaffUser,
    updateStaffUser,
    removeStaffUser,
    sendStaffWelcomeEmail,
  } = useDealershipData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleBranchFilter, setVehicleBranchFilter] = useState<'All' | DealershipId>('All');
  const [promoSubTab, setPromoSubTab] = useState<'active' | 'archived'>('active');
  const [promoTypeFilter, setPromoTypeFilter] = useState<'all' | PromotionType>('all');
  const [promoScopeFilter, setPromoScopeFilter] = useState<'all' | 'MASTER' | DealershipId>('all');
  const [leadBranchFilter, setLeadBranchFilter] = useState<'All' | DealershipId>('All');

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
  const [newStaffBranchId, setNewStaffBranchId] = useState<DealershipId>(activeDealership.id);
  const [newStaffPassword, setNewStaffPassword] = useState(() => generateSecureRandomPassword(12));
  const [staffModalError, setStaffModalError] = useState<string | null>(null);
  const [createdStaffReceipt, setCreatedStaffReceipt] = useState<{
    profile: StaffUserProfile;
    temporaryPassword: string;
    welcomeStatus: StaffWelcomeEmailResult | null;
  } | null>(null);
  const [resendingWelcome, setResendingWelcome] = useState(false);
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

  // Branch Settings editor state
  const [selectedBranchId, setSelectedBranchId] = useState<DealershipId>(activeDealership.id);
  const [branchDraft, setBranchDraft] = useState<DealershipRecord>(
    dealershipsById[activeDealership.id]
  );

  useEffect(() => {
    setBranchDraft(dealershipsById[selectedBranchId]);
  }, [selectedBranchId, dealershipsById]);

  // Lock Car Sales Agents onto their allocated branch and permitted tabs
  useEffect(() => {
    if (!isSalesAgent || !allocatedBranchId) return;
    if (activeDealership.id !== allocatedBranchId) {
      switchPreviewBranch(allocatedBranchId);
    }
    setVehicleBranchFilter(allocatedBranchId);
    setPromoScopeFilter(allocatedBranchId);
    if (activeTab !== 'overview' && activeTab !== 'vehicles' && activeTab !== 'promotions') {
      setActiveTab('overview');
    }
  }, [isSalesAgent, allocatedBranchId, activeDealership.id, activeTab, switchPreviewBranch]);

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
    const branchLabel = branchInfo?.name ?? 'All Asaf Auto Sales VW Dealerships';
    const roleLabel =
      profile.role === 'admin'
        ? 'Administrator (Full Group Access)'
        : `Car Sales Agent — ${branchLabel}`;
    const permissionsNote =
      profile.role === 'admin'
        ? 'Manage staff users, sync AutoTrader inventory, edit branch settings, publish campaigns, and review customer leads across all branches.'
        : `Add and manage vehicles, monthly specials, and dealership events for ${branchLabel}.`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const portalUrl = `${origin}/admin${
      profile.allocatedDealershipId ? `?branch=${profile.allocatedDealershipId}` : ''
    }`;

    return [
      `Hello ${profile.fullName},`,
      '',
      `Welcome to ${branchLabel} (${GROUP_CORPORATE_INFO.legalEntity}). Your dealership staff portal account is now active.`,
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
    if (isSalesAgent && allocatedBranchId) {
      return allVehicles.filter((v) => v.homeDealershipId === allocatedBranchId);
    }
    return allVehicles;
  }, [allVehicles, isSalesAgent, allocatedBranchId]);

  const scopedPromotions = useMemo(() => {
    if (isSalesAgent && allocatedBranchId) {
      return allPromotions.filter(
        (p) =>
          p.scope === 'BRANCH' &&
          p.dealershipId === allocatedBranchId &&
          (p.type === 'special' || p.type === 'event')
      );
    }
    return allPromotions;
  }, [allPromotions, isSalesAgent, allocatedBranchId]);

  const scopedArchivedPromotions = useMemo(() => {
    if (isSalesAgent && allocatedBranchId) {
      return archivedPromotions.filter(
        (p) =>
          p.scope === 'BRANCH' &&
          p.dealershipId === allocatedBranchId &&
          (p.type === 'special' || p.type === 'event')
      );
    }
    return archivedPromotions;
  }, [archivedPromotions, isSalesAgent, allocatedBranchId]);

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
        !isSalesAgent &&
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
  }, [scopedVehicles, isSalesAgent, vehicleBranchFilter, searchQuery]);

  const filteredPromotions = useMemo(() => {
    const base = promoSubTab === 'active' ? livePromotionsList : scopedArchivedPromotions;
    const q = searchQuery.trim().toLowerCase();
    return base.filter((p) => {
      if (promoTypeFilter !== 'all' && p.type !== promoTypeFilter) return false;
      if (!isSalesAgent) {
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
    isSalesAgent,
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

  const filteredStaffUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return staffUsers.filter((s) => {
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      );
    });
  }, [staffUsers, searchQuery]);

  const sortedLeads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...leads]
      .filter((l) => {
        if (leadBranchFilter !== 'All' && l.submittedAtDealershipId !== leadBranchFilter) {
          return false;
        }
        if (!q) return true;
        return (
          l.fullName.toLowerCase().includes(q) ||
          l.subject.toLowerCase().includes(q) ||
          l.leadType.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.status === 'new' && b.status !== 'new' ? -1 : 0));
  }, [leads, leadBranchFilter, searchQuery]);

  if (!authReady) {
    return (
      <div className="min-h-[75vh] bg-[#F8FAFC] pt-28 pb-20 flex items-center justify-center px-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-8 py-6 text-sm text-[#475569]">
          Verifying {GROUP_CORPORATE_INFO.legalEntity} staff session...
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
              {GROUP_CORPORATE_INFO.legalEntity} · FSP {GROUP_CORPORATE_INFO.fspNumber}
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
                    Signed in as <strong className="font-mono">{user.email}</strong>. Only authorized {GROUP_CORPORATE_INFO.legalEntity} Administrators and Car Sales Agents can access this portal.
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
              {staffProfile.role === 'admin'
                ? 'Administrator (Full Group Access)'
                : `Car Sales Agent (${branchLabel})`}
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
      showFlash('Default 3-branch settings, Master Stock, Promotions, and News synced to Firestore.');
    } finally {
      setBusyAction(false);
    }
  };

  const navTabs = isAdmin
    ? [
        { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
        {
          id: 'vehicles' as const,
          label: `Master Stock (${scopedVehicles.length})`,
          icon: Car,
        },
        {
          id: 'promotions' as const,
          label: `Promotions & Events (${scopedPromotions.length})`,
          icon: Sparkles,
        },
        {
          id: 'users' as const,
          label: `Users & Roles (${staffUsers.length})`,
          icon: Users,
        },
        {
          id: 'branches' as const,
          label: 'Branch Settings (3)',
          icon: Building2,
        },
        { id: 'news' as const, label: `News (${allNews.length})`, icon: Newspaper },
        { id: 'leads' as const, label: `Leads (${leads.length})`, icon: Inbox },
      ]
    : [
        { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
        {
          id: 'vehicles' as const,
          label: `${allocatedBranch?.shortName ?? 'Branch'} Stock (${scopedVehicles.length})`,
          icon: Car,
        },
        {
          id: 'promotions' as const,
          label: `Specials & Events (${scopedPromotions.length})`,
          icon: Sparkles,
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
                {GROUP_CORPORATE_INFO.legalEntity} · FSP {GROUP_CORPORATE_INFO.fspNumber}
              </p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold',
                  isAdmin
                    ? 'bg-[#001E50] text-white'
                    : 'bg-blue-50 text-[#00437A] border border-blue-200'
                )}
              >
                <Shield className="h-3 w-3" />
                {isAdmin
                  ? 'Administrator · Full Group Access'
                  : `Car Sales Agent · ${allocatedBranch?.name ?? 'Assigned Branch'}`}
              </span>
            </div>
            <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold text-[#091224]">
              {isAdmin
                ? 'Multi-Branch Group Admin Portal'
                : `${allocatedBranch?.name ?? 'Branch'} Sales Workspace`}
            </h1>
            <p className="mt-1 text-xs text-[#475569]">
              Signed in as{' '}
              <span className="font-semibold text-[#091224]">
                {staffProfile?.fullName || user.displayName || user.email}
              </span>{' '}
              (<span className="font-mono text-[#091224]">{user.email}</span>) · Previewing{' '}
              <strong className="text-[#001E50]">{activeDealership.name}</strong> (ID {activeDealership.id})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer',
                    activeTab === tab.id
                      ? 'bg-[#001E50] text-white'
                      : 'text-[#475569] hover:text-[#091224] hover:bg-[#F8FAFC]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
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
              {(isAdmin
                ? [
                    {
                      label: 'Available Master Stock',
                      value: `${activeVehicles.length} / ${allVehicles.length}`,
                      sub: 'Shared across Newcastle, Ermelo & Vryheid',
                    },
                    {
                      label: 'Live Promotions & Events',
                      value: `${livePromotionsList.length}`,
                      sub: `${scopedArchivedPromotions.length} archived or expired`,
                    },
                    {
                      label: 'Authorized Staff Users',
                      value: `${staffUsers.filter((s) => s.active).length}`,
                      sub: `${staffUsers.filter((s) => s.mustChangePassword).length} pending first password setup`,
                    },
                    {
                      label: 'Customer Leads',
                      value: `${leads.length}`,
                      sub: `${leads.filter((l) => l.status === 'new').length} awaiting follow-up`,
                    },
                  ]
                : [
                    {
                      label: `${allocatedBranch?.shortName ?? 'Branch'} Total Stock`,
                      value: `${scopedVehicles.length}`,
                      sub: `${scopedVehicles.filter((v) => v.status === 'available').length} currently available`,
                    },
                    {
                      label: 'Manual Branch Vehicles',
                      value: `${manualVehiclesCount}`,
                      sub: `Editable vehicles held at ${allocatedBranch?.shortName ?? 'your branch'}`,
                    },
                    {
                      label: 'Live Specials & Events',
                      value: `${livePromotionsList.length}`,
                      sub: `${scopedArchivedPromotions.length} archived or expired`,
                    },
                    {
                      label: 'Allocated Dealership',
                      value: `Branch ID ${allocatedBranchId ?? '—'}`,
                      sub: allocatedBranch?.domain ?? '',
                    },
                  ]
              ).map((stat) => (
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

            {isSalesAgent && allocatedBranch && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                      Assigned Dealership · Branch ID {allocatedBranch.id} ({allocatedBranch.domain})
                    </span>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      {allocatedBranch.name} — Car Sales Agent Permissions
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                  Your Car Sales Agent account is scoped strictly to <strong>{allocatedBranch.name}</strong>. You can add, edit, mark sold, or remove manual vehicle listings and publish specials or dealership events for your allocated dealership. User administration, AutoTrader feed sync, and group branch settings remain restricted to Administrators.
                </p>
              </div>
            )}

            {/* 3 Dealership Quick Cards + Live Preview Switcher (Admin Only) */}
            {isAdmin && (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-[#091224]">
                      Asaf Auto Sales Group — Active Dealership Domains
                    </h2>
                    <p className="text-xs text-[#475569]">
                      Click <strong>Preview Branch</strong> to switch `?branch=` immediately on this staging/localhost build.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('branches')}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit Branch Settings</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                          isCurrent ? 'border-[#001E50] bg-[#F8FAFC]' : 'border-[#E2E8F0] bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-mono font-semibold text-[#00437A]">
                              Branch ID {branch.id} · {branch.domain}
                            </span>
                            <h3 className="font-display text-base font-semibold text-[#091224]">
                              {branch.name}
                            </h3>
                          </div>
                          {isCurrent && (
                            <span className="rounded bg-[#001E50] px-2 py-0.5 text-[10px] font-semibold text-white">
                              Active
                            </span>
                          )}
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
                          <span className="text-[#475569]">
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
        {activeTab === 'vehicles' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-[#091224]">
                  {isAdmin
                    ? 'Master Group Stock (New, Used & MasterCars)'
                    : `${allocatedBranch?.name ?? 'Branch'} Vehicle Stock`}
                </h2>
                {isAdmin ? (
                  <Select
                    value={vehicleBranchFilter}
                    onChange={(e) => setVehicleBranchFilter(e.target.value as 'All' | DealershipId)}
                    className="w-52 bg-white"
                  >
                    <option value="All">All Holding Branches</option>
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        Held at {b.shortName} (ID {b.id})
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
                {isAdmin && (
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
                    {isAdmin
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
                            {homeBranch?.shortName} (ID {v.homeDealershipId})
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
                          {isSalesAgent && isAutoTrader ? (
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
        {activeTab === 'promotions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setPromoSubTab('active')}
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer',
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
                      'px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer',
                      promoSubTab === 'archived'
                        ? 'bg-[#001E50] text-white'
                        : 'text-[#475569] hover:text-[#091224]'
                    )}
                  >
                    Archived / Expired ({scopedArchivedPromotions.length})
                  </button>
                </div>

                <Select
                  value={promoTypeFilter}
                  onChange={(e) => setPromoTypeFilter(e.target.value as 'all' | PromotionType)}
                  className="w-44 bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="special">Specials</option>
                  <option value="event">Events</option>
                  {isAdmin && <option value="competition">Competitions</option>}
                </Select>

                {isAdmin && (
                  <Select
                    value={promoScopeFilter}
                    onChange={(e) =>
                      setPromoScopeFilter(e.target.value as 'all' | 'MASTER' | DealershipId)
                    }
                    className="w-56 bg-white"
                  >
                    <option value="all">All Visibility Scopes</option>
                    <option value="MASTER">All Dealerships (Master)</option>
                    <option value="1">Newcastle VW Only (ID 1)</option>
                    <option value="2">Ermelo VW Only (ID 2)</option>
                    <option value="3">Vryheid VW Only (ID 3)</option>
                  </Select>
                )}
              </div>

              <Button
                onClick={() =>
                  setEditingPromo({
                    id: `promo-${Date.now()}`,
                    title: '',
                    type: 'special',
                    description: '',
                    imageUrl: '/assets/aistudio/vwslider10_5974d4ed.jpg',
                    validUntil: addDaysISO(todayISO, 30),
                    scope: isSalesAgent ? 'BRANCH' : 'MASTER',
                    dealershipId: isSalesAgent ? allocatedBranchId : null,
                    active: true,
                    vehicleName: '',
                    offerPrice: 0,
                    monthlyFrom: 0,
                    eventTime: '',
                    location: isSalesAgent
                      ? allocatedBranch?.physicalAddress ?? ''
                      : 'All Asaf Auto Sales VW Branches',
                    visibilityChoice: isSalesAgent && allocatedBranchId ? allocatedBranchId : 'MASTER',
                  })
                }
              >
                <Plus className="h-4 w-4" />
                <span>
                  {isAdmin
                    ? 'Add Special / Event / Competition'
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
                      : `${dealershipsById[promo.dealershipId ?? '1']?.shortName} Only (ID ${promo.dealershipId})`;

                  return (
                    <div
                      key={promo.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
                    >
                      <div className="relative h-40 w-full bg-[#F1F5F9]">
                        <img
                          src={promo.imageUrl}
                          alt={promo.title}
                          className="h-full w-full object-cover"
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

        {/* USERS & ROLES TAB (ADMINISTRATOR ONLY) */}
        {isAdmin && activeTab === 'users' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#091224]">
                  Dealership Staff Users &amp; Access Roles
                </h2>
                <p className="text-xs text-[#475569]">
                  Add Car Sales Agents or Administrators with a generated temporary password. New staff must create their own personal password upon first sign-in.
                </p>
              </div>

              <Button
                onClick={() => {
                  setNewStaffFullName('');
                  setNewStaffPhone('');
                  setNewStaffEmail('');
                  setNewStaffRole('agent');
                  setNewStaffBranchId(activeDealership.id);
                  setNewStaffPassword(generateSecureRandomPassword(12));
                  setStaffModalError(null);
                  setCreatedStaffReceipt(null);
                  setShowCreateStaffModal(true);
                }}
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Staff User</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Administrators (Full Access)</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {staffUsers.filter((s) => s.role === 'admin' && s.active).length}
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Car Sales Agents (Branch-Scoped)</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {staffUsers.filter((s) => s.role === 'agent' && s.active).length}
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs text-[#64748B]">Pending First Password Setup</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[#001E50] tabular-nums">
                  {staffUsers.filter((s) => s.mustChangePassword && s.active).length}
                </p>
              </div>
            </div>

            {filteredStaffUsers.length === 0 ? (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center space-y-3">
                <p className="text-sm font-medium text-[#091224]">
                  No staff user profiles added yet
                </p>
                <p className="text-xs text-[#475569] max-w-md mx-auto">
                  Click <strong>Add Staff User</strong> above to create Car Sales Agents allocated to Newcastle VW, Ermelo VW, or Vryheid VW, or add co-Administrators.
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
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredStaffUsers.map((staff) => {
                      const branch = staff.allocatedDealershipId
                        ? dealershipsById[staff.allocatedDealershipId]
                        : null;
                      const isSelf = staff.uid === user.uid;

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
                                staff.role === 'admin'
                                  ? 'bg-[#001E50] text-white'
                                  : 'bg-blue-50 text-[#00437A]'
                              )}
                            >
                              {staff.role === 'admin' ? 'Administrator' : 'Car Sales Agent'}
                            </span>
                            <p className="mt-1 text-[11px] text-[#64748B]">
                              {staff.role === 'admin'
                                ? 'Full access + user management'
                                : 'Cars, specials & events only'}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            {branch ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#001E50]/5 px-2 py-1 font-medium text-[#001E50]">
                                <MapPin className="h-3 w-3" />
                                {branch.shortName} (ID {branch.id})
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
                          <td className="px-4 py-3.5 text-right">
                            {confirmRemoveStaffUid === staff.uid ? (
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
                                {!isSelf && (
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BRANCH SETTINGS TAB */}
        {isAdmin && activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                {allDealerships.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer',
                      selectedBranchId === branch.id
                        ? 'bg-[#001E50] text-white'
                        : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#334155] hover:border-[#001E50]'
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>
                      ID {branch.id}: {branch.shortName}
                    </span>
                  </button>
                ))}
              </div>

              <Button
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
                    Updates apply immediately to the navbar, footer, contact page, maps, SEO titles, and lead routing for {branchDraft.domain}.
                  </p>
                </div>
                <Button type="submit" disabled={busyAction}>
                  <Save className="h-4 w-4" />
                  <span>Save Branch Settings</span>
                </Button>
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
            </form>
          </div>
        )}

        {/* NEWS TAB */}
        {isAdmin && activeTab === 'news' && (
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
        {isAdmin && activeTab === 'leads' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-[#091224]">
                Customer Leads &amp; Booking Inbox
              </h2>
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
            </div>

            {sortedLeads.length === 0 ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center text-sm text-[#475569]">
                No customer requests match your filter. Submissions across Newcastle, Ermelo, and Vryheid appear here in real time.
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
                            <span className="rounded bg-[#001E50]/10 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[#001E50]">
                              {lead.leadType}
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
                            onChange={(e) =>
                              void updateLeadStatus(
                                lead.id,
                                e.target.value as CmsLeadSubmission['status']
                              )
                            }
                            className="w-36"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="archived">Archived</option>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void deleteLead(lead.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
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
      </div>

      {/* VEHICLE ADD/EDIT MODAL */}
      {editingVehicle && (
        <Dialog
          open
          onClose={() => setEditingVehicle(null)}
          title="Save Master Group Stock Vehicle"
          subtitle="All available stock automatically appears across Newcastle, Ermelo & Vryheid sites with its Holding Branch badge."
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
                {isSalesAgent ? (
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
                <Label>Category *</Label>
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
                <Input
                  value={editingVehicle.fuelType}
                  onChange={(e) =>
                    setEditingVehicle({ ...editingVehicle, fuelType: e.target.value })
                  }
                  required
                />
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

      {/* PROMOTION / EVENT / COMPETITION MODAL WITH 4-OPTION VISIBILITY SELECTOR */}
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
                const scope: PromotionScope =
                  isSalesAgent || editingPromo.visibilityChoice !== 'MASTER'
                    ? 'BRANCH'
                    : 'MASTER';
                const dealershipId: DealershipId | null = isSalesAgent
                  ? allocatedBranchId
                  : editingPromo.visibilityChoice === 'MASTER'
                  ? null
                  : editingPromo.visibilityChoice;
                const { visibilityChoice: _ignoreVis, ...promoPayload } = editingPromo;

                await savePromotion({
                  ...promoPayload,
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
                  {isAdmin && (
                    <option value="competition">Competition / Prize Draw</option>
                  )}
                </Select>
              </div>
            </div>

            {/* Visibility Selector */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Visibility Scope *</Label>
                {isSalesAgent ? (
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
                    <option value="1">Newcastle VW Only (ID 1)</option>
                    <option value="2">Ermelo VW Only (ID 2)</option>
                    <option value="3">Vryheid VW Only (ID 3)</option>
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
              value={editingPromo.imageUrl}
              onChange={(url) => setEditingPromo({ ...editingPromo, imageUrl: url })}
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

      {/* ADD STAFF USER MODAL (ADMIN ONLY) */}
      {isAdmin && showCreateStaffModal && (
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
              : 'Create a Car Sales Agent or Administrator with a temporary random password.'
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
                ? dealershipsById[createdStaffReceipt.profile.allocatedDealershipId]?.name
                : 'All Asaf Auto Sales VW Dealerships';
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
                    <p className="font-semibold text-sm">
                      {createdStaffReceipt.profile.fullName} added as{' '}
                      {createdStaffReceipt.profile.role === 'admin'
                        ? 'Administrator'
                        : 'Car Sales Agent'}
                    </p>
                    <p>
                      <strong>Allocated Dealership:</strong> {branchLabel}
                    </p>
                  </div>

                  {createdStaffReceipt.welcomeStatus && (
                    <div
                      className={cn(
                        'rounded-xl border p-3.5 text-xs flex flex-wrap items-start justify-between gap-3',
                        createdStaffReceipt.welcomeStatus.sent
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                          : 'border-amber-200 bg-amber-50 text-amber-950'
                      )}
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        {createdStaffReceipt.welcomeStatus.sent ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <p className="font-semibold">
                            {createdStaffReceipt.welcomeStatus.sent
                              ? `Welcome Email Sent Automatically (${
                                  createdStaffReceipt.welcomeStatus.provider === 'resend'
                                    ? 'Resend'
                                    : 'SMTP'
                                })`
                              : 'Welcome Message Ready to Send'}
                          </p>
                          <p className="leading-relaxed">
                            {createdStaffReceipt.welcomeStatus.message}
                          </p>
                        </div>
                      </div>

                      {!createdStaffReceipt.welcomeStatus.sent && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resendingWelcome}
                          onClick={async () => {
                            setResendingWelcome(true);
                            try {
                              const nextStatus = await sendStaffWelcomeEmail({
                                fullName: createdStaffReceipt.profile.fullName,
                                recipientEmail: createdStaffReceipt.profile.email,
                                role: createdStaffReceipt.profile.role,
                                allocatedDealershipId:
                                  createdStaffReceipt.profile.allocatedDealershipId,
                                temporaryPassword: createdStaffReceipt.temporaryPassword,
                              });
                              setCreatedStaffReceipt((prev) =>
                                prev ? { ...prev, welcomeStatus: nextStatus } : null
                              );
                            } finally {
                              setResendingWelcome(false);
                            }
                          }}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>{resendingWelcome ? 'Sending...' : 'Retry Auto-Email'}</span>
                        </Button>
                      )}
                    </div>
                  )}

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
                    <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-white p-3.5 font-sans text-xs leading-relaxed text-[#334155]">
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
                  const profile = await createStaffUser({
                    fullName: newStaffFullName,
                    phone: newStaffPhone,
                    email: newStaffEmail,
                    role: newStaffRole,
                    allocatedDealershipId: newStaffBranchId,
                    defaultPassword: tempPassword,
                  });

                  const welcomeStatus = await sendStaffWelcomeEmail({
                    fullName: profile.fullName,
                    recipientEmail: profile.email,
                    role: profile.role,
                    allocatedDealershipId: profile.allocatedDealershipId,
                    temporaryPassword: tempPassword,
                  });

                  setCreatedStaffReceipt({
                    profile,
                    temporaryPassword: tempPassword,
                    welcomeStatus,
                  });
                  showFlash(
                    welcomeStatus.sent
                      ? `Created account for ${profile.fullName} and sent welcome email to ${profile.email}.`
                      : `Created account for ${profile.fullName}. Use the welcome message options in the modal to send credentials.`
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
                    onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                  >
                    <option value="agent">
                      Car Sales Agent (Cars, Specials &amp; Events for Branch)
                    </option>
                    <option value="admin">Administrator (Full Group Access)</option>
                  </Select>
                </div>
                <div>
                  <Label>
                    {newStaffRole === 'agent'
                      ? 'Allocated Dealership *'
                      : 'Primary Dealership (Optional)'}
                  </Label>
                  <Select
                    value={newStaffBranchId}
                    onChange={(e) => setNewStaffBranchId(e.target.value as DealershipId)}
                  >
                    {allDealerships.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (ID {b.id})
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

      {/* EDIT STAFF USER MODAL (ADMIN ONLY) */}
      {isAdmin && editingStaffUser && (
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
                await updateStaffUser(editingStaffUser.uid, {
                  fullName: editingStaffUser.fullName,
                  phone: editingStaffUser.phone,
                  role: editingStaffUser.role,
                  allocatedDealershipId:
                    editingStaffUser.role === 'agent'
                      ? editingStaffUser.allocatedDealershipId ?? '1'
                      : editingStaffUser.allocatedDealershipId,
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
                  onChange={(e) =>
                    setEditingStaffUser({
                      ...editingStaffUser,
                      role: e.target.value as StaffRole,
                      allocatedDealershipId:
                        e.target.value === 'agent'
                          ? editingStaffUser.allocatedDealershipId ?? '1'
                          : editingStaffUser.allocatedDealershipId,
                    })
                  }
                >
                  <option value="agent">Car Sales Agent</option>
                  <option value="admin">Administrator</option>
                </Select>
              </div>
              <div>
                <Label>Allocated Dealership *</Label>
                <Select
                  value={editingStaffUser.allocatedDealershipId ?? '1'}
                  onChange={(e) =>
                    setEditingStaffUser({
                      ...editingStaffUser,
                      allocatedDealershipId: e.target.value as DealershipId,
                    })
                  }
                >
                  {allDealerships.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (ID {b.id})
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
    </div>
  );
}
