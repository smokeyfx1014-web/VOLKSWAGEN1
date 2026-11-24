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
  AutoTraderBranchSyncSummary,
  AutoTraderSyncReport,
  CmsLeadSubmission,
  CmsNewsArticle,
  CmsPromotion,
  CmsVehicle,
  DealershipId,
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

interface DealershipDataContextValue {
  todayISO: string;
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isSalesAgent: boolean;
  isMarketing: boolean;
  isPartsExec: boolean;
  isServiceClerk: boolean;
  staffRole: StaffRole | null;
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

  // Admin / Staff collections
  allVehicles: CmsVehicle[];
  allPromotions: CmsPromotion[];
  archivedPromotions: CmsPromotion[];
  allNews: CmsNewsArticle[];
  leads: CmsLeadSubmission[];
  staffUsers: StaffUserProfile[];

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
  const [leads, setLeads] = useState<CmsLeadSubmission[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserProfile[]>([]);

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

  const isSalesAgent = Boolean(
    user &&
      !isAdmin &&
      staffProfile?.role === 'agent' &&
      staffProfile.active &&
      staffProfile.allocatedDealershipId
  );

  const isMarketing = Boolean(
    user &&
      !isAdmin &&
      staffProfile?.role === 'marketing' &&
      staffProfile.active
  );

  const isPartsExec = Boolean(
    user &&
      !isAdmin &&
      staffProfile?.role === 'parts' &&
      staffProfile.active &&
      staffProfile.allocatedDealershipId
  );

  const isServiceClerk = Boolean(
    user &&
      !isAdmin &&
      staffProfile?.role === 'service' &&
      staffProfile.active &&
      staffProfile.allocatedDealershipId
  );

  const staffRole: StaffRole | null = isAdmin
    ? 'admin'
    : isSalesAgent
    ? 'agent'
    : isMarketing
    ? 'marketing'
    : isPartsExec
    ? 'parts'
    : isServiceClerk
    ? 'service'
    : null;

  const canAccessPortal =
    isAdmin || isSalesAgent || isMarketing || isPartsExec || isServiceClerk;

  const allocatedBranchId: DealershipId | null =
    isSalesAgent || isPartsExec || isServiceClerk
      ? staffProfile?.allocatedDealershipId ?? null
      : null;

  const requiresPasswordSetup = Boolean(
    canAccessPortal && staffProfile?.mustChangePassword === true
  );
  const isDeactivatedStaff = Boolean(
    user && !isBootstrappedOrRosterAdmin && staffProfile && !staffProfile.active
  );

  // Real-time Firestore listeners partitioned cleanly by verified staff role
  useEffect(() => {
    if (!authReady) return;

    if (isAdmin) {
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

      return () => {
        unsubVehicles();
        unsubPromotions();
        unsubNews();
        unsubLeads();
        unsubStaff();
      };
    }

    setStaffUsers([]);

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

      const unsubNews = onSnapshot(
        collection(db, 'news'),
        (snap) => {
          setDbNews(snap.docs.map((d) => d.data() as CmsNewsArticle));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'news')
      );

      return () => {
        unsubVehicles();
        unsubPromotions();
        unsubNews();
      };
    }

    const unsubNews = onSnapshot(
      query(collection(db, 'news'), where('archived', '==', false)),
      (snap) => {
        setDbNews(snap.docs.map((d) => d.data() as CmsNewsArticle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'news')
    );

    if (isSalesAgent && allocatedBranchId) {
      setLeads([]);
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

      return () => {
        unsubPublicVehicles();
        unsubBranchVehicles();
        unsubPublicPromos();
        unsubBranchPromos();
        unsubNews();
      };
    }

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
        unsubVehicles();
        unsubPublicPromos();
        unsubDeptPromos();
        unsubSubmittedLeads();
        unsubHomeLeads();
        unsubNews();
      };
    }

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
      unsubVehicles();
      unsubPromotions();
      unsubNews();
    };
  }, [
    authReady,
    isAdmin,
    isSalesAgent,
    isMarketing,
    isPartsExec,
    isServiceClerk,
    allocatedBranchId,
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

  // Auto-archive expired promotions when admin or marketing views catalog
  useEffect(() => {
    if ((!isAdmin && !isMarketing) || !user || !dbPromotions) return;
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
  }, [isAdmin, isMarketing, user, dbPromotions, todayISO]);

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
      if (!user || (!isAdmin && !isSalesAgent)) {
        throw new Error('Only Administrators and Car Sales Agents can manage vehicles.');
      }
      const id = sanitizeId(vehicle.id, 'veh');
      const existingVehicle = (dbVehicles ?? []).find((v) => v.id === id);

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
            'Car Sales Agents can only edit manually added vehicles for their allocated dealership.'
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

      const targetHomeBranchId: DealershipId = isSalesAgent
        ? allocatedBranchId!
        : vehicle.homeDealershipId;
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
    [user, isAdmin, isSalesAgent, allocatedBranchId, dbVehicles]
  );

