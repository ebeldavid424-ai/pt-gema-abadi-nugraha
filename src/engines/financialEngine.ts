import { Transaction, Account, JournalEntry, LedgerAccount } from '../types';

export interface DateFilterRange {
  startDate?: string;
  endDate?: string;
}

export type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all';

export interface FinancialSummary {
  omzetHariIni: number;
  omzetBulanIni: number;
  totalOmzet: number;
  pendapatanLain: number;
  totalPendapatan: number;
  totalPengeluaran: number;
  labaRugiSementara: number;
  totalKasTersedia: number;
  totalPiutangBelumDibayar: number;
  totalHutangBelumDibayar: number;
  jumlahTransaksi: number;
  ringkasanUnit: {
    [unitId: string]: {
      name: string;
      omzet: number;
      pengeluaran: number;
      labaRugi: number;
      jumlahTrx: number;
    };
  };
}

export interface ReceivableItem {
  id: string;
  date: string;
  trxNumber: string;
  partyName: string;
  unitId: string;
  itemName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  status: 'BELUM_BAYAR' | 'SEBAGIAN' | 'LUNAS' | 'JATUH_TEMPO';
}

export interface PayableItem {
  id: string;
  date: string;
  trxNumber: string;
  partyName: string;
  unitId: string;
  itemName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  status: 'BELUM_BAYAR' | 'SEBAGIAN' | 'LUNAS' | 'JATUH_TEMPO';
}

/**
 * Filter transactions based on active status, unit, and period
 */
export function filterTransactions(
  transactions: Transaction[],
  unitId: string = 'all',
  period: PeriodFilter = 'all',
  customRange?: DateFilterRange
): Transaction[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Calculate start and end for week/month/year
  let startStr = '';
  let endStr = todayStr;

  if (period === 'today') {
    startStr = todayStr;
    endStr = todayStr;
  } else if (period === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    startStr = weekAgo.toISOString().split('T')[0];
  } else if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    startStr = monthStart.toISOString().split('T')[0];
  } else if (period === 'year') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    startStr = yearStart.toISOString().split('T')[0];
  } else if (period === 'custom' && customRange) {
    startStr = customRange.startDate || '';
    endStr = customRange.endDate || todayStr;
  }

  return transactions.filter((trx) => {
    // Only active (not cancelled / void)
    if (trx.status !== 'ACTIVE') return false;

    // Unit filter
    if (unitId !== 'all' && trx.unitId !== unitId) {
      return false;
    }

    // Date filter
    if (startStr && trx.date < startStr) return false;
    if (endStr && trx.date > endStr) return false;

    return true;
  });
}

/**
 * Single source of truth calculation engine for all financial metrics
 */
export function calculateFinancialSummary(
  allTransactions: Transaction[],
  accounts: Account[],
  selectedUnitId: string = 'all',
  period: PeriodFilter = 'all',
  customRange?: DateFilterRange,
  unitNamesMap: Record<string, string> = {}
): FinancialSummary {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const activeTrx = allTransactions.filter(t => t.status === 'ACTIVE');
  const filteredTrx = filterTransactions(activeTrx, selectedUnitId, period, customRange);

  // 1. Calculate Omzet (Sales revenue - both cash and credit bon)
  let omzetHariIni = 0;
  let omzetBulanIni = 0;
  let totalOmzet = 0;
  let pendapatanLain = 0;
  let totalPengeluaran = 0;

  // Track unit breakdown
  const ringkasanUnit: FinancialSummary['ringkasanUnit'] = {};

  filteredTrx.forEach((trx) => {
    const uId = trx.unitId || 'lainnya';
    if (!ringkasanUnit[uId]) {
      ringkasanUnit[uId] = {
        name: unitNamesMap[uId] || uId,
        omzet: 0,
        pengeluaran: 0,
        labaRugi: 0,
        jumlahTrx: 0,
      };
    }
    ringkasanUnit[uId].jumlahTrx += 1;

    if (trx.type === 'SALE') {
      totalOmzet += trx.totalAmount;
      ringkasanUnit[uId].omzet += trx.totalAmount;

      if (trx.date === todayStr) {
        omzetHariIni += trx.totalAmount;
      }
      if (trx.date >= thisMonthStart && trx.date <= todayStr) {
        omzetBulanIni += trx.totalAmount;
      }
    } else if (trx.type === 'INCOME') {
      pendapatanLain += trx.totalAmount;
      ringkasanUnit[uId].omzet += trx.totalAmount;
    } else if (trx.type === 'PURCHASE') {
      // Pembelian operasional / material (baik tunai maupun bon)
      totalPengeluaran += trx.totalAmount;
      ringkasanUnit[uId].pengeluaran += trx.totalAmount;
    } else if (trx.type === 'EXPENSE') {
      // Biaya operasional langsung
      totalPengeluaran += trx.totalAmount;
      ringkasanUnit[uId].pengeluaran += trx.totalAmount;
    }
    // Note: RECEIVABLE_PAYMENT, DEBT_PAYMENT, and TRANSFER do NOT alter total revenue or total expense!
  });

  // Calculate profit/loss per unit
  Object.keys(ringkasanUnit).forEach((k) => {
    ringkasanUnit[k].labaRugi = ringkasanUnit[k].omzet - ringkasanUnit[k].pengeluaran;
  });

  const totalPendapatan = totalOmzet + pendapatanLain;
  const labaRugiSementara = totalPendapatan - totalPengeluaran;

  // 2. Calculate Kas & Bank Available (always based on all active transactions up to now)
  const accountBalances = calculateAccountBalances(activeTrx, accounts);
  const totalKasTersedia = Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0);

  // 3. Calculate Outstanding Receivables (Piutang)
  const receivables = calculateReceivables(activeTrx);
  const totalPiutangBelumDibayar = receivables.reduce((sum, r) => sum + r.remainingAmount, 0);

  // 4. Calculate Outstanding Payables (Hutang)
  const payables = calculatePayables(activeTrx);
  const totalHutangBelumDibayar = payables.reduce((sum, p) => sum + p.remainingAmount, 0);

  return {
    omzetHariIni,
    omzetBulanIni,
    totalOmzet,
    pendapatanLain,
    totalPendapatan,
    totalPengeluaran,
    labaRugiSementara,
    totalKasTersedia,
    totalPiutangBelumDibayar,
    totalHutangBelumDibayar,
    jumlahTransaksi: filteredTrx.length,
    ringkasanUnit,
  };
}

