import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  X,
  Building2,
  UserRound,
  Landmark,
  BadgeInfo,
} from 'lucide-react';
import { Partner, Transaction, EntityType, RelationType } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';
import { formatRupiah } from '../engines/reportEngine';
import { calculateReceivables, calculatePayables } from '../engines/financialEngine';

interface PartnersViewProps {
  partners: Partner[];
  transactions: Transaction[];
  userEmail: string;
}

const RELATION_OPTIONS: { value: RelationType; label: string }[] = [
  { value: 'PELANGGAN', label: 'Pelanggan' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'KONTRAKTOR', label: 'Kontraktor' },
  { value: 'MITRA', label: 'Mitra Usaha' },
  { value: 'KARYAWAN', label: 'Karyawan' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'PERUSAHAAN', label: 'Perusahaan' },
  { value: 'PERORANGAN', label: 'Perorangan' },
  { value: 'ORGANISASI', label: 'Organisasi' },
];

function getPartnerRelations(partner: Partner): RelationType[] {
  if (Array.isArray(partner.relations) && partner.relations.length > 0) {
    return partner.relations;
  }

  // Compatibility for partner records created with the old single "type" field.
  const legacy = partner.type;
  if (!legacy) return [];
  const mapped: Record<string, RelationType> = {
    PELANGGAN: 'PELANGGAN',
    SUPPLIER: 'SUPPLIER',
    KONTRAKTOR: 'KONTRAKTOR',
    KARYAWAN: 'KARYAWAN',
    MITRA: 'MITRA',
    LAINNYA: 'LAINNYA',
    TOKO_MATERIAL: 'MITRA',
    BENGKEL: 'MITRA',
  };
  return mapped[legacy] ? [mapped[legacy]] : [];
}

function getEntityLabel(partner: Partner): string {
  return ENTITY_OPTIONS.find((item) => item.value === partner.entityType)?.label || 'Entitas Lama';
}

function getRelationLabels(partner: Partner): string[] {
  return getPartnerRelations(partner).map(
    (relation) => RELATION_OPTIONS.find((item) => item.value === relation)?.label || relation
  );
}

