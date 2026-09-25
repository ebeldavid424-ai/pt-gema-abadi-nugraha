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
  connectGoogleDrive,
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
  subscribeToCompanyProfile,
  ensureUserProfile
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
    uid: '',
    email: '',
    displayName: '',
    role: 'OPERATOR',
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
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({
    name: 'PT. GEMA ABADI NUGRAHA',
    address: '',
    phone: '',
    email: '',
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
    // System configuration is initialized only after authentication succeeds.

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
      if (!user) {
        setCurrentUser(null);
        setUserProfile({ uid: '', email: '', displayName: '', role: 'OPERATOR' });
        setDriveConnected(false);
        setTransactions([]);
        setUnits([]);
        setAccounts([]);
        setPartners([]);
        setExpenseCategories([]);
        setProducts([]);
        setDocuments([]);
        setAuditLogs([]);
        setCompanyProfile({ name: 'PT. GEMA ABADI NUGRAHA', address: '', phone: '', email: '' });
        setSyncStatus('offline');
        return;
      }

      try {
        const profile = await ensureUserProfile(
          user.uid,
          user.email || '',
          user.displayName || user.email?.split('@')[0] || 'Pengguna'
        );
        setUserProfile(profile);

        // Create required master configuration only after the authenticated profile exists.
        await initializeSystemConfiguration();

        const token = await getAccessToken();
        setDriveConnected(!!token);
        setCurrentUser(user);
      } catch (error: any) {
        console.error('Failed to initialize authenticated session:', error);
        showToast('Gagal memuat profil pengguna. Periksa konfigurasi Firebase.', 'error');
        setCurrentUser(user);
      }
    });

    return () => unsubAuth();
  }, []);

  // 3. Real-Time Subscriptions to Firestore
  useEffect(() => {
    if (!currentUser) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');

    const unsubTrx = subscribeToTransactions((data) => {
      setTransactions(data);
      setSyncStatus('synced');
    });

    const unsubUnits = subscribeToBusinessUnits((data) => {
      setUnits(data);
    });

    const unsubAccounts = subscribeToAccounts((data) => {
      setAccounts(data);
    });

    const unsubPartners = subscribeToPartners((data) => {
      setPartners(data);
    });

    const unsubCats = subscribeToExpenseCategories((data) => {
      setExpenseCategories(data);
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
  }, [currentUser]);

  // Handle Google Drive Connection via OAuth Popup
  const handleConnectDrive = async () => {
    try {
      const res = await connectGoogleDrive();
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
        companyProfile={companyProfile}
        selectedUnitId={selectedUnitId}
        onSelectUnit={setSelectedUnitId}
        syncStatus={syncStatus}
        currentUser={currentUser}
        userProfile={userProfile}
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
        accounts={accounts}
      />

      {/* Official Sales Invoice (Faktur Penjualan) Modal */}
      <InvoiceModal
        isOpen={!!invoiceTrx}
        onClose={() => setInvoiceTrx(null)}
        transaction={invoiceTrx}
        companyProfile={companyProfile}
        partners={partners}
        accounts={accounts}
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