/**
 * Calculate dynamic account balance for every cash/bank/e-wallet account
 */
export function calculateAccountBalances(
  activeTransactions: Transaction[],
  accounts: Account[]
): Record<string, number> {
  const balances: Record<string, number> = {};

  accounts.forEach((acc) => {
    balances[acc.id] = acc.initialBalance || 0;
  });

  activeTransactions.forEach((trx) => {
    const accId = trx.accountId;

    // Incoming money to accountId
    if (trx.type === 'SALE' && (trx.paymentMethod === 'CASH' || trx.paymentMethod === 'TRANSFER')) {
      if (accId && balances[accId] !== undefined) {
        balances[accId] += trx.totalAmount;
      }
    } else if (trx.type === 'INCOME') {
      if (accId && balances[accId] !== undefined) {
        balances[accId] += trx.totalAmount;
      }
    } else if (trx.type === 'RECEIVABLE_PAYMENT') {
      if (accId && balances[accId] !== undefined) {
        balances[accId] += trx.totalAmount;
      }
    }

    // Outgoing money from accountId
    if (trx.type === 'PURCHASE' && (trx.paymentMethod === 'CASH' || trx.paymentMethod === 'TRANSFER')) {
      if (accId && balances[accId] !== undefined) {
        balances[accId] -= trx.totalAmount;
      }
    } else if (trx.type === 'EXPENSE') {
      if (accId && balances[accId] !== undefined) {
        balances[accId] -= trx.totalAmount;
      }
    } else if (trx.type === 'DEBT_PAYMENT') {
      if (accId && balances[accId] !== undefined) {
        balances[accId] -= trx.totalAmount;
      }
    }

    // Transfer between accounts
    if (trx.type === 'TRANSFER') {
      if (trx.accountId && balances[trx.accountId] !== undefined) {
        balances[trx.accountId] -= trx.totalAmount;
      }
      if (trx.destinationAccountId && balances[trx.destinationAccountId] !== undefined) {
        balances[trx.destinationAccountId] += trx.totalAmount;
      }
    }
  });

  return balances;
}

/**
 * Track all customer receivables (Piutang) from credit sales
 */