  const deleteVehicle = useCallback(
    async (id: string) => {
      if (!user || (!isAdmin && !isSalesAgent)) {
        throw new Error('Only Administrators and Car Sales Agents can remove vehicles.');
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
            'Car Sales Agents can only remove manual vehicles belonging to their allocated dealership.'
          );
        }
      }
      try {
        await deleteDoc(doc(db, 'vehicles', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `vehicles/${id}`);
      }
    },
    [user, isAdmin, isSalesAgent, allocatedBranchId, dbVehicles]
  );

  const clearManualVehicles = useCallback(async (): Promise<number> => {
    if (!user || !isAdmin) throw new Error('Admin sign-in required.');
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
  }, [user, isAdmin, dbVehicles]);

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
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');

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
    [user, isAdmin, dbVehicles]
  );

  const syncAutoTraderFromDecodo = useCallback(async (): Promise<AutoTraderSyncReport> => {
    if (!user || !isAdmin) throw new Error('Admin sign-in required.');
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
  }, [user, isAdmin, allDealerships, reconcileAutoTraderBranches]);

  const importAutoTraderJson = useCallback(
    async (
      rawInput: string,
      targetBranchId: DealershipId,
      reconcileMissing: boolean
    ): Promise<AutoTraderSyncReport> => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
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
    [user, isAdmin, dealershipsById, reconcileAutoTraderBranches]
  );

  const canManagePromotion = useCallback(
    (promo: Pick<CmsPromotion, 'scope' | 'dealershipId' | 'type'>) => {
      if (isAdmin || isMarketing) return true;
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
    [isAdmin, isMarketing, isSalesAgent, isPartsExec, isServiceClerk, allocatedBranchId]
  );

  const savePromotion = useCallback(
    async (promo: Omit<CmsPromotion, 'updatedAt' | 'updatedBy'>) => {
      if (!user || !canAccessPortal) throw new Error('Authorized staff sign-in required.');
      if (!ISO_DATE_RE.test(promo.validUntil)) {
        throw new Error('Valid Until date must use YYYY-MM-DD format.');
      }
      const id = sanitizeId(promo.id, 'promo');
      const isExpired = promo.validUntil < todayISO;
      const isDeptSpecialist = isPartsExec || isServiceClerk;

      if (isSalesAgent) {
        if (!allocatedBranchId) {
          throw new Error('No allocated dealership found for your agent profile.');
        }
        if (promo.type === 'competition') {
          throw new Error('Car Sales Agents can only publish Specials and Events for their branch.');
        }
      }

      if (isDeptSpecialist) {
        if (!allocatedBranchId) {
          throw new Error('No allocated dealership found for your staff profile.');
        }
        if (promo.type !== 'special') {
          throw new Error(
            'Department staff can only publish branch-scoped Specials.'
          );
        }
      }

      const scope =
        isSalesAgent || isDeptSpecialist
          ? 'BRANCH'
          : promo.scope === 'BRANCH'
          ? 'BRANCH'
          : 'MASTER';
      const dealershipId =
        isSalesAgent || isDeptSpecialist
          ? allocatedBranchId!
          : scope === 'MASTER'
          ? null
          : promo.dealershipId ?? allDealerships[0]?.id ?? '1';
      const promoType = isDeptSpecialist
        ? 'special'
        : isSalesAgent && promo.type === 'competition'
        ? 'special'
        : promo.type;

      const payload = {
        id,
        title: promo.title.trim().slice(0, 160),
        type: promoType,
        description: promo.description.trim().slice(0, 1000),
        imageUrl: promo.imageUrl.trim().slice(0, 500),
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
      canAccessPortal,
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
      if (!user || (!isAdmin && !isMarketing)) {
        throw new Error('Administrator or Marketing privileges are required.');
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
    [user, isAdmin, isMarketing]
  );

  const deleteNews = useCallback(
    async (id: string) => {
      if (!user || (!isAdmin && !isMarketing)) {
        throw new Error('Administrator or Marketing privileges are required.');
      }
      try {
        await deleteDoc(doc(db, 'news', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `news/${id}`);
      }
    },
    [user, isAdmin, isMarketing]
  );

  const updateLeadStatus = useCallback(
    async (id: string, status: CmsLeadSubmission['status']) => {
      if (!user) throw new Error('Authenticated sign-in required.');
      const target = leads.find((l) => l.id === id);
      const canPartsUpdate = Boolean(
        isPartsExec &&
          allocatedBranchId &&
          target?.leadType === 'parts' &&
          (target.submittedAtDealershipId === allocatedBranchId ||
            target.homeDealershipId === allocatedBranchId)
      );
      const canServiceUpdate = Boolean(
        isServiceClerk &&
          allocatedBranchId &&
          target?.leadType === 'service' &&
          (target.submittedAtDealershipId === allocatedBranchId ||
            target.homeDealershipId === allocatedBranchId)
      );

      if (!isAdmin && !canPartsUpdate && !canServiceUpdate) {
        throw new Error('You do not have permission to update this customer enquiry.');
      }
      try {
        await updateDoc(doc(db, 'leads', id), { status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `leads/${id}`);
      }
    },
    [user, isAdmin, isPartsExec, isServiceClerk, allocatedBranchId, leads]
  );

  const deleteLead = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Only Administrators can delete lead records.');
      try {
        await deleteDoc(doc(db, 'leads', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `leads/${id}`);
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
      if (!user || !isAdmin) {
        throw new Error('Only Administrators can add staff users.');
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
        input.role === 'agent' || input.role === 'parts' || input.role === 'service';
      const roleLabelMap: Record<StaffRole, string> = {
        admin: 'Administrator',
        agent: 'Car Sales Agent',
        marketing: 'Marketing Coordinator',
        parts: 'Parts Sales Executive',
        service: 'Service Booking Clerk',
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
        createdBy: user.uid,
        updatedBy: user.uid,
      };
    },
    [user, isAdmin, allDealerships]
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
      if (!user || !isAdmin) {
        throw new Error('Only Administrators can update staff user permissions.');
      }
      const existingStaff = staffUsers.find((s) => s.uid === uid);
      if (!existingStaff) {
        throw new Error('Staff profile not found.');
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
        updates.role === 'agent' || updates.role === 'parts' || updates.role === 'service';
      if (isBranchScopedRole && !updates.allocatedDealershipId) {
        throw new Error('Branch-scoped staff roles must be assigned to a dealership.');
      }
      if (uid === user.uid && (!updates.active || updates.role !== 'admin')) {
        throw new Error('You cannot suspend or demote your own active Administrator session.');
      }

      const assignedBranch = isBranchScopedRole
        ? updates.allocatedDealershipId ?? allDealerships[0]?.id ?? '1'
        : updates.allocatedDealershipId;

      try {
        await updateDoc(doc(db, 'staffUsers', uid), {
          fullName,
          phone,
          role: updates.role,
          allocatedDealershipId: assignedBranch,
          active: updates.active,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });

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
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `staffUsers/${uid}`);
      }
    },
    [user, isAdmin, staffUsers, allDealerships]
  );

  const removeStaffUser = useCallback(
    async (uid: string) => {
      if (!user || !isAdmin) {
        throw new Error('Only Administrators can remove staff users.');
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
        throw new Error('Only Administrators can delete dealership branches.');
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
    isSalesAgent,
    isMarketing,
    isPartsExec,
    isServiceClerk,
    staffRole,
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
    allVehicles,
    allPromotions,
    archivedPromotions,
    allNews,
    leads,
    staffUsers,
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
    updateLeadStatus,
    deleteLead,
    createStaffUser,
    updateStaffUser,
    removeStaffUser,
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
