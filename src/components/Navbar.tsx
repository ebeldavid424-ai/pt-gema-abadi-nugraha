import React, { useState } from 'react';
import {
  Building2,
  WifiOff,
  RefreshCw,
  User as UserIcon,
  HardDrive,
  LogOut,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { BusinessUnit, UserProfile, CompanyProfile } from '../types';
import { googleSignIn, logout } from '../firebase';

interface NavbarProps {
  units: BusinessUnit[];
  companyProfile: CompanyProfile;
  selectedUnitId: string;
  onSelectUnit: (unitId: string) => void;
  syncStatus: 'synced' | 'syncing' | 'offline';
  currentUser: any;
  userProfile: UserProfile;
  driveConnected: boolean;
  onConnectDrive: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  units,
  companyProfile,
  selectedUnitId,
  onSelectUnit,
  syncStatus,
  currentUser,
  userProfile,
  driveConnected,
  onConnectDrive,
}) => {
  const [showUnitMenu, setShowUnitMenu] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const activeUnits = units.filter((u) => u.isActive);

  const currentUnitName =
    selectedUnitId === 'all'
      ? 'Semua Unit Usaha'
      : activeUnits.find((u) => u.id === selectedUnitId)?.name || 'Pilih Unit Usaha';

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await googleSignIn();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Company Brand & Unit Selector */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-inner">
            G
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
                {companyProfile.name || 'Perusahaan Belum Diatur'}
              </h1>
              {/* Sync Status Badge */}
              {syncStatus === 'synced' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Tersinkron
                </span>
              )}
              {syncStatus === 'syncing' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-950/80 text-blue-400 border border-blue-700/50">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                  Menyinkronkan...
                </span>
              )}
              {syncStatus === 'offline' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-700/50">
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  Offline
                </span>
              )}
            </div>

            {/* Quick Unit Selector */}
            <div className="relative mt-0.5">
              <button
                type="button"
                onClick={() => setShowUnitMenu(!showUnitMenu)}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium transition py-0.5"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentUnitName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showUnitMenu && (
                <div
                  className="absolute left-0 mt-1 w-56 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-50 text-sm"
                  onMouseLeave={() => setShowUnitMenu(false)}
                >
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    Pilih Unit Usaha
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectUnit('all');
                      setShowUnitMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-700 transition ${
                      selectedUnitId === 'all' ? 'text-amber-400 font-semibold bg-slate-700/50' : 'text-slate-200'
                    }`}
                  >
                    <span>Semua Unit Usaha</span>
                    <span className="text-xs text-slate-400">Konsolidasi</span>
                  </button>
                  {activeUnits.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSelectUnit(u.id);
                        setShowUnitMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-700 transition ${
                        selectedUnitId === u.id ? 'text-amber-400 font-semibold bg-slate-700/50' : 'text-slate-200'
                      }`}
                    >
                      <span>{u.name}</span>
                      <span className="text-xs text-slate-400 uppercase">{u.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions: Google Drive & Role & Profile */}
        <div className="flex items-center gap-2">
          {/* Google Drive Status Button */}
          {driveConnected ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-medium">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Drive Terhubung</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onConnectDrive}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
              title="Hubungkan Google Drive untuk simpan nota & backup gratis"
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>Hubungkan Drive</span>
            </button>
          )}

          {/* Current Role — read-only; authority comes from Firebase user profile */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-amber-300" title="Role ditentukan oleh profil pengguna di server">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{userProfile.role}</span>
          </div>

          {/* User Sign In / Profile */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-1">
              <div
                className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 uppercase overflow-hidden"
                title={currentUser.email || currentUser.displayName}
              >
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  (currentUser.displayName?.[0] || currentUser.email?.[0] || 'U')
                )}
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                title="Keluar / Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>{isSigningIn ? 'Masuk...' : 'Masuk Google'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