export const PartnersView: React.FC<PartnersViewProps> = ({
  partners,
  transactions,
  userEmail,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRelation, setFilterRelation] = useState<'ALL' | RelationType>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [entityType, setEntityType] = useState<EntityType>('PERUSAHAAN');
  const [name, setName] = useState('');
  const [picName, setPicName] = useState('');
  const [picTitle, setPicTitle] = useState('');
  const [npwp, setNpwp] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [relations, setRelations] = useState<RelationType[]>([]);
  const [notes, setNotes] = useState('');
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeTrx = transactions.filter((t) => t.status === 'ACTIVE');
  const receivables = calculateReceivables(activeTrx);
  const payables = calculatePayables(activeTrx);

  const filteredPartners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return partners.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        (p.picName || '').toLowerCase().includes(q);

      const matchesRelation =
        filterRelation === 'ALL' || getPartnerRelations(p).includes(filterRelation);

      return matchesSearch && matchesRelation;
    });
  }, [partners, searchQuery, filterRelation]);

  const resetForm = () => {
    setEntityType('PERUSAHAAN');
    setName('');
    setPicName('');
    setPicTitle('');
    setNpwp('');
    setPhone('');
    setEmail('');
    setAddress('');
    setRelations([]);
    setNotes('');
    setPartnerError(null);
    setIsSaving(false);
  };

  const handleRelationChange = (relation: RelationType) => {
    setRelations((prev) =>
      prev.includes(relation)
        ? prev.filter((item) => item !== relation)
        : [...prev, relation]
    );
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerError(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setPartnerError('Nama perusahaan / mitra wajib diisi.');
      return;
    }
    if (!cleanPhone) {
      setPartnerError('Nomor telepon / WhatsApp wajib diisi.');
      return;
    }
    if (relations.length === 0) {
      setPartnerError('Pilih minimal satu jenis hubungan bisnis.');
      return;
    }
    if (!userEmail?.trim()) {
      setPartnerError('Identitas pengguna belum tersedia. Silakan masuk Google terlebih dahulu.');
      return;
    }

    try {
      setIsSaving(true);

      const id = `partner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newPartner: Partner = {
        id,
        entityType,
        name: cleanName,
        ...(entityType === 'PERUSAHAAN' && picName.trim() ? { picName: picName.trim() } : {}),
        ...(entityType === 'PERUSAHAAN' && picTitle.trim() ? { picTitle: picTitle.trim() } : {}),
        ...(entityType === 'PERUSAHAAN' && npwp.trim() ? { npwp: npwp.trim() } : {}),
        phone: cleanPhone,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        relations,
        status: 'AKTIF',
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        createdAt: new Date().toISOString(),
      };

      // Keep partner master separate from internal businessUnits.
      await setDoc(doc(db, 'partners', id), cleanFirestoreData(newPartner));

      resetForm();
      setIsAddModalOpen(false);
    } catch (err: any) {
      setPartnerError(err.message || 'Gagal menambahkan mitra.');
      setIsSaving(false);
    }
  };

  const getPartnerStats = (pName: string) => {
    const pReceivables = receivables.filter(
      (r) => r.partyName.toLowerCase() === pName.toLowerCase()
    );
    const pPayables = payables.filter(
      (p) => p.partyName.toLowerCase() === pName.toLowerCase()
    );

    return {
      sisaPiutang: pReceivables.reduce((sum, item) => sum + item.remainingAmount, 0),
      sisaHutang: pPayables.reduce((sum, item) => sum + item.remainingAmount, 0),
    };
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">Buku Mitra & Pihak Eksternal</h1>
          <p className="text-xs text-slate-400">
            Perusahaan, perorangan, organisasi, pelanggan, supplier, kontraktor, dan mitra.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tambah Mitra</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, PIC, telepon, email, atau alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-hidden"
          />
        </div>

        <select
          value={filterRelation}
          onChange={(e) => setFilterRelation(e.target.value as 'ALL' | RelationType)}
          className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-amber-400"
        >
          <option value="ALL">Semua Hubungan</option>
          {RELATION_OPTIONS.map((relation) => (
            <option key={relation.value} value={relation.value}>
              {relation.label}
            </option>
          ))}
        </select>
      </div>

      {filteredPartners.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-xs font-semibold text-slate-400">Belum ada mitra terdaftar</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Tambahkan perusahaan, perorangan, atau organisasi dari tombol "Tambah Mitra".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPartners.map((p) => {
            const { sisaPiutang, sisaHutang } = getPartnerStats(p.name);
            const relationLabels = getRelationLabels(p);

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPartner(p)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white leading-tight truncate">{p.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-sky-400">
                        {p.entityType === 'PERUSAHAAN' ? <Building2 className="w-3 h-3" /> : p.entityType === 'PERORANGAN' ? <UserRound className="w-3 h-3" /> : <Landmark className="w-3 h-3" />}
                        {getEntityLabel(p)}
                      </span>
                      {relationLabels.map((label) => (
                        <span key={label} className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'AKTIF' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>

                {p.picName && (
                  <div className="text-xs text-slate-400">
                    PIC: <span className="text-slate-200 font-semibold">{p.picName}</span>
                    {p.picTitle ? ` • ${p.picTitle}` : ''}
                  </div>
                )}

                <div className="space-y-1 text-xs text-slate-400">
                  {p.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{p.phone}</span>
                    </div>
                  )}
                  {p.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span className="truncate">{p.email}</span>
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
                    <div className="text-[10px] text-slate-500">Piutang</div>
                    <div className={`font-bold ${sisaPiutang > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                      {formatRupiah(sisaPiutang)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Hutang</div>
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

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div>
                <h2 className="text-sm font-bold text-white">Tambah Mitra / Entitas Eksternal</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tidak membuat Unit Usaha baru. Data ini hanya untuk pihak eksternal.
                </p>
              </div>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Jenis Entitas</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as EntityType)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                >
                  {ENTITY_OPTIONS.map((entity) => (
                    <option key={entity.value} value={entity.value}>{entity.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama {entityType === 'PERUSAHAAN' ? 'Perusahaan' : entityType === 'PERORANGAN' ? 'Mitra / Perorangan' : 'Organisasi'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="PT. ABC / CV. Makmur / Budi / Organisasi XYZ"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {entityType === 'PERUSAHAAN' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nama PIC</label>
                    <input
                      type="text"
                      value={picName}
                      onChange={(e) => setPicName(e.target.value)}
                      placeholder="Budi"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Jabatan PIC</label>
                    <input
                      type="text"
                      value={picTitle}
                      onChange={(e) => setPicTitle(e.target.value)}
                      placeholder="Manager / Direktur"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                </div>
              )}

              {entityType === 'PERUSAHAAN' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">NPWP</label>
                  <input
                    type="text"
                    value={npwp}
                    onChange={(e) => setNpwp(e.target.value)}
                    placeholder="NPWP (opsional)"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="0812-..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@perusahaan.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Alamat Lengkap</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Alamat kantor / rumah / alamat organisasi"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Jenis Hubungan Bisnis</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RELATION_OPTIONS.map((relation) => {
                    const checked = relations.includes(relation.value);
                    return (
                      <label
                        key={relation.value}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                          checked
                            ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleRelationChange(relation.value)}
                          className="accent-amber-500"
                        />
                        <span className="text-xs font-semibold">{relation.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Catatan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Termin, rekening, catatan kerja sama, dll."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              {partnerError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <BadgeInfo className="w-4 h-4 shrink-0" />
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
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan Mitra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate">{selectedPartner.name}</h2>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-xs text-sky-400 font-semibold">{getEntityLabel(selectedPartner)}</span>
                  {getRelationLabels(selectedPartner).map((label) => (
                    <span key={label} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">
                      {label}
                    </span>
                  ))}
                </div>
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
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-1.5">
                {selectedPartner.picName && (
                  <div>PIC: <span className="text-slate-200 font-semibold">{selectedPartner.picName}</span>{selectedPartner.picTitle ? ` • ${selectedPartner.picTitle}` : ''}</div>
                )}
                {selectedPartner.npwp && (
                  <div>NPWP: <span className="text-slate-200 font-semibold">{selectedPartner.npwp}</span></div>
                )}
                <div>Telp: <span className="text-slate-200 font-semibold">{selectedPartner.phone || '-'}</span></div>
                <div>Email: <span className="text-slate-200">{selectedPartner.email || '-'}</span></div>
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