export function calculateReceivables(activeTransactions: Transaction[]): ReceivableItem[] {
  const creditSales = activeTransactions.filter(
    (t) => t.type === 'SALE' && t.paymentMethod === 'CREDIT'
  );

  const payments = activeTransactions.filter((t) => t.type === 'RECEIVABLE_PAYMENT');

  const todayStr = new Date().toISOString().split('T')[0];

  return creditSales.map((sale) => {
    // Total payments linked to this specific sale or partner
    const matchedPayments = payments.filter((p) => p.referenceTrxId === sale.id);
    const totalPaid = matchedPayments.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const remaining = Math.max(0, sale.totalAmount - totalPaid);

    let status: ReceivableItem['status'] = 'BELUM_BAYAR';
    if (remaining <= 0) {
      status = 'LUNAS';
    } else if (totalPaid > 0) {
      status = 'SEBAGIAN';
    }

    if (remaining > 0 && sale.dueDate && sale.dueDate < todayStr) {
      status = 'JATUH_TEMPO';
    }

    return {
      id: sale.id,
      date: sale.date,
      trxNumber: sale.trxNumber,
      partyName: sale.partyName,
      unitId: sale.unitId,
      itemName: sale.itemName,
      totalAmount: sale.totalAmount,
      paidAmount: totalPaid,
      remainingAmount: remaining,
      dueDate: sale.dueDate,
      status,
    };
  });
}

/**
 * Track all supplier / store payables (Hutang) from credit purchases
 */
export function calculatePayables(activeTransactions: Transaction[]): PayableItem[] {
  const creditPurchases = activeTransactions.filter(
    (t) => t.type === 'PURCHASE' && t.paymentMethod === 'CREDIT'
  );

  const payments = activeTransactions.filter((t) => t.type === 'DEBT_PAYMENT');

  const todayStr = new Date().toISOString().split('T')[0];

  return creditPurchases.map((purchase) => {
    // Total payments linked to this purchase
    const matchedPayments = payments.filter((p) => p.referenceTrxId === purchase.id);
    const totalPaid = matchedPayments.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const remaining = Math.max(0, purchase.totalAmount - totalPaid);

    let status: PayableItem['status'] = 'BELUM_BAYAR';
    if (remaining <= 0) {
      status = 'LUNAS';
    } else if (totalPaid > 0) {
      status = 'SEBAGIAN';
    }

    if (remaining > 0 && purchase.dueDate && purchase.dueDate < todayStr) {
      status = 'JATUH_TEMPO';
    }

    return {
      id: purchase.id,
      date: purchase.date,
      trxNumber: purchase.trxNumber,
      partyName: purchase.partyName,
      unitId: purchase.unitId,
      itemName: purchase.itemName,
      totalAmount: purchase.totalAmount,
      paidAmount: totalPaid,
      remainingAmount: remaining,
      dueDate: purchase.dueDate,
      status,
    };
  });
}

/**
 * Automatically produce Balanced Double-Entry Journal Entries from raw transactions
 */
