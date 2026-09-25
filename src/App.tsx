/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  testConnection,
  getAccessToken,
  setCachedAccessToken,
  googleSignIn,
  db
} from './firebase';
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
  UserProfile,
  UserRole,
  TransactionType
} from './types';
import {
  initializeSystemConfiguration,
  subscribeToTransactions,
  subscribeToBusinessUnits,
  subscribeToAccounts,
  subscribeToPartners,
  subscribeToExpenseCategories,
  subscribeToProducts,
  subscribeToDocuments,
  subscribeToAuditLogs,
  subscribeToCompanyProfile
} from './engines/dbEngine';

// Components & Views
import { Navbar } from './components/Navbar';
import { BottomNav, MainTab } from './components/BottomNav';
import { QuickActionModal } from './components/QuickActionModal';
import { QuickInputModal } from './components/QuickInputModal';
import { ReceiptModal } from './components/ReceiptModal';
import { InvoiceModal } from './components/InvoiceModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';

import { DashboardView } from './views/DashboardView';
import { QuickInputView } from './views/QuickInputView';
import { BillingView } from './views/BillingView';
import { ReportsView } from './views/ReportsView';
import { MenuView } from './views/MenuView';

export default function App() {
  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  // Auth & Profile
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    uid: 'guest',
    email: 'ebeldavid424@gmail.com',
    displayName: 'David Ebel (Owner)',
    role: 'OWNER',
  });
  const [driveConnected, setDriveConnected] = useState<boolean>(false);

  // Toast state for in-app notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Firestore Real-time Collections Data with initial reliable defaults
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([
    { id: 'bengkel', name: 'Bengkel', code: 'BKL', description: 'Unit Servis, Perbaikan & Perbengkelan', isActive: true, isSystem: true },
    { id: 'konstruksi', name: 'Konstruksi', code: 'KNS', description: 'Unit Jasa Konstruksi & Proyek Sipil', isActive: true, isSystem: true },
    { id: 'toko_material', name: 'Toko / Material', code: 'MTR', description: 'Unit Penjualan & Pengadaan Bahan Bangunan/Material', isActive: true, isSystem: true },
    { id: 'lainnya', name: 'Usaha Lainnya', code: 'LNY', description: 'Unit Usaha & Jasa Tambahan', isActive: true, isSystem: true },
    { id: 'umum', name: 'Umum / Kantor', code: 'UMM', description: 'Operasional Kantor Pusat & Manajemen', isActive: true, isSystem: true },
  ]);
  const [accounts, setAccounts] = useState<Account[]>([
    { id: 'kas_utama', name: 'Kas Tunai Utama', type: 'CASH', accountNumber: '-', initialBalance: 0, isActive: true },
    { id: 'bank_bca', name: 'Bank BCA Operasional', type: 'BANK', accountNumber: '8830192831', initialBalance: 0, isActive: true },
    { id: 'bank_mandiri', name: 'Bank Mandiri Proyek', type: 'BANK', accountNumber: '137001928374', initialBalance: 0, isActive: true },
  ]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([
    { id: 'cat_1_gaji', name: 'Gaji', isActive: true },
    { id: 'cat_2_transport', name: 'Transport', isActive: true },
    { id: 'cat_3_listrik', name: 'Listrik', isActive: true },
    { id: 'cat_4_bensin', name: 'Bensin', isActive: true },
    { id: 'cat_5_servis', name: 'Servis', isActive: true },
    { id: 'cat_6_sewa', name: 'Sewa', isActive: true },
    { id: 'cat_7_material', name: 'Material', isActive: true },
    { id: 'cat_8_peralatan', name: 'Peralatan', isActive: true },
    { id: 'cat_9_administrasi', name: 'Administrasi', isActive: true },
    { id: 'cat_10_pajak', name: 'Pajak', isActive: true },
    { id: 'cat_11_internet', name: 'Internet', isActive: true },
    { id: 'cat_12_biaya_proyek', name: 'Biaya Proyek', isActive: true },
    { id: 'cat_13_biaya_bengkel', name: 'Biaya Bengkel', isActive: true },
    { id: 'cat_14_biaya_lain', name: 'Biaya Lain', isActive: true },
  ]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    name: 'PT. GEMA ABADI NUGRAHA',
    address: 'Jl. Raya Industri No. 88, Kawasan Usaha Terpadu',
    phone: '0812-3456-7890',
    email: 'keuangan@gemaabadi.co.id',
    taxId: '01.234.567.8-901.000',
    receiptHeader: 'BUKTI PENERIMAAN KAS RESMI',
    receiptFooter: 'Terima kasih atas kerja sama dan kepercayaan Anda kepada PT. Gema Abadi Nugraha.',
  });

  // Modal States
  const [isQuickActionOpen, setIsQuickActionOpen] = useState<boolean>(false);
  const [quickInputType, setQuickInputType] = useState<TransactionType | null>(null);
  const [isQuickInputOpen, setIsQuickInputOpen] = useState<boolean>(false);
  const [receiptTrx, setReceiptTrx] = useState<Transaction | null>(null);
  const [invoiceTrx, setInvoiceTrx] = useState<Transaction | null>(null);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState<boolean>(false);

  // 1. Initial Connection Test & Bootstrapping
  useEffect(() => {
    testConnection();
    initializeSystemConfiguration();

    // Check online/offline listeners
    const handleOnline = () => setSyncStatus('synced');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Firebase Auth Listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setUserProfile((prev) => ({
          ...prev,
          uid: user.uid,
          email: user.email || prev.email,
          displayName: user.displayName || user.email?.split('@')[0] || prev.displayName,
        }));
        const token = await getAccessToken();
        setDriveConnected(!!token);
      } else {
        setDriveConnected(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // 3. Real-Time Subscriptions to Firestore
  useEffect(() => {
    setSyncStatus('syncing');

    const unsubTrx = subscribeToTransactions((data) => {
      setTransactions(data);
      setSyncStatus('synced');
    });

    const unsubUnits = subscribeToBusinessUnits((data) => {
      if (data.length > 0) setUnits(data);
    });

    const unsubAccounts = subscribeToAccounts((data) => {
      if (data.length > 0) setAccounts(data);
    });

    const unsubPartners = subscribeToPartners((data) => {
      setPartners(data);
    });

    const unsubCats = subscribeToExpenseCategories((data) => {
      if (data.length > 0) setExpenseCategories(data);
    });

    const unsubProds = subscribeToProducts((data) => {
      setProducts(data);
    });

    const unsubDocs = subscribeToDocuments((data) => {
      setDocuments(data);
    });

    const unsubLogs = subscribeToAuditLogs((data) => {
      setAuditLogs(data);
    });

    const unsubCompany = subscribeToCompanyProfile((data) => {
      setCompanyProfile(data);
    });

    return () => {
      unsubTrx();
      unsubUnits();
      unsubAccounts();
      unsubPartners();
      unsubCats();
      unsubProds();
      unsubDocs();
      unsubLogs();
      unsubCompany();
    };
  }, []);

  // Handle Google Drive Connection via OAuth Popup
  const handleConnectDrive = async () => {
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        setCachedAccessToken(res.accessToken);
        setDriveConnected(true);
        showToast('Google Drive berhasil terhubung! File nota & backup akan tersimpan di Drive.', 'success');
      }
    } catch (e: any) {
      console.error('Failed to connect Google Drive:', e);
      showToast('Gagal menghubungkan Google Drive. Pastikan popup diizinkan.', 'error');
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setUserProfile((prev) => ({
      ...prev,
      role,
    }));
  };

  const handleOpenQuickActionItem = (type: TransactionType | 'UPLOAD_DOC') => {
    if (type === 'UPLOAD_DOC') {
      setIsUploadDocOpen(true);
    } else {
      setQuickInputType(type);
      setIsQuickInputOpen(true);
    }
  };

  // Outstanding receivables count for badge
  const pendingReceivablesCount = transactions.filter(
    (t) => t.status === 'ACTIVE' && t.type === 'SALE' && t.paymentMethod === 'CREDIT'
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header Navbar */}
      <Navbar
        units={units}
        selectedUnitId={selectedUnitId}
        onSelectUnit={setSelectedUnitId}
        syncStatus={syncStatus}
        currentUser={currentUser}
        userProfile={userProfile}
        onChangeRole={handleRoleChange}
        driveConnected={driveConnected}
        onConnectDrive={handleConnectDrive}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        {activeTab === 'dashboard' && (
          <DashboardView
            transactions={transactions}
            accounts={accounts}
            units={units}
            partners={partners}
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
            companyProfile={companyProfile}
            userEmail={userProfile.email}
            userRole={userProfile.role}
            onOpenReceipt={(trx) => setReceiptTrx(trx)}
            onOpenInvoice={(trx) => setInvoiceTrx(trx)}
            onQuickAction={(type) => {
              if (type) {
                setQuickInputType(type);
                setIsQuickInputOpen(true);
              } else {
                setIsQuickActionOpen(true);
              }
            }}
          />
        )}

        {activeTab === 'input' && (
          <QuickInputView
            units={units}
            partners={partners}
            accounts={accounts}
            expenseCategories={expenseCategories}
            products={products}
            existingTransactionsCount={transactions.length}
            userProfile={userProfile}
            currentEmail={userProfile.email}
            driveConnected={driveConnected}
            onOpenReceipt={(trx) => setReceiptTrx(trx)}
          />
        )}

        {activeTab === 'billing' && (
          <BillingView
            transactions={transactions}
            accounts={accounts}
            partners={partners}
            companyProfile={companyProfile}
            userProfile={userProfile}
            currentEmail={userProfile.email}
            onOpenReceipt={(trx) => setReceiptTrx(trx)}
            transactionsCount={transactions.length}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            transactions={transactions}
            accounts={accounts}
            units={units}
            selectedUnitId={selectedUnitId}
            companyProfile={companyProfile}
          />
        )}

        {activeTab === 'menu' && (
          <MenuView
            partners={partners}
            products={products}
            units={units}
            accounts={accounts}
            expenseCategories={expenseCategories}
            documents={documents}
            auditLogs={auditLogs}
            transactions={transactions}
            companyProfile={companyProfile}
            userProfile={userProfile}
            onChangeRole={handleRoleChange}
            driveConnected={driveConnected}
            onConnectDrive={handleConnectDrive}
            userEmail={userProfile.email}
          />
        )}
      </main>

      {/* Floating Action Pop-up Modal */}
      <QuickActionModal
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
        onSelectAction={handleOpenQuickActionItem}
      />

      {/* Quick Input Transaction Modal */}
      {isQuickInputOpen && (
        <QuickInputModal
          isOpen={isQuickInputOpen}
          onClose={() => setIsQuickInputOpen(false)}
          defaultType={quickInputType || 'SALE'}
          units={units}
          partners={partners}
          accounts={accounts}
          expenseCategories={expenseCategories}
          products={products}
          existingTransactionsCount={transactions.length}
          userProfile={userProfile}
          currentEmail={userProfile.email}
          driveConnected={driveConnected}
          onSuccess={(trxId) => {
            const found = transactions.find((t) => t.id === trxId);
            if (found) {
              if (found.type === 'SALE') {
                setInvoiceTrx(found);
              } else {
                setReceiptTrx(found);
              }
            }
          }}
        />
      )}

      {/* Official Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptTrx}
        onClose={() => setReceiptTrx(null)}
        transaction={receiptTrx}
        companyProfile={companyProfile}
        partners={partners}
      />

      {/* Official Sales Invoice (Faktur Penjualan) Modal */}
      <InvoiceModal
        isOpen={!!invoiceTrx}
        onClose={() => setInvoiceTrx(null)}
        transaction={invoiceTrx}
        companyProfile={companyProfile}
        partners={partners}
      />

      {/* Upload Document Modal */}
      <DocumentUploadModal
        isOpen={isUploadDocOpen}
        onClose={() => setIsUploadDocOpen(false)}
        driveConnected={driveConnected}
        userEmail={userProfile.email}
        onSuccess={() => setIsUploadDocOpen(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md animate-fade-in bg-slate-900 border-slate-700 text-white">
          <span
            className={`w-2 h-2 rounded-full ${
              toastMessage.type === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
            }`}
          />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 5-Menu Mobile Bottom Navigation with center (+) button */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenQuickAction={() => setIsQuickActionOpen(true)}
        receivablesCount={pendingReceivablesCount}
        userRole={userProfile.role}
      />
    </div>
  );
}
