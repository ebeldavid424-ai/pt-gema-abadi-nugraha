import React, { useState } from 'react';
import {
  Building2,
  Wallet,
  Tags,
  Shield,
  Save,
  Plus,
  Trash2,
  HardDrive,
  CheckCircle,
  FileText
} from 'lucide-react';
import {
  CompanyProfile,
  BusinessUnit,
  Account,
  ExpenseCategory,
  UserProfile,
  UserRole
} from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';

interface SettingsViewProps {
  companyProfile: CompanyProfile;
  units: BusinessUnit[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  userProfile: UserProfile;
  onChangeRole: (role: UserRole) => void;
  driveConnected: boolean;
  onConnectDrive: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  companyProfile,
  units,
  accounts,
  expenseCategories,
  userProfile,
  onChangeRole,
  driveConnected,
  onConnectDrive,
}) => {
  // Company Profile form
  const [name, setName] = useState(companyProfile.name);
  const [address, setAddress] = useState(companyProfile.address);
  const [phone, setPhone] = useState(companyProfile.phone);
  const [email, setEmail] = useState(companyProfile.email);
  const [taxId, setTaxId] = useState(companyProfile.taxId || '');
  const [receiptFooter, setReceiptFooter] = useState(companyProfile.receiptFooter || '');
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [companySaveStatus, setCompanySaveStatus] = useState<string | null>(null);

  // New Unit form
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');

  // New Account form
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<Account['type']>('BANK');
  const [newAccountNo, setNewAccountNo] = useState('');

  // New Expense Category
  const [newCategoryName, setNewCategoryName] = useState('');

  // Status & Error messages
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    try {
      setIsSavingCompany(true);
      const updated: CompanyProfile = {
        name,
        address,
        phone,
        email,
        taxId,
        receiptFooter,
      };
      await setDoc(doc(db, 'companyProfile', 'main'), cleanFirestoreData(updated));
      setCompanySaveStatus('Profil perusahaan berhasil diperbarui.');
      setTimeout(() => setCompanySaveStatus(null), 3000);
    } catch (err: any) {
      setSettingsError(err.message || 'Gagal menyimpan profil');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !newUnitCode.trim()) return;
    setSettingsError(null);

    try {
      const id = newUnitCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const unit: BusinessUnit = {
        id,
        name: newUnitName.trim(),
        code: newUnitCode.trim().toUpperCase(),
        description: newUnitDesc.trim() || `Unit Usaha ${newUnitName}`,
        isActive: true,
      };
      await setDoc(doc(db, 'businessUnits', id), cleanFirestoreData(unit));
      setNewUnitName('');
      setNewUnitCode('');
      setNewUnitDesc('');
    } catch (err: any) {
      setSettingsError(err.message || 'Gagal menambahkan unit usaha');
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    setSettingsError(null);

    try {
      const id = `acc_${Date.now()}`;
      const acc: Account = {
        id,
        name: newAccountName.trim(),
        type: newAccountType,
        ...(newAccountNo.trim() ? { accountNumber: newAccountNo.trim() } : {}),
        initialBalance: 0,
        isActive: true,
      };
      await setDoc(doc(db, 'accounts', id), cleanFirestoreData(acc));
      setNewAccountName('');
      setNewAccountNo('');
    } catch (err: any) {
      setSettingsError(err.message || 'Gagal menambahkan akun');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSettingsError(null);

    try {
      const id = `cat_${Date.now()}`;
      const cat: ExpenseCategory = {
        id,
        name: newCategoryName.trim(),
        isActive: true,
      };
      await setDoc(doc(db, 'expenseCategories', id), cleanFirestoreData(cat));
      setNewCategoryName('');
    } catch (err: any) {
      setSettingsError(err.message || 'Gagal menambahkan kategori');
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow">
        <h1 className="text-lg font-black text-white">Pengaturan Sistem & Master Konfigurasi</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Kelola profil PT, unit usaha, akun kas/bank, kategori beban, dan koneksi Google Drive
        </p>
      </div>

      {/* 1. Profil PT & Kop Kwitansi */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Profil Perusahaan & Kwitansi</h2>
        </div>

        {companySaveStatus && (
          <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{companySaveStatus}</span>
          </div>
        )}

        <form onSubmit={handleSaveCompany} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Nama Perusahaan Resmi</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">NPWP Perusahaan</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Alamat Kantor / Operasional</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Nomor Telepon</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Email Resmi</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Catatan Kaki Kwitansi / Nota</label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSavingCompany}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow"
            >
              {isSavingCompany ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Unit Usaha */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <Building2 className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Unit Usaha (Bengkel, Konstruksi, Toko/Material, dll)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {units.map((u) => (
            <div key={u.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">{u.name}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                  {u.code}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{u.description}</p>
            </div>
          ))}
        </div>

        {/* Form Tambah Unit Usaha */}
        <form onSubmit={handleAddUnit} className="pt-2 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-white">+ Tambah Unit Usaha Baru</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <input
              type="text"
              placeholder="Nama Unit (misal: Toko Alat Teknik)"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              required
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
            <input
              type="text"
              placeholder="Kode Singkatan (misal: TAT)"
              value={newUnitCode}
              onChange={(e) => setNewUnitCode(e.target.value)}
              required
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
            <input
              type="text"
              placeholder="Keterangan singkat"
              value={newUnitDesc}
              onChange={(e) => setNewUnitDesc(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-bold"
          >
            + Simpan Unit Usaha
          </button>
        </form>
      </div>

      {/* 3. Akun Kas & Bank */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <Wallet className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Akun Kas & Rekening Bank</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {accounts.map((a) => (
            <div key={a.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">{a.name}</span>
                <span className="text-[10px] text-amber-400">{a.type}</span>
              </div>
              <p className="text-slate-400 text-[11px]">No Rek: {a.accountNumber || '-'}</p>
            </div>
          ))}
        </div>

        {/* Form Tambah Akun */}
        <form onSubmit={handleAddAccount} className="pt-2 border-t border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-white">+ Tambah Akun Kas / Rekening Bank</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <input
              type="text"
              placeholder="Nama Akun (misal: Bank BNI Proyek)"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              required
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
            <select
              value={newAccountType}
              onChange={(e) => setNewAccountType(e.target.value as any)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            >
              <option value="BANK">Bank</option>
              <option value="CASH">Kas Tunai</option>
              <option value="E_WALLET">E-Wallet</option>
            </select>
            <input
              type="text"
              placeholder="Nomor Rekening"
              value={newAccountNo}
              onChange={(e) => setNewAccountNo(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 text-xs font-bold"
          >
            + Simpan Akun
          </button>
        </form>
      </div>

      {/* 4. Kategori Biaya Operasional */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <Tags className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">Kategori Pengeluaran & Biaya Operasional</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {expenseCategories.map((c) => (
            <span
              key={c.id}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
            >
              {c.name}
            </span>
          ))}
        </div>

        <form onSubmit={handleAddCategory} className="pt-2 border-t border-slate-800 flex items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Tambah kategori baru (misal: Biaya Perizinan)..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            required
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
          >
            + Tambah
          </button>
        </form>
      </div>
    </div>
  );
};
