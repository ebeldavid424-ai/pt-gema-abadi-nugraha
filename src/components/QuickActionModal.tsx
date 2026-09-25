import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  ShoppingBag,
  CreditCard,
  Building,
  ArrowLeftRight,
  Camera,
  X
} from 'lucide-react';
import { TransactionType } from '../types';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (type: TransactionType | 'UPLOAD_DOC') => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  if (!isOpen) return null;

  const actions = [
    {
      id: 'SALE',
      label: '+ Penjualan',
      desc: 'Catat omzet penjualan tunai atau bon (piutang)',
      icon: ShoppingCart,
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
      iconBg: 'bg-emerald-500 text-slate-950',
    },
    {
      id: 'PURCHASE',
      label: '+ Pembelian',
      desc: 'Pembelian barang/material tunai atau bon supplier (hutang)',
      icon: ShoppingBag,
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20',
      iconBg: 'bg-rose-500 text-slate-950',
    },
    {
      id: 'EXPENSE',
      label: '+ Uang Keluar (Beban)',
      desc: 'Biaya operasional: gaji, bensin, listrik, servis, proyek',
      icon: ArrowUpRight,
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
      iconBg: 'bg-amber-500 text-slate-950',
    },
    {
      id: 'INCOME',
      label: '+ Uang Masuk',
      desc: 'Penerimaan modal, setoran, atau pendapatan lainnya',
      icon: ArrowDownLeft,
      color: 'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20',
      iconBg: 'bg-teal-500 text-slate-950',
    },
    {
      id: 'RECEIVABLE_PAYMENT',
      label: '+ Bayar Piutang',
      desc: 'Pelunasan bon dari pelanggan (tidak mendobelkan omzet)',
      icon: CreditCard,
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
      iconBg: 'bg-blue-500 text-white',
    },
    {
      id: 'DEBT_PAYMENT',
      label: '+ Bayar Hutang',
      desc: 'Pembayaran bon supplier (tidak mendobelkan pengeluaran)',
      icon: Building,
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
      iconBg: 'bg-purple-500 text-white',
    },
    {
      id: 'TRANSFER',
      label: '+ Transfer Kas/Bank',
      desc: 'Pindah saldo antar Kas Tunai, Bank BCA, Mandiri, dll.',
      icon: ArrowLeftRight,
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20',
      iconBg: 'bg-indigo-500 text-white',
    },
    {
      id: 'UPLOAD_DOC',
      label: '+ Upload Nota/Kwitansi',
      desc: 'Foto nota atau upload dokumen transaksi ke Google Drive',
      icon: Camera,
      color: 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20',
      iconBg: 'bg-sky-500 text-slate-950',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Catat Transaksi Cepat</h2>
            <p className="text-xs text-slate-400">Pilih jenis aktivitas keuangan yang ingin dicatat</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Grid */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  onSelectAction(act.id as any);
                  onClose();
                }}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${act.color}`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${act.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100">{act.label}</div>
                  <div className="text-[11px] text-slate-400 leading-snug mt-0.5">{act.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
