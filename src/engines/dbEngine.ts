import {
  collection,
  doc,
  writeBatch,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';
export { cleanFirestoreData };
import {
  Transaction,
  BusinessUnit,
  Partner,
  Account,
  ExpenseCategory,
  ProductItem,
  DocumentItem,
  AuditLog,
  CompanyProfile,
  UserProfile
} from '../types';

/**
 * Generate a standard sequential transaction number
 */
export function generateTrxNumber(type: string, dateStr: string, existingCount: number = 0): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const prefixMap: Record<string, string> = {
    SALE: 'PJL',
    PURCHASE: 'PBL',
    EXPENSE: 'KLR',
    INCOME: 'MSK',
    RECEIVABLE_PAYMENT: 'BYP',
    DEBT_PAYMENT: 'BYH',
    TRANSFER: 'TRF',
  };
  const prefix = prefixMap[type] || 'TRX';
  const seq = String(existingCount + 1).padStart(4, '0');
  return `${prefix}-${cleanDate}-${seq}`;
}

const OWNER_EMAIL = 'ebeldavid424@gmail.com';

/**
 * Load an authenticated user's profile or create a safe default profile.
 * Only the configured owner email receives OWNER on first creation; all other
 * first-time users start as OPERATOR and must be promoted by an owner.
 */
export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  if (!uid || !email) throw new Error('Identitas pengguna belum lengkap.');

  const ref = doc(db, 'userProfiles', uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    return {
      uid,
      email: data.email || email,
      displayName: data.displayName || displayName || email.split('@')[0],
      role: data.role || 'OPERATOR',
      assignedUnitId: data.assignedUnitId,
    };
  }

  const profile: UserProfile = {
    uid,
    email,
    displayName: displayName || email.split('@')[0],
    role: email.toLowerCase() === OWNER_EMAIL.toLowerCase() ? 'OWNER' : 'OPERATOR',
  };

  await setDoc(ref, cleanFirestoreData(profile));
  return profile;
}

/**
 * Bootstrap required system configuration only if not present
 */
export async function initializeSystemConfiguration(): Promise<void> {
  // Gracefully skip if offline during startup
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.info('Client is offline, skipping remote system initialization.');
    return;
  }

  try {
    // 1. Company Profile
    try {
      const companyDocRef = doc(db, 'companyProfile', 'main');
      const companySnap = await getDoc(companyDocRef);
      if (!companySnap.exists()) {
        const defaultCompany: CompanyProfile = {
          name: 'PT. GEMA ABADI NUGRAHA',
          address: '',
          phone: '',
          email: '',
        };
        await setDoc(companyDocRef, cleanFirestoreData(defaultCompany));
      }
    } catch (e: any) {
      console.warn('Company profile bootstrap note:', e?.message || e);
    }

    // 2. Default Business Units
    try {
      const unitsSnap = await getDocs(collection(db, 'businessUnits'));
      if (unitsSnap.empty) {
        const batch = writeBatch(db);
        const defaultUnits: BusinessUnit[] = [
          { id: 'bengkel', name: 'Bengkel', code: 'BKL', description: 'Unit Servis, Perbaikan & Perbengkelan', isActive: true, isSystem: true },
          { id: 'konstruksi', name: 'Konstruksi', code: 'KNS', description: 'Unit Jasa Konstruksi & Proyek Sipil', isActive: true, isSystem: true },
          { id: 'toko_material', name: 'Toko / Material', code: 'MTR', description: 'Unit Penjualan & Pengadaan Bahan Bangunan/Material', isActive: true, isSystem: true },
          { id: 'lainnya', name: 'Usaha Lainnya', code: 'LNY', description: 'Unit Usaha & Jasa Tambahan', isActive: true, isSystem: true },
          { id: 'umum', name: 'Umum / Kantor', code: 'UMM', description: 'Operasional Kantor Pusat & Manajemen', isActive: true, isSystem: true },
        ];
        defaultUnits.forEach((u) => {
          batch.set(doc(db, 'businessUnits', u.id), cleanFirestoreData(u));
        });
        await batch.commit();
      }
    } catch (e: any) {
      console.warn('Business units bootstrap note:', e?.message || e);
    }

    // 3. Default Cash & Bank Accounts
    try {
      const accountsSnap = await getDocs(collection(db, 'accounts'));
      if (accountsSnap.empty) {
        const batch = writeBatch(db);
        const defaultAccounts: Account[] = [
          { id: 'kas_utama', name: 'Kas Tunai Utama', type: 'CASH', initialBalance: 0, isActive: true },
        ];
        defaultAccounts.forEach((acc) => {
          batch.set(doc(db, 'accounts', acc.id), cleanFirestoreData(acc));
        });
        await batch.commit();
      }
    } catch (e: any) {
      console.warn('Accounts bootstrap note:', e?.message || e);
    }

    // 4. Default Expense Categories
    try {
      const categoriesSnap = await getDocs(collection(db, 'expenseCategories'));
      if (categoriesSnap.empty) {
        const batch = writeBatch(db);
        const defaultCategories: string[] = [
          'Gaji', 'Transport', 'Listrik', 'Bensin', 'Servis', 'Sewa',
          'Material', 'Peralatan', 'Administrasi', 'Pajak', 'Internet',
          'Biaya Proyek', 'Biaya Bengkel', 'Biaya Lain'
        ];
        defaultCategories.forEach((catName, idx) => {
          const id = `cat_${idx + 1}_${catName.toLowerCase().replace(/\s+/g, '_')}`;
          batch.set(doc(db, 'expenseCategories', id), cleanFirestoreData({
            id,
            name: catName,
            isActive: true,
            description: `Kategori pengeluaran ${catName}`
          }));
        });
        await batch.commit();
      }
    } catch (e: any) {
      console.warn('Expense categories bootstrap note:', e?.message || e);
    }
  } catch (error) {
    console.warn('System initialization skipped or offline:', error);
  }
}

