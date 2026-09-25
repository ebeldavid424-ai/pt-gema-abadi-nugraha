import * as XLSX from 'xlsx';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadFileToGoogleDrive } from './documentEngine';
import { cleanFirestoreData } from '../utils/cleanData';
import { Transaction, Partner, Account, BusinessUnit, ExpenseCategory, ProductItem, AuditLog, CompanyProfile, DocumentItem } from '../types';

export interface FullBackupData {
  version: string;
  timestamp: string;
  companyProfile?: CompanyProfile;
  transactions: Transaction[];
  businessUnits: BusinessUnit[];
  partners: Partner[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  products: ProductItem[];
  auditLogs: AuditLog[];
  documents: DocumentItem[];
}

/**
 * Fetch all Firestore collections to construct a complete backup payload
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
    logsSnap
  ] = await Promise.all([
    getDocs(collection(db, 'companyProfile')),
    getDocs(collection(db, 'transactions')),
    getDocs(collection(db, 'businessUnits')),
    getDocs(collection(db, 'partners')),
    getDocs(collection(db, 'accounts')),
    getDocs(collection(db, 'expenseCategories')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'auditLogs')),
  ]);

  const companyProfile = !companySnap.empty ? (companySnap.docs[0].data() as CompanyProfile) : undefined;
  const transactions = trxSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Transaction));
  const businessUnits = unitsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as BusinessUnit));
  const partners = partnersSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Partner));
  const accounts = accountsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Account));
  const expenseCategories = catsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ExpenseCategory));
  const products = prodsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as ProductItem));
  const auditLogs = logsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLog));

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    companyProfile,
    transactions,
    businessUnits,
    partners,
    accounts,
    expenseCategories,
    products,
    auditLogs,
  };
}

/**
 * Download Backup as JSON file
 */
export function downloadJsonBackup(data: FullBackupData, filenamePrefix: string = 'PT_Gema_Abadi_Backup'): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${filenamePrefix}_${dateStr}.json`;

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
 * Generate and download multi-sheet Excel (.xlsx) workbook
 */
export function downloadExcelBackup(data: FullBackupData, filenamePrefix: string = 'Laporan_Keuangan_PT_Gema_Abadi'): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Transaksi
  const trxData = data.transactions.map((t) => ({
    'No Transaksi': t.trxNumber,
    Tanggal: t.date,
    Tipe: t.type,
    'Unit Usaha': t.unitId,
    'Pihak / Mitra': t.partyName,
    'Barang / Uraian': t.itemName,
    Kategori: t.itemCategory || '-',
    Qty: t.qty,
    'Harga Satuan': t.unitPrice,
    Total: t.totalAmount,
    'Metode Bayar': t.paymentMethod,
    Status: t.status,
    Keterangan: t.notes || '-',
  }));
  const wsTrx = XLSX.utils.json_to_sheet(trxData);
  XLSX.utils.book_append_sheet(wb, wsTrx, 'Transaksi');

  // 2. Sheet Kas & Bank
  const accData = data.accounts.map((a) => ({
    Nama: a.name,
    Tipe: a.type,
    'No Rekening': a.accountNumber || '-',
    'Saldo Awal': a.initialBalance,
    Status: a.isActive ? 'Aktif' : 'Nonaktif',
  }));
  const wsAcc = XLSX.utils.json_to_sheet(accData);
  XLSX.utils.book_append_sheet(wb, wsAcc, 'Kas & Bank');

  // 3. Sheet Mitra
  const partnerData = data.partners.map((p) => ({
    Nama: p.name,
    Tipe: p.type,
    Telepon: p.phone || '-',
    Alamat: p.address || '-',
    Status: p.status,
  }));
  const wsPartner = XLSX.utils.json_to_sheet(partnerData);
  XLSX.utils.book_append_sheet(wb, wsPartner, 'Buku Mitra');

  // 4. Sheet Produk & Jasa
  const prodData = data.products.map((p) => ({
    Nama: p.name,
    Tipe: p.type,
    'Unit Usaha': p.unitId,
    Harga: p.defaultPrice,
    Satuan: p.unitOfMeasure,
    Stok: p.stock || 0,
    Status: p.isActive ? 'Aktif' : 'Nonaktif',
  }));
  const wsProd = XLSX.utils.json_to_sheet(prodData);
  XLSX.utils.book_append_sheet(wb, wsProd, 'Katalog Produk');

  // 5. Sheet Unit Usaha
  const unitData = data.businessUnits.map((u) => ({
    Nama: u.name,
    Kode: u.code,
    Deskripsi: u.description,
    Status: u.isActive ? 'Aktif' : 'Nonaktif',
  }));
  const wsUnit = XLSX.utils.json_to_sheet(unitData);
  XLSX.utils.book_append_sheet(wb, wsUnit, 'Unit Usaha');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
}

/**
 * Upload JSON backup directly to Google Drive in folder /Database Backup/YYYY/MM
 */
export async function uploadBackupToDrive(data: FullBackupData): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const docData = (data.documents || []).map((d) => ({
     'Transaction ID': d.transactionId || '-',
     Nama: d.name,
     'Mime Type': d.mimeType,
     Ukuran: d.size,
     Storage: d.storageType,
     'Drive File ID': d.driveFileId || '-',
     'Web View Link': d.webViewLink || '-',
     'Uploaded By': d.uploadedBy,
     'Uploaded At': d.uploadedAt,
   }));
   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docData), 'Dokumen');

   const dateStr = new Date().toISOString().split('T')[0];
    const filename = `backup_PT_GEMA_ABADI_${dateStr}.json`;
    const file = new File([jsonStr], filename, { type: 'application/json' });

    const result = await uploadFileToGoogleDrive(file, 'Database Backup PT Gema Abadi');
    return result !== null;
  } catch (error) {
    console.error('Failed to backup to drive:', error);
    return false;
  }
}

/**
 * Validate and Restore Backup Data into Firestore
 */
export async function restoreBackupData(
  backupData: FullBackupData,
  userEmail: string
): Promise<{ success: boolean; countRestored: number; message: string }> {
  if (!backupData || !Array.isArray(backupData.transactions)) {
    throw new Error('Format file backup tidak valid. Dokumen transaksi tidak ditemukan.');
  }

  // 1. Safety automatic snapshot before restore
  const preRestoreSnapshot = await generateFullBackupPayload();
  downloadJsonBackup(preRestoreSnapshot, 'SAFETY_SNAPSHOT_BEFORE_RESTORE');

  // 2. Perform restore in batches
  let batch = writeBatch(db);
  let opCount = 0;
  let totalRestored = 0;

  // Restore transactions
  for (const trx of backupData.transactions) {
    const ref = doc(db, 'transactions', trx.id);
    batch.set(ref, cleanFirestoreData(trx));
    opCount++;
    totalRestored++;

    if (opCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  // Restore Partners
  if (Array.isArray(backupData.partners)) {
    for (const p of backupData.partners) {
      const ref = doc(db, 'partners', p.id);
      batch.set(ref, cleanFirestoreData(p));
      opCount++;
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }
  }

  // Restore Products
  if (Array.isArray(backupData.products)) {
    for (const prod of backupData.products) {
      const ref = doc(db, 'products', prod.id);
      batch.set(ref, cleanFirestoreData(prod));
      opCount++;
      if (opCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }
  }

  // Audit log of restore
  const auditRef = doc(collection(db, 'auditLogs'));
  batch.set(auditRef, cleanFirestoreData({
    id: auditRef.id,
    action: 'RESTORE_DATABASE',
    entity: 'System',
    entityId: 'ALL',
    performedBy: userEmail,
    details: `Restore database berhasil dilakukan. ${totalRestored} transaksi dan master data dipulihkan dari cadangan bertanggal ${backupData.timestamp}.`,
    timestamp: new Date().toISOString(),
  }));

  if (opCount > 0) {
    await batch.commit();
  }

  return {
    success: true,
    countRestored: totalRestored,
    message: `Berhasil memulihkan ${totalRestored} transaksi dan data master ke sistem.`,
  };
}
