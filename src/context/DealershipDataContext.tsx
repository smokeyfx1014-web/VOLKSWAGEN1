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
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
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
} from '../data/dealership';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  CmsLeadSubmission,
  CmsNewsArticle,
  CmsPromotion,
  CmsVehicle,
  DealershipId,
  LeadSubmissionType,
} from '../types/dealership';
import { useDealership } from './DealershipContext';

const BOOTSTRAPPED_ADMIN_EMAIL = 'smokeydhlamini@gmail.com';
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
  authError: string | null;
  signInAdmin: () => Promise<void>;
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

  // Admin full collections across the entire 3-branch group
  allVehicles: CmsVehicle[];
  allPromotions: CmsPromotion[];
  archivedPromotions: CmsPromotion[];
  allNews: CmsNewsArticle[];
  leads: CmsLeadSubmission[];

  // Admin mutations
  seedCatalogToFirestore: () => Promise<void>;
  seedAllDefaultData: () => Promise<void>;
  saveVehicle: (vehicle: Omit<CmsVehicle, 'createdAt' | 'updatedAt' | 'updatedBy'> & { createdAt?: unknown }) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  savePromotion: (promo: Omit<CmsPromotion, 'updatedAt' | 'updatedBy'>) => Promise<void>;
  archivePromotion: (id: string) => Promise<void>;
  reactivatePromotion: (id: string, newValidUntil: string) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  saveNews: (article: Omit<CmsNewsArticle, 'updatedAt' | 'updatedBy'>) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  updateLeadStatus: (id: string, status: CmsLeadSubmission['status']) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;

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
  const { activeDealershipId, seedDefaultDealerships } = useDealership();

  const [todayISO, setTodayISO] = useState<string>(() => getTodayISO());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [rosterAdmin, setRosterAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [dbVehicles, setDbVehicles] = useState<CmsVehicle[] | null>(null);
  const [dbPromotions, setDbPromotions] = useState<CmsPromotion[] | null>(null);
  const [dbNews, setDbNews] = useState<CmsNewsArticle[] | null>(null);
  const [leads, setLeads] = useState<CmsLeadSubmission[]>([]);

  const autoArchivedIdsRef = useRef<Set<string>>(new Set());
  const autoSeededRef = useRef(false);

  // Refresh todayISO every 30s for instant midnight expiry
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = getTodayISO();
      setTodayISO((prev) => (prev === next ? prev : next));
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Track Firebase auth & admin role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError(null);
      if (!nextUser) {
        setRosterAdmin(false);
        setAuthReady(true);
        return;
      }

      if (
        nextUser.emailVerified &&
        nextUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
      ) {
        setRosterAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'admins', nextUser.uid));
        setRosterAdmin(snap.exists());
      } catch {
        setRosterAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  const isAdmin = Boolean(
    user &&
      ((user.emailVerified && user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) ||
        rosterAdmin)
  );

  // Real-time Firestore listeners
  useEffect(() => {
    if (!authReady) return;

    const vehiclesQuery = isAdmin
      ? collection(db, 'vehicles')
      : query(collection(db, 'vehicles'), where('status', '==', 'available'));

    const promotionsQuery = isAdmin
      ? collection(db, 'promotions')
      : query(collection(db, 'promotions'), where('active', '==', true));

    const newsQuery = isAdmin
      ? collection(db, 'news')
      : query(collection(db, 'news'), where('archived', '==', false));

    const unsubVehicles = onSnapshot(
      vehiclesQuery,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as CmsVehicle);
        setDbVehicles(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'vehicles')
    );

    const unsubPromotions = onSnapshot(
      promotionsQuery,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as CmsPromotion);
        setDbPromotions(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'promotions')
    );

    const unsubNews = onSnapshot(
      newsQuery,
      (snap) => {
        setDbNews(snap.docs.map((d) => d.data() as CmsNewsArticle));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'news')
    );

    let unsubLeads = () => {};
    if (isAdmin) {
      unsubLeads = onSnapshot(
        collection(db, 'leads'),
        (snap) => {
          setLeads(snap.docs.map((d) => d.data() as CmsLeadSubmission));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'leads')
      );
    } else {
      setLeads([]);
    }

    return () => {
      unsubVehicles();
      unsubPromotions();
      unsubNews();
      unsubLeads();
    };
  }, [authReady, isAdmin]);

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

  // Auto-seed once when an admin logs into an empty database
  useEffect(() => {
    if (!isAdmin || !user || autoSeededRef.current) return;
    if (
      dbVehicles !== null &&
      dbPromotions !== null &&
      dbNews !== null &&
      dbVehicles.length === 0 &&
      dbPromotions.length === 0 &&
      dbNews.length === 0
    ) {
      autoSeededRef.current = true;
      void seedAllDefaultData();
    }
  }, [isAdmin, user, dbVehicles, dbPromotions, dbNews, seedAllDefaultData]);

  // Auto-archive expired promotions when admin views catalog
  useEffect(() => {
    if (!isAdmin || !user || !dbPromotions) return;
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
  }, [isAdmin, user, dbPromotions, todayISO]);

  const loadingCatalog = dbVehicles === null || dbPromotions === null || dbNews === null;

  const usingFallbackSeed = Boolean(
    !loadingCatalog &&
      dbVehicles?.length === 0 &&
      dbPromotions?.length === 0 &&
      dbNews?.length === 0
  );

  // Use Firestore records if present, otherwise instant local fallback so all 3 branches render immediately
  const allVehicles: CmsVehicle[] = useMemo(() => {
    const raw = dbVehicles && dbVehicles.length > 0 ? dbVehicles : INITIAL_CMS_VEHICLES;
    return raw.map((v) => ({
      ...v,
      images: Array.isArray(v.images) && v.images.length > 0 ? v.images : ['/assets/aistudio/starting-4_ece31872.jpg'],
      homeDealershipId: v.homeDealershipId ?? '1',
      status: v.status ?? 'available',
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

  const signOutAdmin = useCallback(async () => {
    await signOut(auth);
  }, []);

  const saveVehicle = useCallback(
    async (
      vehicle: Omit<CmsVehicle, 'createdAt' | 'updatedAt' | 'updatedBy'> & { createdAt?: unknown }
    ) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      const id = sanitizeId(vehicle.id, 'veh');
      const cleanedImages = (vehicle.images ?? [])
        .map((url) => url.trim().slice(0, 500))
        .filter((url) => url.length >= 5)
        .slice(0, 10);

      if (cleanedImages.length === 0) {
        throw new Error('At least one valid vehicle image URL is required.');
      }

      const payload = {
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
        powerKw: vehicle.powerKw.trim().slice(0, 40) || '85 kW',
        fuelEconomy: vehicle.fuelEconomy.trim().slice(0, 40) || '5.6 L/100km',
        colour: vehicle.colour.trim().slice(0, 60) || 'Pure White',
        images: cleanedImages,
        homeDealershipId: vehicle.homeDealershipId,
        status: vehicle.status,
        createdAt: vehicle.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      try {
        await setDoc(doc(db, 'vehicles', id), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `vehicles/${id}`);
      }
    },
    [user, isAdmin]
  );

  const deleteVehicle = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      try {
        await deleteDoc(doc(db, 'vehicles', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `vehicles/${id}`);
      }
    },
    [user, isAdmin]
  );

  const savePromotion = useCallback(
    async (promo: Omit<CmsPromotion, 'updatedAt' | 'updatedBy'>) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      if (!ISO_DATE_RE.test(promo.validUntil)) {
        throw new Error('Valid Until date must use YYYY-MM-DD format.');
      }
      const id = sanitizeId(promo.id, 'promo');
      const isExpired = promo.validUntil < todayISO;
      const scope = promo.scope === 'BRANCH' ? 'BRANCH' : 'MASTER';
      const dealershipId = scope === 'MASTER' ? null : promo.dealershipId ?? '1';

      const payload = {
        id,
        title: promo.title.trim().slice(0, 160),
        type: promo.type,
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
    [user, isAdmin, todayISO]
  );

  const archivePromotion = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      const target = allPromotions.find((p) => p.id === id);
      if (!target) return;
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
    [user, isAdmin, allPromotions]
  );

  const reactivatePromotion = useCallback(
    async (id: string, newValidUntil: string) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      if (!ISO_DATE_RE.test(newValidUntil) || newValidUntil < todayISO) {
        throw new Error(`New expiry date must be on or after ${todayISO}.`);
      }
      const target = allPromotions.find((p) => p.id === id);
      if (!target) return;
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
    [user, isAdmin, todayISO, allPromotions]
  );

  const deletePromotion = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      try {
        await deleteDoc(doc(db, 'promotions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `promotions/${id}`);
      }
    },
    [user, isAdmin]
  );

  const saveNews = useCallback(
    async (article: Omit<CmsNewsArticle, 'updatedAt' | 'updatedBy'>) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
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
    [user, isAdmin]
  );

  const deleteNews = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      try {
        await deleteDoc(doc(db, 'news', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `news/${id}`);
      }
    },
    [user, isAdmin]
  );

  const updateLeadStatus = useCallback(
    async (id: string, status: CmsLeadSubmission['status']) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
      try {
        await updateDoc(doc(db, 'leads', id), { status });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `leads/${id}`);
      }
    },
    [user, isAdmin]
  );

  const deleteLead = useCallback(
    async (id: string) => {
      if (!user || !isAdmin) throw new Error('Admin sign-in required.');
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
          details: payload.details.trim().slice(0, 1500),
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

  const value: DealershipDataContextValue = {
    todayISO,
    user,
    authReady,
    isAdmin,
    authError,
    signInAdmin,
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
    seedCatalogToFirestore,
    seedAllDefaultData,
    saveVehicle,
    deleteVehicle,
    savePromotion,
    archivePromotion,
    reactivatePromotion,
    deletePromotion,
    saveNews,
    deleteNews,
    updateLeadStatus,
    deleteLead,
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