/**
 * Record an audit log entry in Firestore
 */
export async function logAuditEvent(
  action: string,
  entity: string,
  entityId: string,
  performedBy: string,
  details: string
): Promise<void> {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logItem: AuditLog = {
      id,
      action,
      entity,
      entityId,
      performedBy,
      details,
      timestamp: new Date().toISOString(),
    };
    await setDoc(doc(db, 'auditLogs', id), cleanFirestoreData(logItem));
  } catch (error) {
    console.warn('Failed to record audit log:', error);
  }
}

function validateTransactionForCommit(trx: Omit<Transaction, 'id'>): void {
  if (!trx.trxNumber || !trx.type || !trx.date || !trx.unitId) {
    throw new Error('Data transaksi wajib lengkap: nomor, jenis, tanggal, dan unit usaha.');
  }
  if (!Number.isFinite(Number(trx.totalAmount)) || Number(trx.totalAmount) <= 0) {
    throw new Error('Total transaksi harus berupa angka lebih dari 0.');
  }
  if (!trx.paymentMethod) {
    throw new Error('Cara bayar wajib dipilih.');
  }
  if (trx.type === 'SALE' || trx.type === 'PURCHASE' || trx.type === 'EXPENSE') {
    if (!trx.itemName?.trim()) throw new Error('Barang/Jasa/Uraian wajib diisi.');
    if (!trx.itemCategory?.trim()) throw new Error('Kategori Barang/Jasa wajib dipilih.');
  }
  if (trx.paymentMethod !== 'CREDIT' && trx.type !== 'TRANSFER' && !trx.accountId) {
    throw new Error('Akun Kas/Bank wajib dipilih.');
  }
  if (trx.paymentMethod === 'CREDIT' && !trx.dueDate) {
    throw new Error('Jatuh tempo wajib diisi untuk transaksi Bon/Kredit.');
  }
  if (trx.type === 'TRANSFER') {
    if (!trx.accountId || !trx.destinationAccountId) {
      throw new Error('Akun asal dan akun tujuan transfer wajib diisi.');
    }
    if (trx.accountId === trx.destinationAccountId) {
      throw new Error('Akun asal dan akun tujuan transfer tidak boleh sama.');
    }
  }
  if ((trx.type === 'RECEIVABLE_PAYMENT' || trx.type === 'DEBT_PAYMENT') && !trx.referenceTrxId) {
    throw new Error('Pembayaran piutang/hutang harus memiliki transaksi rujukan.');
  }
}

/**
 * Save Transaction with ATOMIC Batch Write and Audit Trail
 */
export async function createAtomicTransaction(
  trx: Omit<Transaction, 'id'>,
  userEmail: string
): Promise<string> {
  if (!userEmail?.trim()) throw new Error('Email pengguna wajib tersedia untuk menyimpan transaksi.');
  if (trx.createdBy !== userEmail) {
    throw new Error('Identitas pembuat transaksi tidak sesuai dengan pengguna aktif.');
  }
  validateTransactionForCommit(trx);

  const trxRef = doc(collection(db, 'transactions'));
  const trxId = trxRef.id;

  const fullTrx: Transaction = {
    ...trx,
    id: trxId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const batch = writeBatch(db);

    // 1. Set transaction document with sanitized data (no undefined fields)
    batch.set(trxRef, cleanFirestoreData(fullTrx));

    // 2. Add audit log inside same batch
    const auditRef = doc(collection(db, 'auditLogs'));
    const auditItem: AuditLog = {
      id: auditRef.id,
      action: 'CREATE_TRANSACTION',
      entity: 'Transaction',
      entityId: trxId,
      performedBy: userEmail,
      details: `Transaksi ${fullTrx.trxNumber} (${fullTrx.type}) sebesar Rp${fullTrx.totalAmount.toLocaleString('id-ID')} dibuat untuk ${fullTrx.partyName || 'Umum'} [${fullTrx.paymentMethod}].`,
      timestamp: fullTrx.createdAt,
    };
    batch.set(auditRef, cleanFirestoreData(auditItem));

    // Commit atomic changes
    await batch.commit();
    return trxId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
    throw error;
  }
}

