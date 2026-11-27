import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  INITIAL_CMS_JOBS,
  INITIAL_CMS_NEWS,
  INITIAL_CMS_PROMOTIONS,
  INITIAL_CMS_VEHICLES,
  LEGACY_SEED_VEHICLE_IDS,
} from '../data/dealership';
import {
  ParsedAutoTraderVehicle,
  formatZarPrice,
  normalizeAutoTraderJsonInput,
} from '../lib/autotraderParser';
import { isSpotterLead } from '../lib/leadFilters';
import { isVideoMedia } from '../lib/mediaUpload';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  getProvisionerAuth,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  ActiveStaffEscalation,
  AutoTraderBranchSyncSummary,
  AutoTraderSyncReport,
  CmsJobApplication,
  CmsJobOpening,
  CmsLeadSubmission,
  CmsNewsArticle,
  CmsPromotion,
  CmsVehicle,
  DealershipId,
  EscalatableStaffRole,
  ItEscalationTicket,
  JobApplicationStatus,
  LeadSubmissionType,
  StaffRole,
  StaffUserProfile,
} from '../types/dealership';
import { useDealership } from './DealershipContext';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ID_RE = /^[a-zA-Z0-9_-]{2,128}$/;

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sanitizeId(raw: string, prefix: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const candidate = cleaned.length >= 2 ? cleaned : `${prefix}-${Date.now()}`;
  return VALID_ID_RE.test(candidate) ? candidate : `${prefix}-${Date.now()}`;
}

export function parseFirestoreTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'object' && val !== null) {
    const maybe = val as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  }
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const VALID_ESCALATABLE_SET = new Set<EscalatableStaffRole>([
  'branch_admin',
  'agent',
  'parts',
  'service',
  'marketing',
]);

interface DealershipDataContextValue {
  todayISO: string;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isBranchAdmin: boolean;
  isItManager: boolean;
  isItAgent: boolean;
  isSalesAgent: boolean;
  isMarketing: boolean;
  isPartsExec: boolean;
  isServiceClerk: boolean;
  baseStaffRole: StaffRole | null;
  staffRole: StaffRole | null;
  activeEscalation: ActiveStaffEscalation | null;
  escalationRemainingSeconds: number;
  canAccessPortal: boolean;
  allocatedBranchId: DealershipId | null;
  staffProfile: StaffUserProfile | null;
  requiresPasswordSetup: boolean;
  isDeactivatedStaff: boolean;
  authError: string | null;
  signInAdmin: () => Promise<void>;
  signInWithStaffCredentials: (email: string, password: string) => Promise<void>;
  sendStaffPasswordReset: (email: string) => Promise<void>;
  completeInitialPasswordSetup: (currentPassword: string, newPassword: string) => Promise<void>;
  signOutAdmin: () => Promise<void>;

  loadingCatalog: boolean;
  usingFallbackSeed: boolean;

  // Public filtered collections (Master Stock available across all branches; Promotions scoped to MASTER or active branch)
  activeVehicles: CmsVehicle[];
  activePromotions: CmsPromotion[];
  activeSpecials: CmsPromotion[];
  activeEvents: CmsPromotion[];
  activeCompetitions: CmsPromotion[];
  activeNews: CmsNewsArticle[];
  activeJobs: CmsJobOpening[];

  // Admin / Staff collections
  allVehicles: CmsVehicle[];
  allPromotions: CmsPromotion[];
  archivedPromotions: CmsPromotion[];
  allNews: CmsNewsArticle[];
  allJobs: CmsJobOpening[];
  jobApplications: CmsJobApplication[];
  leads: CmsLeadSubmission[];
  staffUsers: StaffUserProfile[];
  itTickets: ItEscalationTicket[];

  // Admin & Staff mutations
  seedCatalogToFirestore: () => Promise<void>;
  seedAllDefaultData: () => Promise<void>;
  saveVehicle: (vehicle: Omit<CmsVehicle, 'createdAt' | 'updatedAt' | 'updatedBy'> & { createdAt?: unknown }) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  clearManualVehicles: () => Promise<number>;
  syncAutoTraderFromDecodo: () => Promise<AutoTraderSyncReport>;
  importAutoTraderJson: (
    rawInput: string,
    targetBranchId: DealershipId,
    reconcileMissing: boolean
  ) => Promise<AutoTraderSyncReport>;
  savePromotion: (promo: Omit<CmsPromotion, 'updatedAt' | 'updatedBy'>) => Promise<void>;
  archivePromotion: (id: string) => Promise<void>;
  reactivatePromotion: (id: string, newValidUntil: string) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  saveNews: (article: Omit<CmsNewsArticle, 'updatedAt' | 'updatedBy'>) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  saveJobOpening: (job: Omit<CmsJobOpening, 'updatedAt' | 'updatedBy'>) => Promise<void>;
  deleteJobOpening: (id: string) => Promise<void>;
  submitJobApplication: (
    application: Omit<CmsJobApplication, 'id' | 'status' | 'createdAt'>
  ) => Promise<string>;
  updateJobApplicationStatus: (id: string, status: JobApplicationStatus) => Promise<void>;
  deleteJobApplication: (id: string) => Promise<void>;
  updateLeadStatus: (id: string, status: CmsLeadSubmission['status']) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  createStaffUser: (payload: {
    fullName: string;
    phone: string;
    email: string;
    role: StaffRole;
    allocatedDealershipId: DealershipId | null;
    defaultPassword: string;
  }) => Promise<StaffUserProfile>;
  updateStaffUser: (
    uid: string,
    updates: {
      fullName: string;
      phone: string;
      role: StaffRole;
      allocatedDealershipId: DealershipId | null;
      active: boolean;
    }
  ) => Promise<void>;
  removeStaffUser: (uid: string) => Promise<void>;
  createItTicket: (payload: {
    targetDealershipId: DealershipId | null;
    requestedRole: EscalatableStaffRole;
    requestedDurationMinutes: number;
    title: string;
    reason: string;
  }) => Promise<string>;
  approveItTicketEscalation: (payload: {
    ticketId: string;
    durationMinutes: number;
    reviewNote: string;
  }) => Promise<void>;
  resolveItTicketDirectly: (payload: { ticketId: string; reviewNote: string }) => Promise<void>;
  rejectItTicket: (payload: { ticketId: string; reviewNote: string }) => Promise<void>;
  revokeItTicketEscalation: (payload: { ticketId: string; reviewNote: string }) => Promise<void>;
  getBranchDependencies: (branchId: DealershipId) => {
    vehiclesCount: number;
    promotionsCount: number;
    staffCount: number;
    totalCount: number;
  };
  deleteBranchIfUnused: (branchId: DealershipId) => Promise<void>;

  // Public booking / lead submission (auto-tags activeDealershipId + homeDealershipId)
  submitLead: (payload: {
    id?: string;
    leadType: LeadSubmissionType;
    fullName: string;
    phone: string;
    email: string;
    subject: string;
    details: string;
    homeDealershipId?: DealershipId | null;
  }) => Promise<void>;
}

const DealershipDataContext = createContext<DealershipDataContextValue | null>(null);