export function generateGeneralJournal(
  activeTransactions: Transaction[],
  accountNames: Record<string, string> = {}
): JournalEntry[] {
  const entries: JournalEntry[] = [];

  activeTransactions.forEach((trx) => {
    const accName = accountNames[trx.accountId] || 'Kas / Bank';
    const desc = `${trx.itemName} - ${trx.partyName || ''}`;

    if (trx.type === 'SALE') {
      if (trx.paymentMethod === 'CASH' || trx.paymentMethod === 'TRANSFER') {
        // Debit: Kas/Bank, Kredit: Pendapatan Penjualan
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Penerimaan Kas Penjualan (${desc})`,
          account: accName,
          debit: trx.totalAmount,
          credit: 0,
          unitId: trx.unitId,
        });
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Pendapatan Penjualan (${desc})`,
          account: 'Pendapatan Usaha',
          debit: 0,
          credit: trx.totalAmount,
          unitId: trx.unitId,
        });
      } else {
        // CREDIT Bon: Debit Piutang Usaha, Kredit Pendapatan Penjualan
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Piutang Penjualan Bon (${desc})`,
          account: 'Piutang Usaha',
          debit: trx.totalAmount,
          credit: 0,
          unitId: trx.unitId,
        });
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Pendapatan Penjualan (${desc})`,
          account: 'Pendapatan Usaha',
          debit: 0,
          credit: trx.totalAmount,
          unitId: trx.unitId,
        });
      }
    } else if (trx.type === 'RECEIVABLE_PAYMENT') {
      // Debit: Kas/Bank, Kredit: Piutang Usaha
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Penerimaan Pelunasan Piutang (${trx.partyName})`,
        account: accName,
        debit: trx.totalAmount,
        credit: 0,
        unitId: trx.unitId,
      });
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Pelunasan Piutang (${trx.partyName})`,
        account: 'Piutang Usaha',
        debit: 0,
        credit: trx.totalAmount,
        unitId: trx.unitId,
      });
    } else if (trx.type === 'PURCHASE') {
      const expenseAcc = trx.itemCategory || 'Beban Material / Pembelian';
      if (trx.paymentMethod === 'CASH' || trx.paymentMethod === 'TRANSFER') {
        // Debit: Beban/Persediaan, Kredit: Kas/Bank
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Pembelian Tunai (${desc})`,
          account: expenseAcc,
          debit: trx.totalAmount,
          credit: 0,
          unitId: trx.unitId,
        });
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Pengeluaran Kas Pembelian (${desc})`,
          account: accName,
          debit: 0,
          credit: trx.totalAmount,
          unitId: trx.unitId,
        });
      } else {
        // CREDIT Bon: Debit Beban/Persediaan, Kredit: Hutang Usaha
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Pembelian Bon / Hutang (${desc})`,
          account: expenseAcc,
          debit: trx.totalAmount,
          credit: 0,
          unitId: trx.unitId,
        });
        entries.push({
          date: trx.date,
          trxNumber: trx.trxNumber,
          description: `Hutang Usaha (${trx.partyName})`,
          account: 'Hutang Usaha',
          debit: 0,
          credit: trx.totalAmount,
          unitId: trx.unitId,
        });
      }
    } else if (trx.type === 'DEBT_PAYMENT') {
      // Debit: Hutang Usaha, Kredit: Kas/Bank
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Pembayaran Pelunasan Hutang (${trx.partyName})`,
        account: 'Hutang Usaha',
        debit: trx.totalAmount,
        credit: 0,
        unitId: trx.unitId,
      });
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Pengeluaran Kas Bayar Hutang (${trx.partyName})`,
        account: accName,
        debit: 0,
        credit: trx.totalAmount,
        unitId: trx.unitId,
      });
    } else if (trx.type === 'EXPENSE') {
      const catName = trx.itemCategory ? `Beban ${trx.itemCategory}` : 'Beban Operasional';
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Beban Operasional (${desc})`,
        account: catName,
        debit: trx.totalAmount,
        credit: 0,
        unitId: trx.unitId,
      });
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Pengeluaran Kas (${desc})`,
        account: accName,
        debit: 0,
        credit: trx.totalAmount,
        unitId: trx.unitId,
      });
    } else if (trx.type === 'INCOME') {
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Penerimaan Kas Lainnya (${desc})`,
        account: accName,
        debit: trx.totalAmount,
        credit: 0,
        unitId: trx.unitId,
      });
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Pendapatan Lain-lain (${desc})`,
        account: 'Pendapatan Lain-lain',
        debit: 0,
        credit: trx.totalAmount,
        unitId: trx.unitId,
      });
    } else if (trx.type === 'TRANSFER') {
      const destAccName = trx.destinationAccountId ? (accountNames[trx.destinationAccountId] || 'Akun Tujuan') : 'Akun Tujuan';
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Penerimaan Transfer dari ${accName}`,
        account: destAccName,
        debit: trx.totalAmount,
        credit: 0,
        unitId: trx.unitId,
      });
      entries.push({
        date: trx.date,
        trxNumber: trx.trxNumber,
        description: `Pengiriman Transfer ke ${destAccName}`,
        account: accName,
        debit: 0,
        credit: trx.totalAmount,
        unitId: trx.unitId,
      });
    }
  });

  return entries.sort((a, b) => (b.date > a.date ? 1 : -1));
}

/**
 * Generate General Ledger (Buku Besar) grouped by Account
 */
export function generateGeneralLedger(journalEntries: JournalEntry[]): Record<string, LedgerAccount> {
  const ledgerMap: Record<string, LedgerAccount> = {};

  journalEntries.forEach((entry) => {
    if (!ledgerMap[entry.account]) {
      ledgerMap[entry.account] = {
        accountName: entry.account,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        finalBalance: 0,
      };
    }

    const ledger = ledgerMap[entry.account];
    ledger.totalDebit += entry.debit;
    ledger.totalCredit += entry.credit;

    // Assets & Expenses increase on Debit, Liabilities & Equity & Revenue increase on Credit
    const isDebitNormal = !['Hutang Usaha', 'Pendapatan Usaha', 'Pendapatan Lain-lain', 'Modal'].some(acc => entry.account.includes(acc));
    const delta = isDebitNormal ? (entry.debit - entry.credit) : (entry.credit - entry.debit);
    const prevBalance = ledger.entries.length > 0 ? ledger.entries[ledger.entries.length - 1].runningBalance : 0;
    const runningBalance = prevBalance + delta;

    ledger.entries.push({
      date: entry.date,
      trxNumber: entry.trxNumber,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      runningBalance,
    });

    ledger.finalBalance = runningBalance;
  });

  return ledgerMap;
}