/**
 * Cancel (VOID) a Transaction with ATOMIC Batch Write and Audit Trail
 */
export async function cancelAtomicTransaction(
  transactionId: string,
  reason: string,
  userEmail: string
): Promise<void> {
  try {
    const trxRef = doc(db, 'transactions', transactionId);
    const snap = await getDoc(trxRef);
    if (!snap.exists()) {
      throw new Error('Transaksi tidak ditemukan.');
    }

    const trxData = snap.data() as Transaction;
    if (trxData.status === 'CANCELLED') {
      throw new Error('Transaksi sudah berstatus DIBATALKAN.');
    }

    const batch = writeBatch(db);

    // 1. Mark transaction as CANCELLED (VOID)
    batch.update(trxRef, cleanFirestoreData({
      status: 'CANCELLED',
      cancelReason: reason || 'Dibatalkan oleh pengguna',
      updatedAt: new Date().toISOString(),
    }));

    // 2. Audit log
    const auditRef = doc(collection(db, 'auditLogs'));
    batch.set(auditRef, cleanFirestoreData({
      id: auditRef.id,
      action: 'VOID_TRANSACTION',
      entity: 'Transaction',
      entityId: transactionId,
      performedBy: userEmail,
      details: `Transaksi ${trxData.trxNumber} dibatalkan (VOID). Alasan: ${reason}. Nominal sebelumnya: Rp${trxData.totalAmount.toLocaleString('id-ID')}`,
      timestamp: new Date().toISOString(),
    }));

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
    throw error;
  }
}

/**
 * Real-time listener for Transactions collection
 */
export function subscribeToTransactions(
  onUpdate: (transactions: Transaction[]) => void
): Unsubscribe {
  const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const trxs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Transaction));
      onUpdate(trxs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    }
  );
}

/**
 * Real-time listener for Business Units
 */
export function subscribeToBusinessUnits(
  onUpdate: (units: BusinessUnit[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'businessUnits'),
    (snapshot) => {
      const units = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as BusinessUnit));
      onUpdate(units);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'businessUnits');
    }
  );
}

/**
 * Real-time listener for Accounts
 */
export function subscribeToAccounts(
  onUpdate: (accounts: Account[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'accounts'),
    (snapshot) => {
      const accounts = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Account));
      onUpdate(accounts);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    }
  );
}

/**
 * Real-time listener for Partners (Pelanggan, Supplier, Mitra, Toko)
 */
export function subscribeToPartners(
  onUpdate: (partners: Partner[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'partners'),
    (snapshot) => {
      const partners = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Partner));
      onUpdate(partners);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'partners');
    }
  );
}

/**
 * Real-time listener for Expense Categories
 */
export function subscribeToExpenseCategories(
  onUpdate: (categories: ExpenseCategory[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'expenseCategories'),
    (snapshot) => {
      const cats = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as ExpenseCategory));
      onUpdate(cats);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenseCategories');
    }
  );
}

/**
 * Real-time listener for Products & Services
 */
export function subscribeToProducts(
  onUpdate: (products: ProductItem[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'products'),
    (snapshot) => {
      const prods = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as ProductItem));
      onUpdate(prods);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    }
  );
}

/**
 * Real-time listener for Documents
 */
export function subscribeToDocuments(
  onUpdate: (documents: DocumentItem[]) => void
): Unsubscribe {
  const q = query(collection(db, 'documents'), orderBy('uploadedAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as DocumentItem));
      onUpdate(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    }
  );
}

/**
 * Real-time listener for Audit Logs
 */
export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLog[]) => void
): Unsubscribe {
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLog));
      onUpdate(logs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    }
  );
}

/**
 * Real-time listener for Company Profile
 */
export function subscribeToCompanyProfile(
  onUpdate: (profile: CompanyProfile) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'companyProfile', 'main'),
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as CompanyProfile);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'companyProfile/main');
    }
  );
}