export function DealershipDataProvider({ children }: { children: React.ReactNode }) {
  const {
    activeDealershipId,
    allDealerships,
    dealershipsById,
    hasDbGroupSettings,
    hasDbDealerships,
    seedDefaultDealerships,
    deleteDealershipBranch,
  } = useDealership();

  const [todayISO, setTodayISO] = useState<string>(() => getTodayISO());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rosterAdmin, setRosterAdmin] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffUserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [dbVehicles, setDbVehicles] = useState<CmsVehicle[] | null>(null);
  const [dbPromotions, setDbPromotions] = useState<CmsPromotion[] | null>(null);
  const [dbNews, setDbNews] = useState<CmsNewsArticle[] | null>(null);
  const [dbJobs, setDbJobs] = useState<CmsJobOpening[] | null>(null);
  const [jobApplications, setJobApplications] = useState<CmsJobApplication[]>([]);
  const [leads, setLeads] = useState<CmsLeadSubmission[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserProfile[]>([]);
  const [itTickets, setItTickets] = useState<ItEscalationTicket[]>([]);
  const [escalationNowMs, setEscalationNowMs] = useState<number>(() => Date.now());

  const autoArchivedIdsRef = useRef<Set<string>>(new Set());
  const autoSeededRef = useRef(false);
  const legacyCleanedRef = useRef(false);

  // Refresh todayISO every 30s for instant midnight expiry
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getTodayISO();
      setTodayISO((prev) => (prev === next ? prev : next));
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Tick every 5s when an IT Agent has an active temporary escalation for live countdown + automatic expiry drop-down
  useEffect(() => {
    if (!staffProfile?.activeEscalation) return;
    setEscalationNowMs(Date.now());
    const timer = window.setInterval(() => {
      setEscalationNowMs(Date.now());
    }, 5000);
    return () => window.clearInterval(timer);
  }, [staffProfile?.activeEscalation]);

  // Track Firebase auth, admin roster & staff profile in real time
  useEffect(() => {
    let unsubStaffDoc: (() => void) | null = null;

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubStaffDoc) {
        unsubStaffDoc();
        unsubStaffDoc = null;
      }

      setUser(nextUser);
      setAuthError(null);
      if (!nextUser) {
        setRosterAdmin(false);
        setStaffProfile(null);
        setAuthReady(true);
        return;
      }

      setAuthReady(false);
      const isBootstrap =
        Boolean(nextUser.emailVerified) &&
        nextUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      try {
        const [adminSnap, staffSnap] = await Promise.all([
          isBootstrap
            ? Promise.resolve(null)
            : getDoc(doc(db, 'admins', nextUser.uid)).catch(() => null),
          getDoc(doc(db, 'staffUsers', nextUser.uid)).catch(() => null),
        ]);

        setRosterAdmin(isBootstrap || Boolean(adminSnap?.exists()));
        setStaffProfile(
          staffSnap?.exists() ? (staffSnap.data() as StaffUserProfile) : null
        );
      } catch {
        setRosterAdmin(isBootstrap);
        setStaffProfile(null);
      } finally {
        setAuthReady(true);
      }

      unsubStaffDoc = onSnapshot(
        doc(db, 'staffUsers', nextUser.uid),
        (snap) => {
          setStaffProfile(snap.exists() ? (snap.data() as StaffUserProfile) : null);
        },
        () => {
          // Ignore transient listener errors for non-staff accounts
        }
      );
    });

    return () => {
      unsub();
      if (unsubStaffDoc) unsubStaffDoc();
    };
  }, []);

  const isBootstrappedOrRosterAdmin = Boolean(
    user &&
      ((user.emailVerified && user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) ||
        rosterAdmin)
  );

  const isAdmin = Boolean(
    user &&
      (isBootstrappedOrRosterAdmin ||
        (staffProfile?.role === 'admin' && staffProfile.active))
  );

  const isItManager = Boolean(
    user &&
      !isAdmin &&
      staffProfile?.role === 'it_manager' &&
      staffProfile.active
  );

  const isItAgent = Boolean(
    user &&
      !isAdmin &&
      staffProfile?.role === 'it_agent' &&
      staffProfile.active &&
      staffProfile.allocatedDealershipId
  );

  const activeEscalation: ActiveStaffEscalation | null = useMemo(() => {
    if (!isItAgent || !staffProfile?.activeEscalation) return null;
    const esc = staffProfile.activeEscalation;
    if (!VALID_ESCALATABLE_SET.has(esc.grantedRole)) return null;
    const expiresMs = parseFirestoreTimestampMs(esc.expiresAt);
    if (expiresMs <= escalationNowMs) return null;
    return esc;
  }, [isItAgent, staffProfile, escalationNowMs]);

  const escalationRemainingSeconds = useMemo(() => {
    if (!activeEscalation) return 0;
    const expiresMs = parseFirestoreTimestampMs(activeEscalation.expiresAt);
    return Math.max(0, Math.floor((expiresMs - escalationNowMs) / 1000));
  }, [activeEscalation, escalationNowMs]);

  const baseStaffRole: StaffRole | null = isAdmin
    ? 'admin'
    : staffProfile?.active
    ? staffProfile.role
    : null;

  const staffRole: StaffRole | null = isAdmin
    ? 'admin'
    : activeEscalation
    ? activeEscalation.grantedRole
    : staffProfile?.active
    ? staffProfile.role
    : null;

  const allocatedBranchId: DealershipId | null = useMemo(() => {
    if (isAdmin || isItManager) return null;
    if (activeEscalation) {
      if (activeEscalation.grantedRole === 'marketing') {
        return activeEscalation.dealershipId ?? staffProfile?.allocatedDealershipId ?? null;
      }
      return activeEscalation.dealershipId ?? staffProfile?.allocatedDealershipId ?? null;
    }
    if (!staffProfile?.active) return null;
    if (staffProfile.role === 'marketing') return null;
    return staffProfile.allocatedDealershipId ?? null;
  }, [isAdmin, isItManager, activeEscalation, staffProfile]);

  const isBranchAdmin = Boolean(
    user && !isAdmin && !isItManager && staffRole === 'branch_admin' && allocatedBranchId
  );

  const isSalesAgent = Boolean(
    user && !isAdmin && !isItManager && staffRole === 'agent' && allocatedBranchId
  );

  const isMarketing = Boolean(
    user && !isAdmin && !isItManager && staffRole === 'marketing'
  );

  const isPartsExec = Boolean(
    user && !isAdmin && !isItManager && staffRole === 'parts' && allocatedBranchId
  );

  const isServiceClerk = Boolean(
    user && !isAdmin && !isItManager && staffRole === 'service' && allocatedBranchId
  );

  const canAccessPortal =
    isAdmin ||
    isItManager ||
    isBranchAdmin ||
    isItAgent ||
    isSalesAgent ||
    isMarketing ||
    isPartsExec ||
    isServiceClerk;

  const requiresPasswordSetup = Boolean(
    canAccessPortal && staffProfile?.mustChangePassword === true
  );
  const isDeactivatedStaff = Boolean(
    user && !isBootstrappedOrRosterAdmin && staffProfile && !staffProfile.active
  );

  // Real-time Firestore listeners partitioned cleanly by verified staff role (+ active temporary escalation)
  useEffect(() => {
    if (!authReady) return;

    // 1. IT Tickets listener (independent of effective role so IT Agents keep ticket access even while escalated)
    let unsubItTickets: () => void = () => {};
    if (isAdmin || isItManager) {
      unsubItTickets = onSnapshot(
        collection(db, 'itTickets'),
        (snap) => {
          setItTickets(snap.docs.map((d) => d.data() as ItEscalationTicket));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'itTickets')
      );
    } else if ((isItAgent || isBranchAdmin) && (staffProfile?.allocatedDealershipId || allocatedBranchId)) {
      const ticketBranchId = isItAgent
        ? staffProfile?.allocatedDealershipId ?? allocatedBranchId!
        : allocatedBranchId!;
      let ownTickets: ItEscalationTicket[] = [];
      let branchTickets: ItEscalationTicket[] = [];
      const syncMergedTickets = () => {
        const merged = new Map<string, ItEscalationTicket>();
        for (const t of ownTickets) merged.set(t.id, t);
        for (const t of branchTickets) merged.set(t.id, t);
        setItTickets(Array.from(merged.values()));
      };
      const unsubOwn =
        user && isItAgent
          ? onSnapshot(
              query(collection(db, 'itTickets'), where('requesterUid', '==', user.uid)),
              (snap) => {
                ownTickets = snap.docs.map((d) => d.data() as ItEscalationTicket);
                syncMergedTickets();
              },
              (err) => handleFirestoreError(err, OperationType.LIST, 'itTickets/own')
            )
          : () => {};
      const unsubBranch = onSnapshot(
        query(collection(db, 'itTickets'), where('requesterBranchId', '==', ticketBranchId)),
        (snap) => {
          branchTickets = snap.docs.map((d) => d.data() as ItEscalationTicket);
          syncMergedTickets();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `itTickets/branch-${ticketBranchId}`)
      );
      unsubItTickets = () => {
        unsubOwn();
        unsubBranch();
      };
    } else {
      setItTickets([]);
    }

    // 2. Group Admin & Group IT Manager full-group listeners
    if (isAdmin || isItManager) {
      const unsubVehicles = onSnapshot(
        collection(db, 'vehicles'),
        (snap) => {
          setDbVehicles(snap.docs.map((d) => d.data() as CmsVehicle));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
      );

      const unsubPromotions = onSnapshot(
        collection(db, 'promotions'),
        (snap) => {
          setDbPromotions(snap.docs.map((d) => d.data() as CmsPromotion));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'promotions')
      );

      const unsubNews = onSnapshot(
        collection(db, 'news'),
        (snap) => {
          setDbNews(snap.docs.map((d) => d.data() as CmsNewsArticle));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'news')
      );

      const unsubLeads = onSnapshot(
        collection(db, 'leads'),
        (snap) => {
          setLeads(snap.docs.map((d) => d.data() as CmsLeadSubmission));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'leads')
      );

      const unsubStaff = onSnapshot(
        collection(db, 'staffUsers'),
        (snap) => {
          const rows = snap.docs.map((d) => d.data() as StaffUserProfile);
          rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setStaffUsers(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'staffUsers')
      );

      const unsubJobs = onSnapshot(
        collection(db, 'careersJobs'),
        (snap) => {
          setDbJobs(snap.docs.map((d) => d.data() as CmsJobOpening));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'careersJobs')
      );

      const unsubApplications = onSnapshot(
        collection(db, 'jobApplications'),
        (snap) => {
          setJobApplications(snap.docs.map((d) => d.data() as CmsJobApplication));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'jobApplications')
      );

      return () => {
        unsubItTickets();
        unsubVehicles();
        unsubPromotions();
        unsubNews();
        unsubLeads();
        unsubStaff();
        unsubJobs();
        unsubApplications();
      };
    }

    const unsubNewsPublicOrMarketing = onSnapshot(
      isMarketing
        ? collection(db, 'news')
        : query(collection(db, 'news'), where('archived', '==', false)),
      (snap) => {
        setDbNews(snap.docs.map((d) => d.data() as CmsNewsArticle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'news')
    );

    const unsubPublicJobs = onSnapshot(
      query(collection(db, 'careersJobs'), where('active', '==', true)),
      (snap) => {
        setDbJobs(snap.docs.map((d) => d.data() as CmsJobOpening));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'careersJobs')
    );

    // 3. Branch Admin / Dealer Principal (strictly branch-scoped across stock, promotions, leads, branch staff, applications)
    if (isBranchAdmin && allocatedBranchId) {
      let publicVehicles: CmsVehicle[] = [];
      let branchVehicles: CmsVehicle[] = [];
      const syncMergedVehicles = () => {
        const merged = new Map<string, CmsVehicle>();
        for (const v of publicVehicles) merged.set(v.id, v);
        for (const v of branchVehicles) merged.set(v.id, v);
        setDbVehicles(Array.from(merged.values()));
      };

      const unsubPublicVehicles = onSnapshot(
        query(collection(db, 'vehicles'), where('status', '==', 'available')),
        (snap) => {
          publicVehicles = snap.docs.map((d) => d.data() as CmsVehicle);
          syncMergedVehicles();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles/public')
      );

      const unsubBranchVehicles = onSnapshot(
        query(collection(db, 'vehicles'), where('homeDealershipId', '==', allocatedBranchId)),
        (snap) => {
          branchVehicles = snap.docs.map((d) => d.data() as CmsVehicle);
          syncMergedVehicles();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `vehicles/branch-${allocatedBranchId}`)
      );

      let publicPromos: CmsPromotion[] = [];
      let branchPromos: CmsPromotion[] = [];
      const syncMergedPromos = () => {
        const merged = new Map<string, CmsPromotion>();
        for (const p of publicPromos) merged.set(p.id, p);
        for (const p of branchPromos) merged.set(p.id, p);
        setDbPromotions(Array.from(merged.values()));
      };

      const unsubPublicPromos = onSnapshot(
        query(collection(db, 'promotions'), where('active', '==', true)),
        (snap) => {
          publicPromos = snap.docs.map((d) => d.data() as CmsPromotion);
          syncMergedPromos();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'promotions/public')
      );

      const unsubBranchPromos = onSnapshot(
        query(
          collection(db, 'promotions'),
          where('scope', '==', 'BRANCH'),
          where('dealershipId', '==', allocatedBranchId)
        ),
        (snap) => {
          branchPromos = snap.docs.map((d) => d.data() as CmsPromotion);
          syncMergedPromos();
        },
        (err) =>
          handleFirestoreError(err, OperationType.LIST, `promotions/branch-${allocatedBranchId}`)
      );

      let submittedLeads: CmsLeadSubmission[] = [];
      let homeLeads: CmsLeadSubmission[] = [];
      const syncMergedLeads = () => {
        const merged = new Map<string, CmsLeadSubmission>();
        for (const l of submittedLeads) merged.set(l.id, l);
        for (const l of homeLeads) merged.set(l.id, l);
        setLeads(Array.from(merged.values()));
      };

      const unsubSubmittedLeads = onSnapshot(
        query(collection(db, 'leads'), where('submittedAtDealershipId', '==', allocatedBranchId)),
        (snap) => {
          submittedLeads = snap.docs.map((d) => d.data() as CmsLeadSubmission);
          syncMergedLeads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `leads/branch-submitted-${allocatedBranchId}`)
      );

      const unsubHomeLeads = onSnapshot(
        query(collection(db, 'leads'), where('homeDealershipId', '==', allocatedBranchId)),
        (snap) => {
          homeLeads = snap.docs.map((d) => d.data() as CmsLeadSubmission);
          syncMergedLeads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `leads/branch-home-${allocatedBranchId}`)
      );

      const unsubBranchStaff = onSnapshot(
        query(collection(db, 'staffUsers'), where('allocatedDealershipId', '==', allocatedBranchId)),
        (snap) => {
          const rows = snap.docs.map((d) => d.data() as StaffUserProfile);
          rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
          setStaffUsers(rows);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `staffUsers/branch-${allocatedBranchId}`)
      );

      const unsubBranchApplications = onSnapshot(
        query(collection(db, 'jobApplications'), where('branchId', '==', allocatedBranchId)),
        (snap) => {
          setJobApplications(snap.docs.map((d) => d.data() as CmsJobApplication));
        },
        (err) =>
          handleFirestoreError(err, OperationType.LIST, `jobApplications/branch-${allocatedBranchId}`)
      );

      return () => {
        unsubItTickets();
        unsubPublicVehicles();
        unsubBranchVehicles();
        unsubPublicPromos();
        unsubBranchPromos();
        unsubSubmittedLeads();
        unsubHomeLeads();
        unsubBranchStaff();
        unsubBranchApplications();
        unsubNewsPublicOrMarketing();
        unsubPublicJobs();
      };
    }

    setStaffUsers([]);
    setJobApplications([]);

    // 4. Marketing Coordinator (group-wide Promotions & News)
    if (isMarketing) {
      setLeads([]);
      const unsubVehicles = onSnapshot(
        query(collection(db, 'vehicles'), where('status', '==', 'available')),
        (snap) => {
          setDbVehicles(snap.docs.map((d) => d.data() as CmsVehicle));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
      );

      const unsubPromotions = onSnapshot(
        collection(db, 'promotions'),
        (snap) => {
          setDbPromotions(snap.docs.map((d) => d.data() as CmsPromotion));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'promotions')
      );

      return () => {
        unsubItTickets();
        unsubVehicles();
        unsubPromotions();
        unsubNewsPublicOrMarketing();
        unsubPublicJobs();
      };
    }

    // 5. Car Sales Executive (Branch Stock + Branch Specials/Events + Branch Spotters Leads)
    if (isSalesAgent && allocatedBranchId) {
      let publicVehicles: CmsVehicle[] = [];
      let branchVehicles: CmsVehicle[] = [];
      const syncMergedVehicles = () => {
        const merged = new Map<string, CmsVehicle>();
        for (const v of publicVehicles) merged.set(v.id, v);
        for (const v of branchVehicles) merged.set(v.id, v);
        setDbVehicles(Array.from(merged.values()));
      };

      const unsubPublicVehicles = onSnapshot(
        query(collection(db, 'vehicles'), where('status', '==', 'available')),
        (snap) => {
          publicVehicles = snap.docs.map((d) => d.data() as CmsVehicle);
          syncMergedVehicles();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles/public')
      );

      const unsubBranchVehicles = onSnapshot(
        query(collection(db, 'vehicles'), where('homeDealershipId', '==', allocatedBranchId)),
        (snap) => {
          branchVehicles = snap.docs.map((d) => d.data() as CmsVehicle);
          syncMergedVehicles();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `vehicles/branch-${allocatedBranchId}`)
      );

      let publicPromos: CmsPromotion[] = [];
      let branchPromos: CmsPromotion[] = [];
      const syncMergedPromos = () => {
        const merged = new Map<string, CmsPromotion>();
        for (const p of publicPromos) merged.set(p.id, p);
        for (const p of branchPromos) merged.set(p.id, p);
        setDbPromotions(Array.from(merged.values()));
      };

      const unsubPublicPromos = onSnapshot(
        query(collection(db, 'promotions'), where('active', '==', true)),
        (snap) => {
          publicPromos = snap.docs.map((d) => d.data() as CmsPromotion);
          syncMergedPromos();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'promotions/public')
      );

      const unsubBranchPromos = onSnapshot(
        query(
          collection(db, 'promotions'),
          where('scope', '==', 'BRANCH'),
          where('dealershipId', '==', allocatedBranchId)
        ),
        (snap) => {
          branchPromos = snap.docs.map((d) => d.data() as CmsPromotion);
          syncMergedPromos();
        },
        (err) =>
          handleFirestoreError(err, OperationType.LIST, `promotions/branch-${allocatedBranchId}`)
      );

      let submittedSpotters: CmsLeadSubmission[] = [];
      let homeSpotters: CmsLeadSubmission[] = [];
      const syncMergedSpotters = () => {
        const merged = new Map<string, CmsLeadSubmission>();
        for (const l of submittedSpotters) merged.set(l.id, l);
        for (const l of homeSpotters) merged.set(l.id, l);
        setLeads(Array.from(merged.values()));
      };

      const unsubSubmittedSpotters = onSnapshot(
        query(
          collection(db, 'leads'),
          where('leadType', 'in', ['spotter', 'competition-entry']),
          where('submittedAtDealershipId', '==', allocatedBranchId)
        ),
        (snap) => {
          submittedSpotters = snap.docs.map((d) => d.data() as CmsLeadSubmission);
          syncMergedSpotters();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'leads/spotter-submitted')
      );

      const unsubHomeSpotters = onSnapshot(
        query(
          collection(db, 'leads'),
          where('leadType', 'in', ['spotter', 'competition-entry']),
          where('homeDealershipId', '==', allocatedBranchId)
        ),
        (snap) => {
          homeSpotters = snap.docs.map((d) => d.data() as CmsLeadSubmission);
          syncMergedSpotters();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'leads/spotter-home')
      );

      return () => {
        unsubItTickets();
        unsubPublicVehicles();
        unsubBranchVehicles();
        unsubPublicPromos();
        unsubBranchPromos();
        unsubSubmittedSpotters();
        unsubHomeSpotters();
        unsubNewsPublicOrMarketing();
        unsubPublicJobs();
      };
    }

    // 6. Parts Agent & Service Booking Agent (Branch Dept Leads + Dept Specials)
    if ((isPartsExec || isServiceClerk) && allocatedBranchId) {
      const deptLeadType: LeadSubmissionType = isPartsExec ? 'parts' : 'service';

      const unsubVehicles = onSnapshot(
        query(collection(db, 'vehicles'), where('status', '==', 'available')),
        (snap) => {
          setDbVehicles(snap.docs.map((d) => d.data() as CmsVehicle));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
      );

      let publicPromos: CmsPromotion[] = [];
      let deptSpecials: CmsPromotion[] = [];
      const syncMergedPromos = () => {
        const merged = new Map<string, CmsPromotion>();
        for (const p of publicPromos) merged.set(p.id, p);
        for (const p of deptSpecials) merged.set(p.id, p);
        setDbPromotions(Array.from(merged.values()));
      };

      const unsubPublicPromos = onSnapshot(
        query(collection(db, 'promotions'), where('active', '==', true)),
        (snap) => {
          publicPromos = snap.docs.map((d) => d.data() as CmsPromotion);
          syncMergedPromos();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'promotions/public')
      );

      const unsubDeptPromos = onSnapshot(
        query(
          collection(db, 'promotions'),
          where('scope', '==', 'BRANCH'),
          where('dealershipId', '==', allocatedBranchId),
          where('type', '==', 'special')
        ),
        (snap) => {
          deptSpecials = snap.docs.map((d) => d.data() as CmsPromotion);
          syncMergedPromos();
        },
        (err) =>
          handleFirestoreError(err, OperationType.LIST, `promotions/dept-${allocatedBranchId}`)
      );

      let submittedLeads: CmsLeadSubmission[] = [];
      let homeLeads: CmsLeadSubmission[] = [];
      const syncMergedLeads = () => {
        const merged = new Map<string, CmsLeadSubmission>();
        for (const l of submittedLeads) merged.set(l.id, l);
        for (const l of homeLeads) merged.set(l.id, l);
        setLeads(Array.from(merged.values()));
      };

      const unsubSubmittedLeads = onSnapshot(
        query(
          collection(db, 'leads'),
          where('leadType', '==', deptLeadType),
          where('submittedAtDealershipId', '==', allocatedBranchId)
        ),
        (snap) => {
          submittedLeads = snap.docs.map((d) => d.data() as CmsLeadSubmission);
          syncMergedLeads();
        },
        (err) =>
          handleFirestoreError(err, OperationType.LIST, `leads/${deptLeadType}-submitted`)
      );

      const unsubHomeLeads = onSnapshot(
        query(
          collection(db, 'leads'),
          where('leadType', '==', deptLeadType),
          where('homeDealershipId', '==', allocatedBranchId)
        ),
        (snap) => {
          homeLeads = snap.docs.map((d) => d.data() as CmsLeadSubmission);
          syncMergedLeads();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `leads/${deptLeadType}-home`)
      );

      return () => {
        unsubItTickets();
        unsubVehicles();
        unsubPublicPromos();
        unsubDeptPromos();
        unsubSubmittedLeads();
        unsubHomeLeads();
        unsubNewsPublicOrMarketing();
        unsubPublicJobs();
      };
    }

    // 7. Public visitors & non-escalated IT Agents (base view + IT Tickets handled above)
    setLeads([]);

    const unsubVehicles = onSnapshot(
      query(collection(db, 'vehicles'), where('status', '==', 'available')),
      (snap) => {
        setDbVehicles(snap.docs.map((d) => d.data() as CmsVehicle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    const unsubPromotions = onSnapshot(
      query(collection(db, 'promotions'), where('active', '==', true)),
      (snap) => {
        setDbPromotions(snap.docs.map((d) => d.data() as CmsPromotion));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'promotions')
    );

    return () => {
      unsubItTickets();
      unsubVehicles();
      unsubPromotions();
      unsubNewsPublicOrMarketing();
      unsubPublicJobs();
    };
  }, [
    authReady,
    user,
    isAdmin,
    isItManager,
    isBranchAdmin,
    isItAgent,
    isSalesAgent,
    isMarketing,
    isPartsExec,
    isServiceClerk,
    allocatedBranchId,
    staffProfile?.allocatedDealershipId,
  ]);

  const seedCatalogToFirestore = useCallback(async () => {
    if (!user || !isAdmin) return;
    const batch = writeBatch(db);
    const uid = user.uid;

    for (const v of INITIAL_CMS_VEHICLES) {
      batch.set(doc(db, 'vehicles', v.id), {
        ...v,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    }
    for (const p of INITIAL_CMS_PROMOTIONS) {
      batch.set(doc(db, 'promotions', p.id), {
        ...p,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    }
    for (const n of INITIAL_CMS_NEWS) {
      batch.set(doc(db, 'news', n.id), {
        ...n,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    }
    for (const j of INITIAL_CMS_JOBS) {
      batch.set(doc(db, 'careersJobs', j.id), {
        ...j,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seed-catalog');
    }
  }, [user, isAdmin]);

  const seedAllDefaultData = useCallback(async () => {
    await seedDefaultDealerships();
    await seedCatalogToFirestore();
  }, [seedDefaultDealerships, seedCatalogToFirestore]);

  // Auto-seed defaults once only when an admin logs into a completely uninitialized database
  useEffect(() => {
    if (!isAdmin || !user || autoSeededRef.current) return;
    if (
      !hasDbGroupSettings &&
      !hasDbDealerships &&
      dbPromotions !== null &&
      dbNews !== null &&
      dbPromotions.length === 0 &&
      dbNews.length === 0
    ) {
      autoSeededRef.current = true;
      void seedAllDefaultData();
    }
  }, [
    isAdmin,
    user,
    hasDbGroupSettings,
    hasDbDealerships,
    dbPromotions,
    dbNews,
    seedAllDefaultData,
  ]);

  // Auto-remove legacy pre-seeded sample cars from Firestore once when admin signs in
  useEffect(() => {
    if (!isAdmin || !user || !dbVehicles || legacyCleanedRef.current) return;
    const legacyDocs = dbVehicles.filter((v) => LEGACY_SEED_VEHICLE_IDS.has(v.id));
    if (legacyDocs.length === 0) {
      legacyCleanedRef.current = true;
      return;
    }
    legacyCleanedRef.current = true;
    const batch = writeBatch(db);
    for (const item of legacyDocs) {
      batch.delete(doc(db, 'vehicles', item.id));
    }
    void batch.commit().catch((err) =>
      handleFirestoreError(err, OperationType.DELETE, 'vehicles/legacy-seed-cleanup')
    );
  }, [isAdmin, user, dbVehicles]);

  // One-time seed of the Spotter Commission promotion for already-initialized databases
  useEffect(() => {
    if (!isAdmin || !user || !dbPromotions || dbPromotions.length === 0) return;
    if (typeof window !== 'undefined' && window.localStorage.getItem('vw_spotter_seed_v1') === '1') {
      return;
    }
    const spotterPromo = INITIAL_CMS_PROMOTIONS.find((p) => p.id === 'promo-master-spotter-reward');
    if (!spotterPromo) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('vw_spotter_seed_v1', '1');
    }
    if (dbPromotions.some((p) => p.id === spotterPromo.id)) return;
    void setDoc(doc(db, 'promotions', spotterPromo.id), {
      ...spotterPromo,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }).catch((err) =>
      handleFirestoreError(err, OperationType.WRITE, `promotions/${spotterPromo.id}`)
    );
  }, [isAdmin, user, dbPromotions]);

  // Auto-archive expired promotions when admin, IT manager, or marketing views catalog
  useEffect(() => {
    if ((!isAdmin && !isItManager && !isMarketing) || !user || !dbPromotions) return;
    const expiredActive = dbPromotions.filter((p) => p.active && p.validUntil < todayISO);
    for (const p of expiredActive) {
      const key = `promo:${p.id}:${p.validUntil}`;
      if (autoArchivedIdsRef.current.has(key)) continue;
      autoArchivedIdsRef.current.add(key);
      void setDoc(doc(db, 'promotions', p.id), {
        ...p,
        active: false,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `promotions/${p.id}`));
    }
  }, [isAdmin, isItManager, isMarketing, user, dbPromotions, todayISO]);

  const loadingCatalog = dbVehicles === null || dbPromotions === null || dbNews === null;

  const usingFallbackSeed = Boolean(
    !loadingCatalog &&
      dbPromotions?.length === 0 &&
      dbNews?.length === 0
  );

  // Use live Firestore vehicles (excluding legacy pre-seeded sample cars)
  const allVehicles: CmsVehicle[] = useMemo(() => {
    const raw = (dbVehicles && dbVehicles.length > 0 ? dbVehicles : INITIAL_CMS_VEHICLES).filter(
      (v) => !LEGACY_SEED_VEHICLE_IDS.has(v.id)
    );
    return raw.map((v) => ({
      ...v,
      images: Array.isArray(v.images) && v.images.length > 0 ? v.images : ['/assets/aistudio/starting-4_ece31872.jpg'],
      homeDealershipId: v.homeDealershipId ?? '1',
      status: v.status ?? 'available',
      source: v.source ?? (v.id.startsWith('at_') ? 'autotrader' : 'manual'),
    }));
  }, [dbVehicles]);

  const allPromotions: CmsPromotion[] = useMemo(() => {
    if (dbPromotions && dbPromotions.length > 0) return dbPromotions;
    return INITIAL_CMS_PROMOTIONS;
  }, [dbPromotions]);

  const allNews: CmsNewsArticle[] = useMemo(() => {
    if (dbNews && dbNews.length > 0) return dbNews;
    return INITIAL_CMS_NEWS;
  }, [dbNews]);

  const allJobs: CmsJobOpening[] = useMemo(() => {
    if (dbJobs && dbJobs.length > 0) return dbJobs;
    return INITIAL_CMS_JOBS;
  }, [dbJobs]);

  // Public filtered vehicles: all status == 'available' across all 3 sites
  const activeVehicles = useMemo(
    () => allVehicles.filter((v) => v.status === 'available'),
    [allVehicles]
  );

  // Public filtered promotions: active && validUntil >= todayISO && (MASTER or matching activeDealershipId)
  const activePromotions = useMemo(
    () =>
      allPromotions.filter(
        (p) =>
          p.active &&
          p.validUntil >= todayISO &&
          (p.scope === 'MASTER' || (p.scope === 'BRANCH' && p.dealershipId === activeDealershipId))
      ),
    [allPromotions, todayISO, activeDealershipId]
  );

  const activeSpecials = useMemo(
    () => activePromotions.filter((p) => p.type === 'special'),
    [activePromotions]
  );

  const activeEvents = useMemo(
    () =>
      activePromotions
        .filter((p) => p.type === 'event')
        .sort((a, b) => a.validUntil.localeCompare(b.validUntil)),
    [activePromotions]
  );

  const activeCompetitions = useMemo(
    () => activePromotions.filter((p) => p.type === 'competition'),
    [activePromotions]
  );

  const archivedPromotions = useMemo(
    () =>
      allPromotions
        .filter((p) => !p.active || p.validUntil < todayISO)
        .sort((a, b) => b.validUntil.localeCompare(a.validUntil)),
    [allPromotions, todayISO]
  );

  const activeNews = useMemo(
    () => allNews.filter((n) => !n.archived),
    [allNews]
  );

  const activeJobs = useMemo(
    () =>
      allJobs
        .filter((j) => j.active && (!j.closingDate || j.closingDate >= todayISO))
        .sort((a, b) => (a.closingDate || '9999-12-31').localeCompare(b.closingDate || '9999-12-31')),
    [allJobs, todayISO]
  );

  const signInAdmin = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setAuthError(msg);
    }
  }, []);

  const signInWithStaffCredentials = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !password) {
      const msg = 'Please enter both your work email address and password.';
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      await signInWithEmailAndPassword(auth, cleanedEmail, password);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      let msg = 'Unable to sign in with those credentials.';
      if (code === 'auth/operation-not-allowed') {
        msg =
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password).';
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        msg = 'Invalid work email or password. Please verify your details or ask your Administrator.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many failed sign-in attempts. Please wait a few minutes and try again.';
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const sendStaffPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      const msg = 'Enter your work email address first to receive a password reset link.';
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      await sendPasswordResetEmail(auth, cleanedEmail);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const msg =
        code === 'auth/operation-not-allowed'
          ? 'Email/Password sign-in must be enabled in Firebase Console before password resets can be sent.'
          : err instanceof Error
          ? err.message
          : 'Unable to send password reset email.';
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const completeInitialPasswordSetup = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!user || !user.email) {
        throw new Error('Active staff sign-in session is required.');
      }
      if (newPassword.length < 8) {
        throw new Error('Your new password must be at least 8 characters long.');
      }
      if (newPassword === currentPassword) {
        throw new Error('Please choose a new password that differs from your temporary password.');
      }

      try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (
          code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password'
        ) {
          throw new Error(
            'Your current temporary password is incorrect. Please check the password issued by your Administrator.'
          );
        }
        if (code === 'auth/weak-password') {
          throw new Error('Password is too weak. Use at least 8 characters with letters and numbers.');
        }
        throw err instanceof Error
          ? err
          : new Error('Unable to update your password right now.');
      }

      try {
        await updateDoc(doc(db, 'staffUsers', user.uid), {
          mustChangePassword: false,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staffUsers/${user.uid}`);
      }
    },
    [user]
  );

  const signOutAdmin = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const saveVehicle = useCallback(
    async (
      vehicle: Omit<CmsVehicle, 'createdAt' | 'updatedAt' | 'updatedBy'> & { createdAt?: unknown }
    ) => {
      const hasFullStockWrite = isAdmin || isItManager;
      if (!user || (!hasFullStockWrite && !isBranchAdmin && !isSalesAgent)) {
        throw new Error(
          'Group Admin, IT Manager, Branch Admin, or Car Sales Executive privileges are required to manage vehicles.'
        );
      }
      const id = sanitizeId(vehicle.id, 'veh');
      const existingVehicle = (dbVehicles ?? []).find((v) => v.id === id);

      if (isBranchAdmin) {
        if (!allocatedBranchId) {
          throw new Error('No allocated dealership found for your Branch Admin profile.');
        }
        if (existingVehicle && existingVehicle.homeDealershipId !== allocatedBranchId) {
          throw new Error('Branch Admins can only edit vehicles belonging to their allocated branch.');
        }
      }

      if (isSalesAgent) {
        if (!allocatedBranchId) {
          throw new Error('No allocated dealership found for your agent profile.');
        }
        if (
          existingVehicle &&
          (existingVehicle.homeDealershipId !== allocatedBranchId ||
            existingVehicle.source === 'autotrader' ||
            existingVehicle.id.startsWith('at_'))
        ) {
          throw new Error(
            'Car Sales Executives can only edit manually added vehicles for their allocated dealership.'
          );
        }
      }

      const cleanedImages = (vehicle.images ?? [])
        .map((url) => url.trim().slice(0, 500))
        .filter((url) => url.length >= 5)
        .slice(0, 10);

      if (cleanedImages.length === 0) {
        throw new Error('At least one valid vehicle image URL is required.');
      }

      const targetHomeBranchId: DealershipId =
        isBranchAdmin || isSalesAgent ? allocatedBranchId! : vehicle.homeDealershipId;
      const effectiveSource = isSalesAgent
        ? 'manual'
        : vehicle.source === 'autotrader'
        ? 'autotrader'
        : 'manual';

      const payload: Record<string, unknown> = {
        id,
        title: vehicle.title.trim().slice(0, 140),
        make: (vehicle.make || 'Volkswagen').trim().slice(0, 60),
        model: vehicle.model.trim().slice(0, 100),
        year: Number(vehicle.year),
        price: Math.max(0, Number(vehicle.price)),
        monthlyFrom: Math.max(0, Number(vehicle.monthlyFrom)),
        mileage: Math.max(0, Number(vehicle.mileage)),
        transmission: vehicle.transmission.trim().slice(0, 60) || 'Automatic',
        fuelType: vehicle.fuelType.trim().slice(0, 40) || 'Petrol',
        category: vehicle.category,
        bodyStyle: vehicle.bodyStyle,
        powerKw: (vehicle.powerKw || '').trim().slice(0, 40) || 'N/A',
        fuelEconomy: (vehicle.fuelEconomy || '').trim().slice(0, 40) || 'VW Spec',
        colour: vehicle.colour.trim().slice(0, 60) || 'Pure White',
        images: cleanedImages,
        homeDealershipId: targetHomeBranchId,
        status: vehicle.status,
        source: effectiveSource,
        createdAt: existingVehicle?.createdAt ?? vehicle.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      if (vehicle.variant) {
        payload.variant = vehicle.variant.trim().slice(0, 140);
      }
      if (vehicle.priceFormatted || payload.price) {
        payload.priceFormatted = (
          vehicle.priceFormatted || formatZarPrice(Number(payload.price))
        )
          .trim()
          .slice(0, 40);
      }
      if (!isSalesAgent && vehicle.externalListingId) {
        payload.externalListingId = vehicle.externalListingId.trim().slice(0, 60);
      }
      if (!isSalesAgent && vehicle.dealerId) {
        payload.dealerId = vehicle.dealerId.trim().slice(0, 30);
      }
      if (!isSalesAgent && vehicle.canonicalUrl) {
        payload.canonicalUrl = vehicle.canonicalUrl.trim().slice(0, 400);
      }
      if (!isSalesAgent && vehicle.lastSyncedAt) {
        payload.lastSyncedAt = vehicle.lastSyncedAt;
      }

      try {
        await setDoc(doc(db, 'vehicles', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `vehicles/${id}`);
      }
    },
    [user, isAdmin, isItManager, isBranchAdmin, isSalesAgent, allocatedBranchId, dbVehicles]
  );

  const deleteVehicle = useCallback(
    async (id: string) => {
      const hasFullStockWrite = isAdmin || isItManager;
      if (!user || (!hasFullStockWrite && !isBranchAdmin && !isSalesAgent)) {
        throw new Error('Authorized staff privileges are required to remove vehicles.');
      }
      if (isBranchAdmin) {
        const target = (dbVehicles ?? []).find((v) => v.id === id);
        if (!target || target.homeDealershipId !== allocatedBranchId) {
          throw new Error('Branch Admins can only remove vehicles belonging to their allocated branch.');
        }
      }
      if (isSalesAgent) {
        const target = (dbVehicles ?? []).find((v) => v.id === id);
        if (
          !target ||
          target.homeDealershipId !== allocatedBranchId ||
          target.source === 'autotrader' ||
          target.id.startsWith('at_')
        ) {
          throw new Error(
            'Car Sales Executives can only remove manual vehicles belonging to their allocated dealership.'
          );
        }
      }
      try {
        await deleteDoc(doc(db, 'vehicles', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `vehicles/${id}`);
      }
    },
    [user, isAdmin, isItManager, isBranchAdmin, isSalesAgent, allocatedBranchId, dbVehicles]
  );

  const clearManualVehicles = useCallback(async (): Promise<number> => {
    if (!user || (!isAdmin && !isItManager)) {
      throw new Error('Group Admin or IT Manager sign-in required.');
    }
    const manualDocs = (dbVehicles ?? []).filter(
      (v) => v.source !== 'autotrader' && !v.id.startsWith('at_')
    );
    if (manualDocs.length === 0) return 0;

    for (let i = 0; i < manualDocs.length; i += 400) {
      const chunk = manualDocs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.delete(doc(db, 'vehicles', item.id));
      }
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'vehicles/clear-manual');
      }
    }
    return manualDocs.length;
  }, [user, isAdmin, isItManager, dbVehicles]);

  const reconcileAutoTraderBranches = useCallback(
    async (
      branchPayloads: {
        branchId: DealershipId;
        branchName: string;
        dealerId: string;
        skipped: boolean;
        skipReason?: string;
        pagesScraped: number;
        listings: ParsedAutoTraderVehicle[];
        error?: string;
      }[],
      reconcileMissing: boolean,
      mode: 'decodo' | 'json-import'
    ): Promise<AutoTraderSyncReport> => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('Group Admin or IT Manager sign-in required.');
      }

      const existingMap = new Map<string, CmsVehicle>();
      for (const existingVehicle of dbVehicles ?? []) {
        existingMap.set(existingVehicle.id, existingVehicle);
      }

      const pendingWrites: { id: string; data: Record<string, unknown> }[] = [];
      const summaries: AutoTraderBranchSyncSummary[] = [];

      for (const branchResult of branchPayloads) {
        if (branchResult.skipped || branchResult.error) {
          summaries.push({
            branchId: branchResult.branchId,
            branchName: branchResult.branchName,
            dealerId: branchResult.dealerId,
            skipped: branchResult.skipped,
            skipReason: branchResult.skipReason,
            pagesScraped: branchResult.pagesScraped,
            scrapedCount: branchResult.listings.length,
            addedCount: 0,
            updatedCount: 0,
            markedSoldCount: 0,
            error: branchResult.error,
          });
          continue;
        }

        const activeListingIds = new Set<string>();
        let addedCount = 0;
        let updatedCount = 0;
        let markedSoldCount = 0;

        for (const item of branchResult.listings) {
          activeListingIds.add(item.id);
          const existingDoc = existingMap.get(item.id);
          if (existingDoc) {
            updatedCount += 1;
          } else {
            addedCount += 1;
          }

          pendingWrites.push({
            id: item.id,
            data: {
              id: item.id,
              title: item.title,
              make: item.make,
              model: item.model,
              variant: item.variant,
              year: item.year,
              price: item.price,
              priceFormatted: item.priceFormatted,
              monthlyFrom: item.monthlyFrom,
              mileage: item.mileage,
              transmission: item.transmission,
              fuelType: item.fuelType,
              category: item.category,
              bodyStyle: item.bodyStyle,
              powerKw: item.powerKw,
              fuelEconomy: item.fuelEconomy,
              colour: item.colour,
              images: item.images,
              homeDealershipId: item.homeDealershipId,
              status: 'available',
              source: 'autotrader',
              externalListingId: item.externalListingId,
              dealerId: item.dealerId,
              canonicalUrl: item.canonicalUrl,
              lastSyncedAt: serverTimestamp(),
              createdAt: existingDoc?.createdAt ?? serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: user.uid,
            },
          });
        }

        // Mark missing AutoTrader listings for this branch as sold; never touch manual stock
        if (reconcileMissing && branchResult.listings.length > 0) {
          for (const existingDoc of existingMap.values()) {
            const isSameBranchAutoTrader =
              existingDoc.homeDealershipId === branchResult.branchId &&
              (existingDoc.source === 'autotrader' || existingDoc.id.startsWith('at_'));
            if (
              isSameBranchAutoTrader &&
              existingDoc.status !== 'sold' &&
              !activeListingIds.has(existingDoc.id)
            ) {
              markedSoldCount += 1;
              pendingWrites.push({
                id: existingDoc.id,
                data: {
                  id: existingDoc.id,
                  title: existingDoc.title,
                  make: existingDoc.make,
                  model: existingDoc.model,
                  year: existingDoc.year,
                  price: existingDoc.price,
                  monthlyFrom: existingDoc.monthlyFrom,
                  mileage: existingDoc.mileage,
                  transmission: existingDoc.transmission,
                  fuelType: existingDoc.fuelType,
                  category: existingDoc.category,
                  bodyStyle: existingDoc.bodyStyle,
                  powerKw: existingDoc.powerKw,
                  fuelEconomy: existingDoc.fuelEconomy,
                  colour: existingDoc.colour,
                  images: existingDoc.images,
                  homeDealershipId: existingDoc.homeDealershipId,
                  status: 'sold',
                  source: 'autotrader',
                  ...(existingDoc.externalListingId
                    ? { externalListingId: existingDoc.externalListingId }
                    : {}),
                  ...(existingDoc.dealerId ? { dealerId: existingDoc.dealerId } : {}),
                  ...(existingDoc.variant ? { variant: existingDoc.variant } : {}),
                  ...(existingDoc.priceFormatted
                    ? { priceFormatted: existingDoc.priceFormatted }
                    : {}),
                  ...(existingDoc.canonicalUrl ? { canonicalUrl: existingDoc.canonicalUrl } : {}),
                  lastSyncedAt: serverTimestamp(),
                  createdAt: existingDoc.createdAt ?? serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  updatedBy: user.uid,
                },
              });
            }
          }
        }

        summaries.push({
          branchId: branchResult.branchId,
          branchName: branchResult.branchName,
          dealerId: branchResult.dealerId,
          skipped: false,
          pagesScraped: branchResult.pagesScraped,
          scrapedCount: branchResult.listings.length,
          addedCount,
          updatedCount,
          markedSoldCount,
        });
      }

      // Commit in Firestore batches of <= 400 writes
      for (let i = 0; i < pendingWrites.length; i += 400) {
        const chunk = pendingWrites.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.set(doc(db, 'vehicles', item.id), item.data);
        }
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'vehicles/autotrader-sync');
        }
      }

      return {
        syncedAtIso: new Date().toISOString(),
        mode,
        branches: summaries,
      };
    },
    [user, isAdmin, isItManager, dbVehicles]
  );

  const syncAutoTraderFromDecodo = useCallback(async (): Promise<AutoTraderSyncReport> => {
    if (!user || (!isAdmin && !isItManager)) {
      throw new Error('Group Admin or IT Manager sign-in required.');
    }
    const idToken = await user.getIdToken();

    const response = await fetch('/api/autotrader-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        branches: allDealerships.map((b) => ({
          id: b.id,
          name: b.name,
          autotraderDealerId: b.autotraderDealerId,
          autotraderUrl: b.autotraderUrl,
          syncEnabled: b.syncEnabled,
        })),
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        'Live Decodo scrape endpoint is unavailable on static hosting. Use "Paste AutoTrader JSON" to import and sync listings directly.'
      );
    }

    const payload = (await response.json()) as {
      error?: string;
      branches?: {
        branchId: DealershipId;
        branchName: string;
        dealerId: string;
        skipped: boolean;
        skipReason?: string;
        pagesScraped: number;
        listings: ParsedAutoTraderVehicle[];
        error?: string;
      }[];
    };

    if (!response.ok) {
      throw new Error(payload.error || `Scrape failed with HTTP ${response.status}.`);
    }

    return reconcileAutoTraderBranches(payload.branches ?? [], true, 'decodo');
  }, [user, isAdmin, isItManager, allDealerships, reconcileAutoTraderBranches]);

  const importAutoTraderJson = useCallback(
    async (
      rawInput: string,
      targetBranchId: DealershipId,
      reconcileMissing: boolean
    ): Promise<AutoTraderSyncReport> => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('Group Admin or IT Manager sign-in required.');
      }
      const targetBranch = dealershipsById[targetBranchId];
      const { vehicles, errors } = normalizeAutoTraderJsonInput(
        rawInput,
        targetBranchId,
        targetBranch?.autotraderDealerId || ''
      );
      if (vehicles.length === 0) {
        throw new Error(errors[0] || 'No valid AutoTrader vehicle listings found to import.');
      }

      const grouped = new Map<DealershipId, ParsedAutoTraderVehicle[]>();
      for (const v of vehicles) {
        const list = grouped.get(v.homeDealershipId) ?? [];
        list.push(v);
        grouped.set(v.homeDealershipId, list);
      }

      const payloads = Array.from(grouped.entries()).map(([branchId, listings]) => {
        const b = dealershipsById[branchId];
        return {
          branchId,
          branchName: b?.name ?? `Branch ${branchId}`,
          dealerId: b?.autotraderDealerId || '',
          skipped: false,
          pagesScraped: 1,
          listings,
        };
      });

      return reconcileAutoTraderBranches(payloads, reconcileMissing, 'json-import');
    },
    [user, isAdmin, isItManager, dealershipsById, reconcileAutoTraderBranches]
  );

  const canManagePromotion = useCallback(
    (promo: Pick<CmsPromotion, 'scope' | 'dealershipId' | 'type'>) => {
      if (isAdmin || isItManager || isMarketing) return true;
      if (isBranchAdmin && allocatedBranchId) {
        return promo.scope === 'BRANCH' && promo.dealershipId === allocatedBranchId;
      }
      if (isSalesAgent && allocatedBranchId) {
        return (
          promo.scope === 'BRANCH' &&
          promo.dealershipId === allocatedBranchId &&
          (promo.type === 'special' || promo.type === 'event')
        );
      }
      if ((isPartsExec || isServiceClerk) && allocatedBranchId) {
        return (
          promo.scope === 'BRANCH' &&
          promo.dealershipId === allocatedBranchId &&
          promo.type === 'special'
        );
      }
      return false;
    },
    [isAdmin, isItManager, isMarketing, isBranchAdmin, isSalesAgent, isPartsExec, isServiceClerk, allocatedBranchId]
  );

  const savePromotion = useCallback(
    async (promo: Omit<CmsPromotion, 'updatedAt' | 'updatedBy'>) => {
      const canPublishPromos =
        isAdmin || isItManager || isMarketing || isBranchAdmin || isSalesAgent || isPartsExec || isServiceClerk;
      if (!user || !canPublishPromos) {
        throw new Error('Your current role cannot publish promotions.');
      }
      if (!ISO_DATE_RE.test(promo.validUntil)) {
        throw new Error('Valid Until date must use YYYY-MM-DD format.');
      }
      const id = sanitizeId(promo.id, 'promo');
      const isExpired = promo.validUntil < todayISO;
      const isDeptSpecialist = isPartsExec || isServiceClerk;
      const isBranchLocked = isBranchAdmin || isSalesAgent || isDeptSpecialist;

      if (isBranchLocked && !allocatedBranchId) {
        throw new Error('No allocated dealership found for your staff profile.');
      }
      if (isSalesAgent && promo.type === 'competition') {
        throw new Error('Car Sales Executives can only publish Specials and Events for their branch.');
      }
      if (isDeptSpecialist && promo.type !== 'special') {
        throw new Error('Department staff can only publish branch-scoped Specials.');
      }

      const scope = isBranchLocked
        ? 'BRANCH'
        : promo.scope === 'BRANCH'
        ? 'BRANCH'
        : 'MASTER';
      const dealershipId = isBranchLocked
        ? allocatedBranchId!
        : scope === 'MASTER'
        ? null
        : promo.dealershipId ?? allDealerships[0]?.id ?? '1';
      const promoType = isDeptSpecialist
        ? 'special'
        : isSalesAgent && promo.type === 'competition'
        ? 'special'
        : promo.type;

      const trimmedMediaUrl = promo.imageUrl.trim().slice(0, 500);
      const resolvedMediaType = isVideoMedia(trimmedMediaUrl, promo.mediaType)
        ? 'video'
        : 'image';

      const payload = {
        id,
        title: promo.title.trim().slice(0, 160),
        type: promoType,
        description: promo.description.trim().slice(0, 1000),
        imageUrl: trimmedMediaUrl,
        mediaType: resolvedMediaType,
        validUntil: promo.validUntil,
        scope,
        dealershipId,
        active: Boolean(promo.active && !isExpired),
        vehicleName: (promo.vehicleName || '').trim().slice(0, 120),
        offerPrice: Math.max(0, Number(promo.offerPrice || 0)),
        monthlyFrom: Math.max(0, Number(promo.monthlyFrom || 0)),
        eventTime: (promo.eventTime || '').trim().slice(0, 60),
        location: (promo.location || '').trim().slice(0, 140),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      try {
        await setDoc(doc(db, 'promotions', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `promotions/${id}`);
      }
    },
    [
      user,
      isAdmin,
      isItManager,
      isMarketing,
      isBranchAdmin,
      isSalesAgent,
      isPartsExec,
      isServiceClerk,
      allocatedBranchId,
      allDealerships,
      todayISO,
    ]
  );

  const archivePromotion = useCallback(
    async (id: string) => {
      if (!user || !canAccessPortal) throw new Error('Authorized staff sign-in required.');
      const target = allPromotions.find((p) => p.id === id);
      if (!target) return;
      if (!canManagePromotion(target)) {
        throw new Error('You do not have permission to archive this campaign.');
      }
      try {
        await setDoc(doc(db, 'promotions', id), {
          ...target,
          active: false,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `promotions/${id}`);
      }
    },
    [user, canAccessPortal, allPromotions, canManagePromotion]
  );

  const reactivatePromotion = useCallback(
    async (id: string, newValidUntil: string) => {
      if (!user || !canAccessPortal) throw new Error('Authorized staff sign-in required.');
      if (!ISO_DATE_RE.test(newValidUntil) || newValidUntil < todayISO) {
        throw new Error(`New expiry date must be on or after ${todayISO}.`);
      }
      const target = allPromotions.find((p) => p.id === id);
      if (!target) return;
      if (!canManagePromotion(target)) {
        throw new Error('You do not have permission to reactivate this campaign.');
      }
      autoArchivedIdsRef.current.delete(`promo:${id}:${newValidUntil}`);
      try {
        await setDoc(doc(db, 'promotions', id), {
          ...target,
          validUntil: newValidUntil,
          active: true,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `promotions/${id}`);
      }
    },
    [user, canAccessPortal, todayISO, allPromotions, canManagePromotion]
  );

  const deletePromotion = useCallback(
    async (id: string) => {
      if (!user || !canAccessPortal) throw new Error('Authorized staff sign-in required.');
      const target = allPromotions.find((p) => p.id === id);
      if (!target || !canManagePromotion(target)) {
        throw new Error('You do not have permission to delete this campaign.');
      }
      try {
        await deleteDoc(doc(db, 'promotions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `promotions/${id}`);
      }
    },
    [user, canAccessPortal, allPromotions, canManagePromotion]
  );

  const saveNews = useCallback(
    async (article: Omit<CmsNewsArticle, 'updatedAt' | 'updatedBy'>) => {
      if (!user || (!isAdmin && !isItManager && !isMarketing)) {
        throw new Error('Group Admin, IT Manager, or Marketing privileges are required.');
      }
      const id = sanitizeId(article.id, 'news');
      const payload = {
        id,
        title: article.title.trim().slice(0, 180),
        category: article.category.trim().slice(0, 80),
        publishedDate: article.publishedDate.trim().slice(0, 60),
        readTime: article.readTime.trim().slice(0, 30) || '3 min read',
        excerpt: article.excerpt.trim().slice(0, 400),
        bodyText: article.bodyText.trim().slice(0, 6000),
        featured: Boolean(article.featured),
        archived: Boolean(article.archived),
        imageSrc: article.imageSrc.trim().slice(0, 500),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      try {
        await setDoc(doc(db, 'news', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `news/${id}`);
      }
    },
    [user, isAdmin, isItManager, isMarketing]
  );

  const deleteNews = useCallback(
    async (id: string) => {
      if (!user || (!isAdmin && !isItManager && !isMarketing)) {
        throw new Error('Group Admin, IT Manager, or Marketing privileges are required.');
      }
      try {
        await deleteDoc(doc(db, 'news', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `news/${id}`);
      }
    },
    [user, isAdmin, isItManager, isMarketing]
  );

  const updateLeadStatus = useCallback(
    async (id: string, status: CmsLeadSubmission['status']) => {
      if (!user) throw new Error('Authenticated sign-in required.');
      const target = leads.find((l) => l.id === id);
      const belongsToBranch = Boolean(
        allocatedBranchId &&
          target &&
          (target.submittedAtDealershipId === allocatedBranchId ||
            target.homeDealershipId === allocatedBranchId)
      );
      const canBranchAdminUpdate = Boolean(isBranchAdmin && belongsToBranch);
      const canPartsUpdate = Boolean(
        isPartsExec && belongsToBranch && target?.leadType === 'parts'
      );
      const canServiceUpdate = Boolean(
        isServiceClerk && belongsToBranch && target?.leadType === 'service'
      );
      const canSpotterUpdate = Boolean(
        isSalesAgent && belongsToBranch && target && isSpotterLead(target)
      );

      if (
        !isAdmin &&
        !isItManager &&
        !canBranchAdminUpdate &&
        !canPartsUpdate &&
        !canServiceUpdate &&
        !canSpotterUpdate
      ) {
        throw new Error('You do not have permission to update this customer enquiry.');
      }
      try {
        await updateDoc(doc(db, 'leads', id), { status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `leads/${id}`);
      }
    },
    [
      user,
      isAdmin,
      isItManager,
      isBranchAdmin,
      isPartsExec,
      isServiceClerk,
      isSalesAgent,
      allocatedBranchId,
      leads,
    ]
  );

  const deleteLead = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Only Group Administrators can delete lead records.');
      try {
        await deleteDoc(doc(db, 'leads', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `leads/${id}`);
      }
    },
    [user, isAdmin]
  );

  const saveJobOpening = useCallback(
    async (job: Omit<CmsJobOpening, 'updatedAt' | 'updatedBy'>) => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('Only Group Administrators or IT Managers can create or edit job openings.');
      }
      if (!ISO_DATE_RE.test(job.closingDate)) {
        throw new Error('Closing date must use YYYY-MM-DD format.');
      }
      const isExternal = job.applicationMode === 'external';
      const cleanedExternalUrl = (job.externalApplyUrl || '').trim().slice(0, 500);
      if (isExternal && !/^https?:\/\//i.test(cleanedExternalUrl)) {
        throw new Error('External application links must start with https:// or http://.');
      }
      const id = sanitizeId(job.id, 'job');
      const title = job.title.trim().slice(0, 160);
      const department = job.department.trim().slice(0, 80);
      const locationLabel = job.locationLabel.trim().slice(0, 140);
      const summary = job.summary.trim().slice(0, 600);
      const requirements = job.requirements.trim().slice(0, 4000);
      if (title.length < 3) throw new Error('Job title must be at least 3 characters.');
      if (summary.length < 10) throw new Error('Role summary must be at least 10 characters.');
      if (requirements.length < 5) throw new Error('Requirements must be at least 5 characters.');

      const payload = {
        id,
        title,
        department,
        dealershipId: job.dealershipId ?? null,
        locationLabel,
        employmentType: job.employmentType,
        summary,
        requirements,
        responsibilities: (job.responsibilities || '').trim().slice(0, 4000),
        applicationMode: isExternal ? 'external' : 'internal',
        externalApplyUrl: isExternal ? cleanedExternalUrl : '',
        requiresLicence: Boolean(job.requiresLicence),
        licenceDescription: (job.licenceDescription || '').trim().slice(0, 200),
        closingDate: job.closingDate,
        active: Boolean(job.active),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      try {
        await setDoc(doc(db, 'careersJobs', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `careersJobs/${id}`);
      }
    },
    [user, isAdmin, isItManager]
  );

  const deleteJobOpening = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) {
        throw new Error('Only Group Administrators can delete job openings.');
      }
      try {
        await deleteDoc(doc(db, 'careersJobs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `careersJobs/${id}`);
      }
    },
    [user, isAdmin]
  );

  const submitJobApplication = useCallback(
    async (application: Omit<CmsJobApplication, 'id' | 'status' | 'createdAt'>): Promise<string> => {
      const id = sanitizeId(
        `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        'app'
      );
      const payload = {
        id,
        jobId: application.jobId.trim().slice(0, 128),
        jobTitle: application.jobTitle.trim().slice(0, 160),
        branchId: application.branchId ?? null,
        fullName: application.fullName.trim().slice(0, 120),
        email: application.email.trim().slice(0, 140),
        phone: application.phone.trim().slice(0, 30),
        idNumber: application.idNumber.trim().slice(0, 40),
        cityOrSuburb: application.cityOrSuburb.trim().slice(0, 120),
        yearsExperience: Math.max(0, Math.min(60, Number(application.yearsExperience || 0))),
        highestQualification: application.highestQualification.trim().slice(0, 140),
        driversLicenceCode: (application.driversLicenceCode || '').trim().slice(0, 80),
        coverNote: (application.coverNote || '').trim().slice(0, 4000),
        resumeDoc: application.resumeDoc,
        qualificationDoc: application.qualificationDoc,
        idCopyDoc: application.idCopyDoc,
        licenceDoc: application.licenceDoc ?? null,
        status: 'new',
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'jobApplications', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `jobApplications/${id}`);
        throw new Error('Unable to submit your job application right now. Please try again.');
      }

      const targetBranchId: DealershipId = application.branchId ?? activeDealershipId;

      void fetch('/api/notify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: id,
          leadType: 'job-application',
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email,
          subject: `Job Application: ${payload.jobTitle}`,
          details: [
            `Position: ${payload.jobTitle}`,
            `Applicant: ${payload.fullName} (${payload.cityOrSuburb})`,
            `Qualification: ${payload.highestQualification}`,
            `Experience: ${payload.yearsExperience} year(s)`,
            payload.driversLicenceCode ? `Licence Code: ${payload.driversLicenceCode}` : '',
            `Documents Uploaded: CV (${application.resumeDoc.fileName}), Qualifications (${application.qualificationDoc.fileName}), ID Copy (${application.idCopyDoc.fileName})${
              application.licenceDoc ? `, Licence (${application.licenceDoc.fileName})` : ''
            }`,
            'Review uploaded documents inside the Dealership Admin CMS Careers tab.',
          ]
            .filter(Boolean)
            .join('\n'),
          submittedAtDealershipId: targetBranchId,
          homeDealershipId: targetBranchId,
        }),
      }).catch(() => {});

      return id;
    },
    [activeDealershipId]
  );

  const updateJobApplicationStatus = useCallback(
    async (id: string, status: JobApplicationStatus) => {
      const target = jobApplications.find((a) => a.id === id);
      const canBranchUpdate = Boolean(
        isBranchAdmin && allocatedBranchId && target?.branchId === allocatedBranchId
      );
      if (!user || (!isAdmin && !isItManager && !canBranchUpdate)) {
        throw new Error('Group Admin, IT Manager, or Branch Admin privileges are required to update job application status.');
      }
      try {
        await updateDoc(doc(db, 'jobApplications', id), { status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `jobApplications/${id}`);
      }
    },
    [user, isAdmin, isItManager, isBranchAdmin, allocatedBranchId, jobApplications]
  );

  const deleteJobApplication = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) {
        throw new Error('Only Group Administrators can delete job applications.');
      }
      try {
        await deleteDoc(doc(db, 'jobApplications', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `jobApplications/${id}`);
      }
    },
    [user, isAdmin]
  );

  const submitLead = useCallback(
    async (payload: {
      id?: string;
      leadType: LeadSubmissionType;
      fullName: string;
      phone: string;
      email: string;
      subject: string;
      details: string;
      homeDealershipId?: DealershipId | null;
    }) => {
      const id = sanitizeId(
        payload.id ?? `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        'lead'
      );
      try {
        await setDoc(doc(db, 'leads', id), {
          id,
          leadType: payload.leadType,
          fullName: payload.fullName.trim().slice(0, 120),
          phone: payload.phone.trim().slice(0, 30),
          email: payload.email.trim().slice(0, 140),
          subject: payload.subject.trim().slice(0, 200),
          details: payload.details.trim().slice(0, 6000),
          submittedAtDealershipId: activeDealershipId,
          homeDealershipId: payload.homeDealershipId ?? null,
          status: 'new',
          createdAt: serverTimestamp(),
        });

        // Trigger server-side Nodemailer notification in background (never blocks customer confirmation)
        void fetch('/api/notify-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: id,
            leadType: payload.leadType,
            fullName: payload.fullName.trim().slice(0, 120),
            phone: payload.phone.trim().slice(0, 30),
            email: payload.email.trim().slice(0, 140),
            subject: payload.subject.trim().slice(0, 200),
            details: payload.details.trim().slice(0, 6000),
            submittedAtDealershipId: activeDealershipId,
            homeDealershipId: payload.homeDealershipId ?? null,
          }),
        }).catch(() => {
          // Silently ignore network issues; lead is already persisted in Firestore
        });
      } catch (err) {
        console.warn('Unable to persist lead record:', err);
      }
    },
    [activeDealershipId]
  );

  const createStaffUser = useCallback(
    async (input: {
      fullName: string;
      phone: string;
      email: string;
      role: StaffRole;
      allocatedDealershipId: DealershipId | null;
      defaultPassword: string;
    }): Promise<StaffUserProfile> => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('Group Admin or IT Manager privileges are required to add staff users.');
      }
      if (isItManager && (input.role === 'admin' || input.role === 'it_manager')) {
        throw new Error('IT Managers cannot create Group Admin or IT Manager accounts.');
      }

      const fullName = input.fullName.trim().slice(0, 120);
      const phone = input.phone.trim().slice(0, 30);
      const email = input.email.trim().toLowerCase().slice(0, 140);
      const defaultPassword = input.defaultPassword;

      if (fullName.length < 2) {
        throw new Error('Full name must be at least 2 characters.');
      }
      if (phone.length < 7) {
        throw new Error('Please enter a valid contact phone number (at least 7 digits).');
      }
      if (email.length < 5 || !email.includes('@')) {
        throw new Error('Please enter a valid work email address.');
      }
      if (defaultPassword.length < 8) {
        throw new Error('Default password must be at least 8 characters long.');
      }
      const isBranchScopedRole =
        input.role === 'branch_admin' ||
        input.role === 'it_agent' ||
        input.role === 'agent' ||
        input.role === 'parts' ||
        input.role === 'service';
      const roleLabelMap: Record<StaffRole, string> = {
        admin: 'Group Administrator',
        branch_admin: 'Branch Admin / Dealer Principal',
        it_manager: 'Group IT Manager',
        it_agent: 'Branch IT Agent',
        agent: 'Car Sales Executive',
        marketing: 'Marketing Coordinator',
        parts: 'Parts Agent',
        service: 'Service Booking Agent',
      };
      if (isBranchScopedRole && !input.allocatedDealershipId) {
        throw new Error(
          `Please select an allocated dealership for this ${roleLabelMap[input.role]}.`
        );
      }

      const assignedBranch: DealershipId | null = isBranchScopedRole
        ? input.allocatedDealershipId ?? allDealerships[0]?.id ?? '1'
        : input.allocatedDealershipId;

      const provAuth = getProvisionerAuth();
      let createdUid = '';
      try {
        const cred = await createUserWithEmailAndPassword(provAuth, email, defaultPassword);
        createdUid = cred.user.uid;
        await updateProfile(cred.user, { displayName: fullName }).catch(() => {});
      } catch (err) {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'auth/operation-not-allowed') {
          throw new Error(
            'Email/Password sign-in is disabled in Firebase Console. Enable Authentication → Sign-in method → Email/Password first, then try again.'
          );
        }
        if (code === 'auth/email-already-in-use') {
          throw new Error(`A Firebase account already exists for ${email}.`);
        }
        if (code === 'auth/invalid-email') {
          throw new Error('Invalid work email format.');
        }
        if (code === 'auth/weak-password') {
          throw new Error('Default password is too weak. Use 8+ mixed characters.');
        }
        throw err instanceof Error
          ? err
          : new Error('Unable to create Firebase Authentication user.');
      } finally {
        await signOut(provAuth).catch(() => {});
      }

      const staffDocPayload = {
        uid: createdUid,
        fullName,
        phone,
        email,
        role: input.role,
        allocatedDealershipId: assignedBranch,
        mustChangePassword: true,
        active: true,
        activeEscalation: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
        updatedBy: user.uid,
      };

      try {
        await setDoc(doc(db, 'staffUsers', createdUid), staffDocPayload);
        if (input.role === 'admin') {
          await setDoc(doc(db, 'admins', createdUid), {
            uid: createdUid,
            email,
            role: 'admin',
            addedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `staffUsers/${createdUid}`);
      }

      return {
        uid: createdUid,
        fullName,
        phone,
        email,
        role: input.role,
        allocatedDealershipId: assignedBranch,
        mustChangePassword: true,
        active: true,
        activeEscalation: null,
        createdBy: user.uid,
        updatedBy: user.uid,
      };
    },
    [user, isAdmin, isItManager, allDealerships]
  );

  const updateStaffUser = useCallback(
    async (
      uid: string,
      updates: {
        fullName: string;
        phone: string;
        role: StaffRole;
        allocatedDealershipId: DealershipId | null;
        active: boolean;
      }
    ) => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('Group Admin or IT Manager privileges are required to update staff permissions.');
      }
      const existingStaff = staffUsers.find((s) => s.uid === uid);
      if (!existingStaff) {
        throw new Error('Staff profile not found.');
      }
      if (
        isItManager &&
        (existingStaff.role === 'admin' ||
          existingStaff.role === 'it_manager' ||
          updates.role === 'admin' ||
          updates.role === 'it_manager')
      ) {
        throw new Error('IT Managers cannot modify or assign Group Admin or IT Manager roles.');
      }

      const fullName = updates.fullName.trim().slice(0, 120);
      const phone = updates.phone.trim().slice(0, 30);
      if (fullName.length < 2) {
        throw new Error('Full name must be at least 2 characters.');
      }
      if (phone.length < 7) {
        throw new Error('Phone number must be at least 7 characters.');
      }
      const isBranchScopedRole =
        updates.role === 'branch_admin' ||
        updates.role === 'it_agent' ||
        updates.role === 'agent' ||
        updates.role === 'parts' ||
        updates.role === 'service';
      if (isBranchScopedRole && !updates.allocatedDealershipId) {
        throw new Error('Branch-scoped staff roles must be assigned to a dealership.');
      }
      if (uid === user.uid && (!updates.active || updates.role !== existingStaff.role)) {
        throw new Error('You cannot suspend or demote your own currently signed-in account.');
      }

      const assignedBranch = isBranchScopedRole
        ? updates.allocatedDealershipId ?? allDealerships[0]?.id ?? '1'
        : updates.allocatedDealershipId;

      const clearEscalation = updates.role !== 'it_agent' || !updates.active;

      try {
        await updateDoc(doc(db, 'staffUsers', uid), {
          fullName,
          phone,
          role: updates.role,
          allocatedDealershipId: assignedBranch,
          active: updates.active,
          ...(clearEscalation ? { activeEscalation: null } : {}),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });

        if (isAdmin) {
          if (updates.role === 'admin' && updates.active) {
            await setDoc(doc(db, 'admins', uid), {
              uid,
              email: existingStaff.email,
              role: 'admin',
              addedAt: serverTimestamp(),
            });
          } else {
            await deleteDoc(doc(db, 'admins', uid)).catch(() => {});
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staffUsers/${uid}`);
      }
    },
    [user, isAdmin, isItManager, staffUsers, allDealerships]
  );

  const removeStaffUser = useCallback(
    async (uid: string) => {
      if (!user || !isAdmin) {
        throw new Error('Only Group Administrators can remove staff users.');
      }
      if (uid === user.uid) {
        throw new Error('You cannot remove your own currently signed-in account.');
      }
      try {
        await deleteDoc(doc(db, 'staffUsers', uid));
        await deleteDoc(doc(db, 'admins', uid)).catch(() => {});
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staffUsers/${uid}`);
      }
    },
    [user, isAdmin]
  );

  const createItTicket = useCallback(
    async (payload: {
      targetDealershipId: DealershipId | null;
      requestedRole: EscalatableStaffRole;
      requestedDurationMinutes: number;
      title: string;
      reason: string;
    }): Promise<string> => {
      if (!user || !isItAgent || !staffProfile?.allocatedDealershipId) {
        throw new Error('Only Branch IT Agents can submit role-escalation tickets.');
      }
      const title = payload.title.trim().slice(0, 160);
      const reason = payload.reason.trim().slice(0, 2000);
      if (title.length < 3) throw new Error('Ticket title must be at least 3 characters.');
      if (reason.length < 5) throw new Error('Please explain why you need elevated access (at least 5 characters).');
      const durationMins = Math.min(1440, Math.max(5, Math.round(Number(payload.requestedDurationMinutes || 60))));
      const targetBranch =
        payload.requestedRole === 'marketing'
          ? payload.targetDealershipId ?? null
          : payload.targetDealershipId ?? staffProfile.allocatedDealershipId;
      if (payload.requestedRole !== 'marketing' && !targetBranch) {
        throw new Error('Please choose a target dealership branch for this role.');
      }

      const id = sanitizeId(`itt-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 'itt');
      const docPayload = {
        id,
        requesterUid: user.uid,
        requesterName: staffProfile.fullName || user.displayName || 'Branch IT Agent',
        requesterEmail: staffProfile.email || user.email || '',
        requesterBranchId: staffProfile.allocatedDealershipId,
        targetDealershipId: targetBranch,
        requestedRole: payload.requestedRole,
        requestedDurationMinutes: durationMins,
        title,
        reason,
        status: 'open',
        reviewNote: '',
        reviewedByUid: null,
        reviewedByName: null,
        approvedAt: null,
        expiresAt: null,
        resolvedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'itTickets', id), docPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `itTickets/${id}`);
      }
      return id;
    },
    [user, isItAgent, staffProfile]
  );

  const approveItTicketEscalation = useCallback(
    async (payload: { ticketId: string; durationMinutes: number; reviewNote: string }) => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('IT Manager or Group Administrator privileges are required to grant escalation.');
      }
      const ticket = itTickets.find((t) => t.id === payload.ticketId);
      if (!ticket) throw new Error('IT ticket not found.');

      const targetStaff = staffUsers.find((s) => s.uid === ticket.requesterUid);
      if (!targetStaff || targetStaff.role !== 'it_agent' || !targetStaff.active) {
        throw new Error('The requesting staff member must be an active Branch IT Agent.');
      }

      const durationMins = Math.min(1440, Math.max(5, Math.round(Number(payload.durationMinutes || ticket.requestedDurationMinutes || 60))));
      const expiresDate = new Date(Date.now() + durationMins * 60 * 1000);
      const expiresTs = Timestamp.fromDate(expiresDate);
      const reviewerName =
        staffProfile?.fullName || user.displayName || user.email || 'IT Manager';
      const reviewNote = payload.reviewNote.trim().slice(0, 1000);

      const batch = writeBatch(db);
      batch.update(doc(db, 'itTickets', ticket.id), {
        status: 'approved_temporary',
        reviewNote,
        reviewedByUid: user.uid,
        reviewedByName: reviewerName.slice(0, 120),
        approvedAt: serverTimestamp(),
        expiresAt: expiresTs,
        resolvedAt: null,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffUsers', ticket.requesterUid), {
        activeEscalation: {
          ticketId: ticket.id,
          grantedRole: ticket.requestedRole,
          dealershipId:
            ticket.requestedRole === 'marketing'
              ? ticket.targetDealershipId ?? null
              : ticket.targetDealershipId ?? ticket.requesterBranchId,
          expiresAt: expiresTs,
          grantedBy: user.uid,
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `itTickets/${ticket.id}/approve`);
      }
    },
    [user, isAdmin, isItManager, itTickets, staffUsers, staffProfile]
  );

  const resolveItTicketDirectly = useCallback(
    async (payload: { ticketId: string; reviewNote: string }) => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('IT Manager or Group Administrator privileges are required to resolve tickets.');
      }
      const ticket = itTickets.find((t) => t.id === payload.ticketId);
      if (!ticket) throw new Error('IT ticket not found.');

      const reviewerName =
        staffProfile?.fullName || user.displayName || user.email || 'IT Manager';
      const reviewNote =
        payload.reviewNote.trim().slice(0, 1000) || 'Completed directly by Group IT.';
      const targetStaff = staffUsers.find((s) => s.uid === ticket.requesterUid);

      const batch = writeBatch(db);
      batch.update(doc(db, 'itTickets', ticket.id), {
        status: 'resolved',
        reviewNote,
        reviewedByUid: user.uid,
        reviewedByName: reviewerName.slice(0, 120),
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (targetStaff?.activeEscalation?.ticketId === ticket.id) {
        batch.update(doc(db, 'staffUsers', ticket.requesterUid), {
          activeEscalation: null,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `itTickets/${ticket.id}/resolve`);
      }
    },
    [user, isAdmin, isItManager, itTickets, staffUsers, staffProfile]
  );

  const rejectItTicket = useCallback(
    async (payload: { ticketId: string; reviewNote: string }) => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('IT Manager or Group Administrator privileges are required to reject tickets.');
      }
      const ticket = itTickets.find((t) => t.id === payload.ticketId);
      if (!ticket) throw new Error('IT ticket not found.');
      const reviewNote = payload.reviewNote.trim().slice(0, 1000);
      if (reviewNote.length < 3) {
        throw new Error('Please provide a short reason before rejecting an escalation request.');
      }

      const reviewerName =
        staffProfile?.fullName || user.displayName || user.email || 'IT Manager';
      const targetStaff = staffUsers.find((s) => s.uid === ticket.requesterUid);

      const batch = writeBatch(db);
      batch.update(doc(db, 'itTickets', ticket.id), {
        status: 'rejected',
        reviewNote,
        reviewedByUid: user.uid,
        reviewedByName: reviewerName.slice(0, 120),
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (targetStaff?.activeEscalation?.ticketId === ticket.id) {
        batch.update(doc(db, 'staffUsers', ticket.requesterUid), {
          activeEscalation: null,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `itTickets/${ticket.id}/reject`);
      }
    },
    [user, isAdmin, isItManager, itTickets, staffUsers, staffProfile]
  );

  const revokeItTicketEscalation = useCallback(
    async (payload: { ticketId: string; reviewNote: string }) => {
      if (!user || (!isAdmin && !isItManager)) {
        throw new Error('IT Manager or Group Administrator privileges are required to revoke escalations.');
      }
      const ticket = itTickets.find((t) => t.id === payload.ticketId);
      if (!ticket) throw new Error('IT ticket not found.');

      const reviewerName =
        staffProfile?.fullName || user.displayName || user.email || 'IT Manager';
      const reviewNote =
        payload.reviewNote.trim().slice(0, 1000) || 'Temporary elevated access revoked early.';

      const batch = writeBatch(db);
      batch.update(doc(db, 'itTickets', ticket.id), {
        status: 'revoked',
        reviewNote,
        reviewedByUid: user.uid,
        reviewedByName: reviewerName.slice(0, 120),
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'staffUsers', ticket.requesterUid), {
        activeEscalation: null,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `itTickets/${ticket.id}/revoke`);
      }
    },
    [user, isAdmin, isItManager, itTickets, staffProfile]
  );

  const getBranchDependencies = useCallback(
    (branchId: DealershipId) => {
      const vehiclesCount = allVehicles.filter((v) => v.homeDealershipId === branchId).length;
      const promotionsCount = allPromotions.filter(
        (p) => p.scope === 'BRANCH' && p.dealershipId === branchId
      ).length;
      const staffCount = staffUsers.filter((s) => s.allocatedDealershipId === branchId).length;
      return {
        vehiclesCount,
        promotionsCount,
        staffCount,
        totalCount: vehiclesCount + promotionsCount + staffCount,
      };
    },
    [allVehicles, allPromotions, staffUsers]
  );

  const deleteBranchIfUnused = useCallback(
    async (branchId: DealershipId) => {
      if (!user || !isAdmin) {
        throw new Error('Only Group Administrators can delete dealership branches.');
      }
      const deps = getBranchDependencies(branchId);
      if (deps.totalCount > 0) {
        const parts: string[] = [];
        if (deps.vehiclesCount > 0) parts.push(`${deps.vehiclesCount} vehicle(s)`);
        if (deps.promotionsCount > 0) parts.push(`${deps.promotionsCount} branch promotion(s)`);
        if (deps.staffCount > 0) parts.push(`${deps.staffCount} assigned staff user(s)`);
        throw new Error(
          `Cannot delete this branch yet because ${parts.join(', ')} still reference it. Archive the branch now or reassign those records first.`
        );
      }
      await deleteDealershipBranch(branchId);
    },
    [user, isAdmin, getBranchDependencies, deleteDealershipBranch]
  );

  const value: DealershipDataContextValue = {
    todayISO,
    user,
    authReady,
    isAdmin,
    isBranchAdmin,
    isItManager,
    isItAgent,
    isSalesAgent,
    isMarketing,
    isPartsExec,
    isServiceClerk,
    baseStaffRole,
    staffRole,
    activeEscalation,
    escalationRemainingSeconds,
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
    loadingCatalog,
    usingFallbackSeed,
    activeVehicles,
    activePromotions,
    activeSpecials,
    activeEvents,
    activeCompetitions,
    activeNews,
    activeJobs,
    allVehicles,
    allPromotions,
    archivedPromotions,
    allNews,
    allJobs,
    jobApplications,
    leads,
    staffUsers,
    itTickets,
    seedCatalogToFirestore,
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
    submitJobApplication,
    updateJobApplicationStatus,
    deleteJobApplication,
    updateLeadStatus,
    deleteLead,
    createStaffUser,
    updateStaffUser,
    removeStaffUser,
    createItTicket,
    approveItTicketEscalation,
    resolveItTicketDirectly,
    rejectItTicket,
    revokeItTicketEscalation,
    getBranchDependencies,
    deleteBranchIfUnused,
    submitLead,
  };

  return (
    <DealershipDataContext.Provider value={value}>
      {children}
    </DealershipDataContext.Provider>
  );
}

export function useDealershipData(): DealershipDataContextValue {
  const ctx = useContext(DealershipDataContext);
  if (!ctx) {
    throw new Error('useDealershipData must be used inside DealershipDataProvider.');
  }
  return ctx;
}
