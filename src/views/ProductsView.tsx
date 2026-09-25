import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Wrench,
  Boxes,
  Check,
  X,
  Edit2
} from 'lucide-react';
import { ProductItem, BusinessUnit } from '../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';
import { formatRupiah } from '../engines/reportEngine';

interface ProductsViewProps {
  products: ProductItem[];
  units: BusinessUnit[];
  userEmail: string;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  units,
  userEmail,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterUnit, setFilterUnit] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'BARANG' | 'JASA'>('BARANG');
  const [unitId, setUnitId] = useState<string>('');
  const [defaultPrice, setDefaultPrice] = useState<number>(0);
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>('Pcs');
  const [stock, setStock] = useState<number>(0);
  const [productError, setProductError] = useState<string | null>(null);

  // Units load asynchronously from Firestore; never use a fabricated fallback unit.
  useEffect(() => {
    if (units.length > 0 && !unitId) {
      setUnitId(units[0].id);
    }
  }, [units, unitId]);

  const unitMap: Record<string, string> = {};
  units.forEach((u) => {
    unitMap[u.id] = u.name;
  });

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || p.type === filterType;
    const matchesUnit = filterUnit === 'ALL' || p.unitId === filterUnit;
    return matchesSearch && matchesType && matchesUnit;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!unitId) {
      setProductError('Unit Usaha wajib dipilih.');
      return;
    }
    setProductError(null);

    try {
      const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newProd: ProductItem = {
        id,
        name: name.trim(),
        type,
        unitId,
        defaultPrice: Number(defaultPrice) || 0,
        unitOfMeasure: unitOfMeasure.trim() || 'Unit',
        ...(type === 'BARANG' ? { stock: Number(stock) || 0 } : {}),
        isActive: true,
      };

      await setDoc(doc(db, 'products', id), cleanFirestoreData(newProd));
      setName('');
      setDefaultPrice(0);
      setStock(0);
      setIsAddModalOpen(false);
    } catch (err: any) {
      setProductError(err.message || 'Gagal menyimpan barang/jasa');
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">Master Barang & Jasa</h1>
          <p className="text-xs text-slate-400">
            Katalog suku cadang bengkel, material bangunan, dan jasa proyek
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tambah Barang/Jasa</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama barang atau jasa..."
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
          <option value="ALL">Semua Jenis</option>
          <option value="BARANG">Barang / Material</option>
          <option value="JASA">Jasa / Servis</option>
        </select>

        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-amber-400"
        >
          <option value="ALL">Semua Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-xs font-semibold text-slate-400">Belum ada barang atau jasa terdaftar</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Klik tombol "Tambah Barang/Jasa" untuk mengisi katalog unit usaha Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`p-1 rounded ${
                      p.type === 'BARANG'
                        ? 'bg-amber-950 text-amber-400'
                        : 'bg-blue-950 text-blue-400'
                    }`}
                  >
                    {p.type === 'BARANG' ? <Boxes className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {unitMap[p.unitId] || p.unitId}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white leading-snug">{p.name}</h3>

                <div className="text-xs font-black text-emerald-400 pt-1">
                  {formatRupiah(p.defaultPrice)} / {p.unitOfMeasure}
                </div>

                {p.type === 'BARANG' && p.stock !== undefined && (
                  <div className="text-[11px] text-slate-400">
                    Stok: <span className="font-bold text-slate-200">{p.stock} {p.unitOfMeasure}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <h2 className="text-sm font-bold text-white">Tambah Barang / Jasa</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Barang atau Jasa
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Semen Gresik 40kg, Jasa Ganti Oli, Pasang Plafon..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Jenis
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="BARANG">Barang Fisik</option>
                    <option value="JASA">Jasa / Servis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Unit Usaha
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="">Pilih Unit Usaha</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Harga Default (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={defaultPrice || ''}
                    onChange={(e) => setDefaultPrice(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Satuan Ukur
                  </label>
                  <input
                    type="text"
                    placeholder="Pcs, Sak, Meter, Jam, Hari..."
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              </div>

              {type === 'BARANG' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock || ''}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              )}

              {productError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {productError}
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
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
