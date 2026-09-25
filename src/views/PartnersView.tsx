import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Check,
  X,
  CreditCard,
  Building,
  ArrowRight
} from 'lucide-react';
import { Partner, Transaction } from '../types';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';
import { formatRupiah } from '../engines/reportEngine';
import { calculateReceivables, calculatePayables } from '../engines/financialEngine';

interface PartnersViewProps {
  partners: Partner[];
  transactions: Transaction[];
  userEmail: string;
}

export const PartnersView: React.FC<PartnersViewProps> = ({
  partners,
  transactions,
  userEmail,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<Partner['type']>('PELANGGAN');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const activeTrx = transactions.filter((t) => t.status === 'ACTIVE');
  const receivables = calculateReceivables(activeTrx);
  const payables = calculatePayables(activeTrx);

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery)) ||
      (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'ALL' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setPartnerError(null);

    try {
      const id = `partner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newPartner: Partner = {
        id,
        name: name.trim(),
        type,
        ...(phone && phone.trim() ? { phone: phone.trim() } : {}),
        ...(address && address.trim() ? { address: address.trim() } : {}),
        status: 'AKTIF',
        ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'partners', id), cleanFirestoreData(newPartner));
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      setPartnerError(err.message || 'Gagal menambahkan mitra');
    }
  };

  // Calculate partner specific stats
  const getPartnerStats = (pName: string) => {
    const pReceivables = receivables.filter((r) => r.partyName.toLowerCase() === pName.toLowerCase());
    const pPayables = payables.filter((p) => p.partyName.toLowerCase() === pName.toLowerCase());
    const sisaPiutang = pReceivables.reduce((sum, r) => sum + r.remainingAmount, 0);
    const sisaHutang = pPayables.reduce((sum, p) => sum + p.remainingAmount, 0);
    return { sisaPiutang, sisaHutang };
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">Buku Mitra & Pihak Terkait</h1>
          <p className="text-xs text-slate-400">
            Pelanggan, Supplier, Toko Material, Kontraktor, dan Karyawan
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tambah Mitra</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama mitra, telepon, atau alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-hidden"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-amber-400"
        >
          <option value="ALL">Semua Jenis Mitra</option>
          <option value="PELANGGAN">Pelanggan</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="TOKO_MATERIAL">Toko Material</option>
          <option value="KONTRAKTOR">Kontraktor</option>
          <option value="BENGKEL">Bengkel Rekanan</option>
          <option value="KARYAWAN">Karyawan</option>
          <option value="MITRA">Mitra Usaha</option>
        </select>
      </div>

      {/* Partners Cards Grid */}
      {filteredPartners.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-xs font-semibold text-slate-400">Belum ada mitra terdaftar</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Klik tombol "Tambah Mitra" untuk mendaftarkan pelanggan, supplier, atau toko.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPartners.map((p) => {
            const { sisaPiutang, sisaHutang } = getPartnerStats(p.name);
            return (
              <div
                key={p.id}
                onClick={() => setSelectedPartner(p)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{p.name}</h3>
                    <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-slate-800 text-amber-400">
                      {p.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  {p.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{p.phone}</span>
                    </div>
                  )}
                  {p.address && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{p.address}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">Piutang Pelanggan</div>
                    <div className={`font-bold ${sisaPiutang > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                      {formatRupiah(sisaPiutang)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Hutang ke Mitra</div>
                    <div className={`font-bold ${sisaHutang > 0 ? 'text-purple-400' : 'text-slate-400'}`}>
                      {formatRupiah(sisaHutang)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Partner Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h2 className="text-sm font-bold text-white">Tambah Mitra Baru</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Mitra / Toko / Perorangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Toko Material Makmur, CV Mandiri..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Jenis Mitra
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                >
                  <option value="PELANGGAN">Pelanggan</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="TOKO_MATERIAL">Toko Material</option>
                  <option value="KONTRAKTOR">Kontraktor</option>
                  <option value="BENGKEL">Bengkel Rekanan</option>
                  <option value="KARYAWAN">Karyawan / Mandor</option>
                  <option value="MITRA">Mitra Usaha Lain</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="0812-..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Jl. Raya..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  placeholder="Catatan rekening, termin, dll..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              {partnerError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {partnerError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
                >
                  Simpan Mitra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partner Detail Drawer Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h2 className="text-base font-bold text-white">{selectedPartner.name}</h2>
                <span className="text-xs text-amber-400 font-semibold">{selectedPartner.type}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1">
                <div>Telp: <span className="text-slate-200 font-semibold">{selectedPartner.phone || '-'}</span></div>
                <div>Alamat: <span className="text-slate-200">{selectedPartner.address || '-'}</span></div>
                <div>Catatan: <span className="text-slate-400">{selectedPartner.notes || '-'}</span></div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-white mb-2">Riwayat Transaksi Pihak Ini:</h3>
                {activeTrx.filter((t) => t.partyName.toLowerCase() === selectedPartner.name.toLowerCase()).length === 0 ? (
                  <p className="text-slate-500 italic">Belum ada riwayat transaksi</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {activeTrx
                      .filter((t) => t.partyName.toLowerCase() === selectedPartner.name.toLowerCase())
                      .map((t) => (
                        <div key={t.id} className="p-2 rounded bg-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-mono text-amber-300">{t.trxNumber} ({t.type})</div>
                            <div className="text-slate-400 text-[10px]">{t.date} • {t.itemName}</div>
                          </div>
                          <div className="font-bold text-white">{formatRupiah(t.totalAmount)}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
