import * as XLSX from 'xlsx';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadFileToGoogleDrive } from './documentEngine';
import { cleanFirestoreData } from '../utils/cleanData';
import {
  Transaction,
  Partner,
  Account,
  BusinessUnit,
  ExpenseCategory,
  ProductItem,
  AuditLog,
  CompanyProfile,
  DocumentItem,
} from '../types';

export interface FullBackupData {
  version: string;
  backupId: string;
  timestamp: string;
  companyProfile?: CompanyProfile;
  transactions: Transaction[];
  businessUnits: BusinessUnit[];
  partners: Partner[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  products: ProductItem[];
  documents: DocumentItem[];
  auditLogs: AuditLog[];
}

const BACKUP_VERSION = '2.0.0';

function makeBackupId(): string {
  return `backup_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function commitChunk(batch: ReturnType<typeof writeBatch>, count: number): Promise<void> {
  if (count > 0) {
    await batch.commit();
  }
}

/**
 * Fetch all Firestore collections to construct a complete backup payload.
 */
export async function generateFullBackupPayload(): Promise<FullBackupData> {
  const [
    companySnap,
    trxSnap,
    unitsSnap,
    partnersSnap,
    accountsSnap,
    catsSnap,
    prodsSnap,
    docsSnap,
    logsSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'companyProfile')),
    getDocs(collection(db, 'transactions')),
    getDocs(collection(db, 'businessUnits')),
    getDocs(collection(db, 'partners')),
    getDocs(collection(db, 'accounts')),
    getDocs(collection(db, 'expenseCategories')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'documents')),
    getDocs(collection(db, 'auditLogs')),
  ]);

  const companyProfile = !companySnap.empty
    ? (companySnap.docs.find((d) => d.id === 'main')?.data() as CompanyProfile | undefined) ||
      (companySnap.docs[0].data() as CompanyProfile)
    : undefined;

  return {
    version: BACKUP_VERSION,
    backupId: makeBackupId(),
    timestamp: new Date().toISOString(),
    companyProfile,
    transactions: trxSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Transaction)),
    businessUnits: unitsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as BusinessUnit)),
    partners: partnersSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Partner)),
    accounts: accountsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Account)),
    expenseCategories: catsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ExpenseCategory)),
    products: prodsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ProductItem)),
    documents: docsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as DocumentItem)),
    auditLogs: logsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLog)),
  };
}

/**
 * Download Backup as JSON file.
 */
export function downloadJsonBackup(
  data: FullBackupData,
  filenamePrefix: string = 'PT_Gema_Abadi_Backup'
): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${filenamePrefix}_${dateStr}_${data.backupId}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download multi-sheet Excel backup.
 */
export function downloadExcelBackup(
  data: FullBackupData,
  filenamePrefix: string = 'Laporan_Keuangan_PT_Gema_Abadi'
): void {
  const wb = XLSX.utils.book_new();

  const trxData = data.transactions.map((t) => ({
    'No Transaksi': t.trxNumber,
    Tanggal: t.date,
    Tipe: t.type,
    'Unit Usaha': t.unitId,
    'Pihak / Mitra': t.partyName,
    'Barang / Uraian': t.itemName,
    Kategori: t.itemCategory || '',
    Qty: t.qty,
    'Harga Satuan': t.unitPrice,
    Total: t.totalAmount,
    'Metode Bayar': t.paymentMethod,
    'Akun': t.accountId,
    'Akun Tujuan': t.destinationAccountId || '',
    'Jatuh Tempo': t.dueDate || '',
    Referensi: t.referenceTrxId || '',
    Status: t.status,
    Keterangan: t.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trxData), 'Transaksi');

  const accData = data.accounts.map((a) => ({
    ID: a.id,
    Nama: a.name,
    Tipe: a.type,
    'No Rekening': a.accountNumber || '',
    'Saldo Awal': a.initialBalance,
    Status: a.isActive ? 'Aktif' : 'Nonaktif',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accData), 'Kas & Bank');

  const partnerData = data.partners.map((p) => ({
    ID: p.id,
    Nama: p.name,
    Tipe: p.type,
    Telepon: p.phone || '',
    Alamat: p.address || '',
    Status: p.status,
    Catatan: p.notes || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(partnerData), 'Buku Mitra');

  const prodData = data.products.map((p) => ({
    ID: p.id,
    Nama: p.name,
    Tipe: p.type,
    'Unit Usaha': p.unitId,
    Harga: p.defaultPrice,
    Satuan: p.unitOfMeasure,
    Stok: p.stock ?? 0,
    Status: p.isActive ? 'Aktif' : 'Nonaktif',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), 'Katalog Produk');

  const unitData = data.businessUnits.map((u) => ({
    ID: u.id,
    Nama: u.name,
    Kode: u.code,
    Deskripsi: u.description,
    Status: u.isActive ? 'Aktif' : 'Nonaktif',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unitData), 'Unit Usaha');

  const docData = data.documents.map((d) => ({
    ID: d.id,
    'Transaction ID': d.transactionId || '',
    Nama: d.name,
    'Mime Type': d.mimeType,
    Ukuran: d.size,
    Storage: d.storageType,
    'Drive File ID': d.driveFileId || '',
    'Web View Link': d.webViewLink || '',
    'Uploaded By': d.uploadedBy,
    'Uploaded At': d.uploadedAt,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docData), 'Dokumen');

  const auditData = data.auditLogs.map((l) => ({
    ID: l.id,
    Aksi: l.action,
    Entitas: l.entity,
    'Entity ID': l.entityId,
    'Dilakukan Oleh': l.performedBy,
    Detail: l.details,
    Waktu: l.timestamp,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditData), 'Audit Log');

  const metaData = [
    { Field: 'Backup Version', Value: data.version },
    { Field: 'Backup ID', Value: data.backupId },
    { Field: 'Created At', Value: data.timestamp },
    { Field: 'Transactions', Value: data.transactions.length },
    { Field: 'Business Units', Value: data.businessUnits.length },
    { Field: 'Partners', Value: data.partners.length },
    { Field: 'Accounts', Value: data.accounts.length },
    { Field: 'Expense Categories', Value: data.expenseCategories.length },
    { Field: 'Products', Value: data.products.length },
    { Field: 'Documents', Value: data.documents.length },
    { Field: 'Audit Logs', Value: data.auditLogs.length },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaData), 'Metadata');

  XLSX.writeFile(
    wb,
    `${filenamePrefix}_${new Date().toISOString().split('T')[0]}_${data.backupId}.xlsx`
  );
}

/**
 * Upload JSON backup to Google Drive.
 */
export async function uploadBackupToDrive(data: FullBackupData): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `backup_PT_GEMA_ABADI_${new Date().toISOString().split('T')[0]}_${data.backupId}.json`;
    const file = new File([jsonStr], filename, { type: 'application/json' });
    const result = await uploadFileToGoogleDrive(file, 'Database Backup PT Gema Abadi');
    return result !== null;
  } catch (error) {
    console.error('Failed to backup to drive:', error);
    return false;
  }
}

function validateBackupData(backupData: FullBackupData): void {
  if (!backupData || !Array.isArray(backupData.transactions)) {
    throw new Error('Format file backup tidak valid. Dokumen transaksi tidak ditemukan.');
  }

  const validTypes = new Set([
    'SALE',
    'PURCHASE',
    'EXPENSE',
    'INCOME',
    'RECEIVABLE_PAYMENT',
    'DEBT_PAYMENT',
    'TRANSFER',
  ]);
  const validMethods = new Set(['CASH', 'TRANSFER', 'CREDIT']);

  for (const trx of backupData.transactions) {
    if (!trx.id || !trx.trxNumber || !trx.date || !trx.unitId) {
      throw new Error('Backup memiliki transaksi dengan identitas wajib yang kosong.');
    }
    if (!validTypes.has(trx.type)) throw new Error(`Tipe transaksi tidak valid: ${trx.type}`);
    if (!validMethods.has(trx.paymentMethod)) throw new Error(`Metode pembayaran tidak valid: ${trx.paymentMethod}`);
    if (!Number.isFinite(Number(trx.totalAmount)) || Number(trx.totalAmount) <= 0) {
      throw new Error(`Nominal tidak valid pada transaksi ${trx.trxNumber}`);
    }
  }
}

async function restoreCollection<T extends { id: string }>(
  collectionName: string,
  items: T[],
  counters: { pending: number; restored: number }
): Promise<{ pending: number }> {
  let batch = writeBatch(db);

  for (const item of items) {
    batch.set(doc(db, collectionName, item.id), cleanFirestoreData(item));
    counters.pending += 1;
    counters.restored += 1;

    if (counters.pending >= 450) {
      await batch.commit();
      counters.pending = 0;
      batch = writeBatch(db);
    }
  }

  if (counters.pending > 0) {
    await batch.commit();
    counters.pending = 0;
  }

  return counters;
}

/**
 * Validate and restore the backup.
 *
 * This is an overwrite-by-document-ID restore, not a destructive collection wipe.
 * A JSON safety snapshot is generated before starting.
 */
export async function restoreBackupData(
  backupData: FullBackupData,
  userEmail: string
): Promise<{ success: boolean; countRestored: number; message: string }> {
  validateBackupData(backupData);

  if (!userEmail) {
    throw new Error('Email pengguna diperlukan untuk restore.');
  }

  const preRestoreSnapshot = await generateFullBackupPayload();
  downloadJsonBackup(preRestoreSnapshot, 'SAFETY_SNAPSHOT_BEFORE_RESTORE');

  const groups: Array<{ collection: string; items: Array<{ id: string }> }> = [
    { collection: 'transactions', items: backupData.transactions },
    { collection: 'businessUnits', items: backupData.businessUnits || [] },
    { collection: 'partners', items: backupData.partners || [] },
    { collection: 'accounts', items: backupData.accounts || [] },
    { collection: 'expenseCategories', items: backupData.expenseCategories || [] },
    { collection: 'products', items: backupData.products || [] },
    { collection: 'documents', items: backupData.documents || [] },
    { collection: 'auditLogs', items: backupData.auditLogs || [] },
  ];

  let totalRestored = 0;
  let pending = 0;
  let batch = writeBatch(db);

  for (const group of groups) {
    for (const item of group.items) {
      batch.set(
        doc(db, group.collection, item.id),
        cleanFirestoreData(item)
      );
      totalRestored += 1;
      pending += 1;

      if (pending >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        pending = 0;
      }
    }
  }

  if (backupData.companyProfile) {
    batch.set(
      doc(db, 'companyProfile', 'main'),
      cleanFirestoreData(backupData.companyProfile)
    );
    totalRestored += 1;
    pending += 1;
  }

  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(
    auditRef,
    cleanFirestoreData({
      id: auditRef.id,
      action: 'RESTORE_DATABASE',
      entity: 'System',
      entityId: backupData.backupId || 'LEGACY_BACKUP',
      performedBy: userEmail,
      details: `Restore database selesai dari backup ${backupData.backupId || 'lama'} dengan ${totalRestored} dokumen dipulihkan.`,
      timestamp: new Date().toISOString(),
    })
  );
  totalRestored += 1;
  pending += 1;

  if (pending > 0) {
    await batch.commit();
  }

  return {
    success: true,
    countRestored: totalRestored,
    message: `Restore selesai: ${totalRestored} dokumen berhasil dipulihkan.`,
  };
}
