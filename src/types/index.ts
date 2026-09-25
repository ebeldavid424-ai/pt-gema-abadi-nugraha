export type UserRole = 'OWNER' | 'ADMIN' | 'AKUNTAN' | 'KASIR' | 'SALES' | 'OPERATOR';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedUnitId?: string;
}

export type TransactionType =
  | 'SALE'              // Penjualan
  | 'PURCHASE'          // Pembelian
  | 'EXPENSE'           // Pengeluaran Operasional
  | 'INCOME'            // Pendapatan Lain / Modal
  | 'RECEIVABLE_PAYMENT'// Pembayaran Piutang
  | 'DEBT_PAYMENT'      // Pembayaran Hutang
  | 'TRANSFER';         // Transfer Kas / Bank

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CREDIT'; // CREDIT = Bon / Piutang / Hutang

export type TransactionStatus = 'ACTIVE' | 'CANCELLED';

export interface Transaction {
  id: string;
  trxNumber: string;               // e.g. TRX-20260925-0001
  type: TransactionType;
  date: string;                    // YYYY-MM-DD
  unitId: string;                  // Unit usaha: bengkel, konstruksi, toko, lainnya
  partyName: string;               // Nama pelanggan / supplier / mitra / karyawan
  partyType?: 'PELANGGAN' | 'SUPPLIER' | 'MITRA' | 'KARYAWAN' | 'LAINNYA';
  itemName: string;                // Nama barang / jasa / uraian pengeluaran
  itemCategory?: string;           // Kategori pengeluaran atau produk
  qty: number;
  unitPrice: number;
  totalAmount: number;             // qty * unitPrice
  paymentMethod: PaymentMethod;
  accountId: string;               // Akun Kas / Bank asal/tujuan
  destinationAccountId?: string;   // Untuk TRANSFER antar akun
  dueDate?: string;                // Jatuh tempo jika Bon / Kredit
  paidAmount?: number;             // Untuk transaksi Bon: berapa yang sudah terbayar
  notes?: string;
  status: TransactionStatus;
  cancelReason?: string;
  referenceTrxId?: string;         // Transaksi rujukan (misal bayar piutang ke TRX-001)
  documentUrls?: string[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  isSystem?: boolean;
}

export type { EntityType, RelationType } from './partner';
export type { Partner } from './partner';
export interface Account {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'E_WALLET';
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  initialBalance: number;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  defaultUnitId?: string;
  description?: string;
  isActive: boolean;
}

export interface ProductItem {
  id: string;
  name: string;
  type: 'BARANG' | 'JASA';
  unitId: string;
  defaultPrice: number;
  unitOfMeasure: string;
  stock?: number;
  isActive: boolean;
}

export interface DocumentItem {
  id: string;
  transactionId?: string;
  name: string;
  mimeType: string;
  size: number;
  storageType: 'DRIVE' | 'LOCAL' | 'EMBEDDED';
  driveFileId?: string;
  webViewLink?: string;
  dataUrl?: string; // base64 preview for instant viewing
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

export interface JournalEntry {
  date: string;
  trxNumber: string;
  description: string;
  account: string;
  debit: number;
  credit: number;
  unitId: string;
}

export interface LedgerAccount {
  accountName: string;
  entries: {
    date: string;
    trxNumber: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
}
