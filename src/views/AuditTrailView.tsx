import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  Activity,
  FileText
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditTrailViewProps {
  logs: AuditLog[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.performedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.entityId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow">
        <h1 className="text-lg font-black text-white">Jejak Audit Sistem (Audit Trail)</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Catatan kronologis permanen seluruh aktivitas transaksi, pembatalan, dan perubahan master
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari aktivitas, pelaku, atau nomor transaksi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-hidden"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Activity className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-400">Belum ada catatan log aktivitas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes('VOID') || log.action.includes('DELETE')
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : log.action.includes('RESTORE')
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">{log.entity}</span>
                  </div>

                  <p className="text-white font-medium">{log.details}</p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-amber-400" />
                      <span>{log.performedBy}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
