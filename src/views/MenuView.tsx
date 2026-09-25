import React, { useState } from 'react';
import {
  Users,
  Package,
  HardDrive,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
  Camera,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import {
  Partner,
  ProductItem,
  BusinessUnit,
  Account,
  ExpenseCategory,
  DocumentItem,
  AuditLog,
  CompanyProfile,
  UserProfile,
  Transaction,
  UserRole
} from '../types';
import { PartnersView } from './PartnersView';
import { ProductsView } from './ProductsView';
import { DocumentsView } from './DocumentsView';
import { BackupRestoreView } from './BackupRestoreView';
import { ImportExportView } from './ImportExportView';
import { AuditTrailView } from './AuditTrailView';
import { SettingsView } from './SettingsView';

interface MenuViewProps {
  partners: Partner[];
  products: ProductItem[];
  units: BusinessUnit[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  documents: DocumentItem[];
  auditLogs: AuditLog[];
  transactions: Transaction[];
  companyProfile: CompanyProfile;
  userProfile: UserProfile;
  onChangeRole: (role: UserRole) => void;
  driveConnected: boolean;
  onConnectDrive: () => Promise<void>;
  userEmail: string;
}

export type MenuSection =
  | 'OVERVIEW'
  | 'PARTNERS'
  | 'PRODUCTS'
  | 'DOCUMENTS'
  | 'BACKUP'
  | 'IMPORT'
  | 'AUDIT'
  | 'SETTINGS';

export const MenuView: React.FC<MenuViewProps> = ({
  partners,
  products,
  units,
  accounts,
  expenseCategories,
  documents,
  auditLogs,
  transactions,
  companyProfile,
  userProfile,
  onChangeRole,
  driveConnected,
  onConnectDrive,
  userEmail,
}) => {
  const [currentSection, setCurrentSection] = useState<MenuSection>('OVERVIEW');

  const allMenuItems = [
    {
      id: 'PARTNERS',
      title: 'Buku Mitra & Rekanan',
      desc: `${partners.length} Pelanggan, Supplier, Toko Material`,
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      allowedRoles: ['OWNER', 'ADMIN', 'AKUNTAN', 'SALES', 'KASIR'],
    },
    {
      id: 'PRODUCTS',
      title: 'Master Barang & Jasa',
      desc: `${products.length} Item katalog suku cadang & servis`,
      icon: Package,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      allowedRoles: ['OWNER', 'ADMIN', 'SALES', 'OPERATOR'],
    },
    {
      id: 'DOCUMENTS',
      title: 'Dokumen & Galeri Nota',
      desc: `${documents.length} Nota fisik & berkas Google Drive`,
      icon: Camera,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      allowedRoles: ['OWNER', 'ADMIN', 'AKUNTAN', 'KASIR', 'SALES', 'OPERATOR'],
    },
    {
      id: 'BACKUP',
      title: 'Backup & Restore',
      desc: 'Arsip JSON, Excel & sinkronisasi Google Drive',
      icon: HardDrive,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      allowedRoles: ['OWNER', 'ADMIN', 'AKUNTAN'],
    },
    {
      id: 'IMPORT',
      title: 'Import Data Excel / CSV',
      desc: 'Upload multi-step dengan verifikasi baris valid',
      icon: FileSpreadsheet,
      color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      allowedRoles: ['OWNER', 'ADMIN'],
    },
    {
      id: 'AUDIT',
      title: 'Jejak Audit (Audit Trail)',
      desc: `${auditLogs.length} Catatan mutasi & aktivitas sistem`,
      icon: ShieldCheck,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      allowedRoles: ['OWNER', 'ADMIN', 'AKUNTAN'],
    },
    {
      id: 'SETTINGS',
      title: 'Pengaturan & Profil PT',
      desc: 'Unit usaha, rekening kas/bank, profil kwitansi',
      icon: Settings,
      color: 'text-slate-300 bg-slate-800 border-slate-700',
      allowedRoles: ['OWNER', 'ADMIN'],
    },
  ];

  const menuItems = allMenuItems.filter((item) =>
    item.allowedRoles.includes(userProfile.role)
  );

  if (currentSection === 'PARTNERS') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <PartnersView partners={partners} transactions={transactions} userEmail={userEmail} />
      </div>
    );
  }

  if (currentSection === 'PRODUCTS') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <ProductsView products={products} units={units} userEmail={userEmail} />
      </div>
    );
  }

  if (currentSection === 'DOCUMENTS') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <DocumentsView
          documents={documents}
          driveConnected={driveConnected}
          onConnectDrive={onConnectDrive}
          userEmail={userEmail}
        />
      </div>
    );
  }

  if (currentSection === 'BACKUP') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <BackupRestoreView
          driveConnected={driveConnected}
          onConnectDrive={onConnectDrive}
          userEmail={userEmail}
        />
      </div>
    );
  }

  if (currentSection === 'IMPORT') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <ImportExportView
          userEmail={userEmail}
          transactionsCount={transactions.length}
          units={units}
          accounts={accounts}
        />
      </div>
    );
  }

  if (currentSection === 'AUDIT') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <AuditTrailView logs={auditLogs} />
      </div>
    );
  }

  if (currentSection === 'SETTINGS') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCurrentSection('OVERVIEW')}
          className="flex items-center gap-1.5 text-xs text-amber-400 font-bold px-4 pt-2 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Menu Utama</span>
        </button>
        <SettingsView
          companyProfile={companyProfile}
          units={units}
          accounts={accounts}
          expenseCategories={expenseCategories}
          userProfile={userProfile}
          onChangeRole={onChangeRole}
          driveConnected={driveConnected}
          onConnectDrive={onConnectDrive}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Overview header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
          Navigasi Modul Administrasi
        </span>
        <h1 className="text-xl font-black text-white">Menu & Master Data</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Akses buku mitra, katalog barang, dokumen nota, backup, import, audit, dan pengaturan
        </p>
      </div>

      {/* Menu List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentSection(item.id as MenuSection)}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-xl border ${item.color} group-hover:scale-105 transition`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
