import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  FileSpreadsheet,
  Menu,
  Plus
} from 'lucide-react';
import { UserRole } from '../types';

export type MainTab = 'dashboard' | 'input' | 'billing' | 'reports' | 'menu';

interface BottomNavProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  onOpenQuickAction: () => void;
  receivablesCount?: number;
  userRole?: UserRole;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenQuickAction,
  receivablesCount = 0,
  userRole = 'OWNER',
}) => {
  const isOperator = userRole === 'OPERATOR';
  const isSales = userRole === 'SALES';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-slate-800 text-slate-400 select-none pb-safe">
      <div className="max-w-md mx-auto px-3 h-16 flex items-center justify-between relative">
        {/* 1. Beranda */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition ${
            activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-tight">Beranda</span>
        </button>

        {/* 2. Input */}
        <button
          type="button"
          onClick={() => onSelectTab('input')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition ${
            activeTab === 'input' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <PlusCircle className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-tight">Input</span>
        </button>

        {/* Center Floating Action Button (+) */}
        <div className="relative -top-5 flex flex-col items-center justify-center px-1">
          <button
            type="button"
            onClick={onOpenQuickAction}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-transform"
            aria-label="Tambah Transaksi Cepat"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-bold text-amber-400 mt-1">Transaksi</span>
        </div>

        {/* 3. Tagihan (Piutang & Hutang) */}
        {!isOperator && (
          <button
            type="button"
            onClick={() => onSelectTab('billing')}
            className={`flex flex-col items-center justify-center flex-1 h-full relative transition ${
              activeTab === 'billing' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Receipt className="w-5 h-5 mb-1" />
              {receivablesCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
                  {receivablesCount > 9 ? '9+' : receivablesCount}
                </span>
              )}
            </div>
            <span className="text-[11px] leading-tight">Tagihan</span>
          </button>
        )}

        {/* 4. Laporan (Akuntan / Owner / Admin / Kasir) */}
        {!isOperator && !isSales && (
          <button
            type="button"
            onClick={() => onSelectTab('reports')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition ${
              activeTab === 'reports' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 mb-1" />
            <span className="text-[11px] leading-tight">Laporan</span>
          </button>
        )}

        {/* 5. Menu */}
        <button
          type="button"
          onClick={() => onSelectTab('menu')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition ${
            activeTab === 'menu' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[11px] leading-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
};
