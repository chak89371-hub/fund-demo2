
import React, { useState, useMemo } from 'react';
import { Transaction, Entity, ExchangeRates, TransactionCategory, TransactionStatus, Currency } from '../types';
import { Trash2, Briefcase, Building2, ArrowRightLeft, Wallet, Calendar, CheckCircle2, Landmark, ArrowUpDown, Edit2, ChevronDown, ChevronRight } from 'lucide-react';

interface FinancialTableProps {
  transactions: Transaction[];
  entityFilter: Entity | 'ALL';
  rates: ExchangeRates;
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
  startBalances: Record<Entity, { HKD: number; RMB: number; USD: number }>;
  baseCurrency: Currency;
}

const FinancialTable: React.FC<FinancialTableProps> = ({ 
  transactions, 
  entityFilter, 
  rates,
  onDelete,
  onEdit,
  startBalances,
  baseCurrency
}) => {
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction | 'amount' | 'total'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const formatNumber = (num: number) => {
    if (Math.abs(num) < 0.001) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getTotalInBase = (h: number, r: number, u: number) => {
    const valInRMB = (h * rates.HKD_TO_RMB) + r + (u * rates.USD_TO_RMB);
    switch (baseCurrency) {
        case Currency.RMB: return valInRMB;
        case Currency.HKD: return valInRMB / rates.HKD_TO_RMB;
        case Currency.USD: return valInRMB / rates.USD_TO_RMB;
        default: return valInRMB;
    }
  };

  const getCategoryIcon = (cat: TransactionCategory) => {
    switch(cat) {
        case TransactionCategory.OPERATING: return <Briefcase size={14} className="text-blue-500" />;
        case TransactionCategory.FINANCING: return <Wallet size={14} className="text-purple-500" />;
        case TransactionCategory.INVESTING: return <Building2 size={14} className="text-amber-500" />;
        case TransactionCategory.INTERNAL: return <ArrowRightLeft size={14} className="text-gray-500" />;
        default: return <Briefcase size={14} />;
    }
  };

  // Data Processing & Grouping
  const { groupedData, initialBalanceBase } = useMemo(() => {
      // 1. Filter & Sort
      let processed = [...transactions].filter(t => entityFilter === 'ALL' || t.entity === entityFilter);
      
      // Determine Initial Balance based on Filter
      let startBase = 0;
      if (entityFilter === 'ALL') {
          Object.values(startBalances).forEach(b => {
              startBase += getTotalInBase(b.HKD, b.RMB, b.USD);
          });
      } else {
          const b = startBalances[entityFilter];
          startBase = getTotalInBase(b.HKD, b.RMB, b.USD);
      }

      // Always sort by date primarily for Running Balance to make sense, then apply user sort if needed within groups?
      // Actually, for a financial ledger, Date is the only logical sort for Running Balance.
      // If user sorts by Amount, Running Balance loses meaning. 
      // So we will FORCE date sort for the calculation, but maybe allow visual sort? 
      // Let's stick to Date Sort as primary.
      processed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 2. Calculate Running Balance & Group by Month
      const groups: Record<string, { month: string, trans: (Transaction & { runningBal: number, totalBase: number })[], monthEndBal: number, netFlow: number }> = {};
      let currentRunningBal = startBase;

      processed.forEach(t => {
          const monthKey = t.date.substring(0, 7); // YYYY-MM
          if (!groups[monthKey]) {
              groups[monthKey] = { month: monthKey, trans: [], monthEndBal: 0, netFlow: 0 };
          }
          
          // Logic: If Internal Transfer, does it affect the filtered view?
          // If ALL: Internal transfer nets to 0 usually (unless cross currency gap).
          // If Entity Filter: It matters.
          const totalInBase = getTotalInBase(t.amountHKD, t.amountRMB, t.amountUSD);
          
          // Skip running balance update for Internal transfers IF viewing ALL (it's a wash), 
          // but keep it for Entity view.
          // Actually, in 'ALL' view, +5 and -5 are separate rows. So we just add them.
          currentRunningBal += totalInBase;

          groups[monthKey].trans.push({
              ...t,
              runningBal: currentRunningBal,
              totalBase: totalInBase
          });
          groups[monthKey].netFlow += totalInBase;
          groups[monthKey].monthEndBal = currentRunningBal;
      });

      return { groupedData: groups, initialBalanceBase: startBase };
  }, [transactions, entityFilter, rates, baseCurrency, startBalances]);

  const sortedMonthKeys = Object.keys(groupedData).sort();

  const toggleMonth = (m: string) => {
      setExpandedMonths(prev => ({ ...prev, [m]: !prev[m] }));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-32">日期</th>
              <th className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">状态</th>
              <th className="px-4 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-32">实体 / 类别</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">交易事项</th>
              <th className="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">HKD (亿)</th>
              <th className="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">RMB (亿)</th>
              <th className="px-4 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-24">USD (亿)</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-32 bg-slate-100/50">合计 {baseCurrency}</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-indigo-600 uppercase tracking-wider w-32 bg-indigo-50/30">实时余额</th>
              <th className="px-4 py-4 text-center w-16">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {/* Initial Balance Row */}
            <tr className="bg-slate-50 border-b border-slate-200">
                <td colSpan={8} className="px-6 py-3 text-right text-xs font-bold text-slate-500">期初资金余额</td>
                <td className="px-6 py-3 text-right text-xs font-bold font-mono text-slate-800 bg-indigo-50/30">{formatNumber(initialBalanceBase)}</td>
                <td></td>
            </tr>

            {sortedMonthKeys.map(month => {
                const group = groupedData[month];
                const isExpanded = expandedMonths[month] !== false; // Default open

                return (
                    <React.Fragment key={month}>
                        {/* Month Header */}
                        <tr className="bg-slate-100/80 border-y border-slate-200 cursor-pointer hover:bg-slate-200/50" onClick={() => toggleMonth(month)}>
                            <td colSpan={10} className="px-6 py-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
                                        <span className="text-xs font-bold text-slate-700">{month}</span>
                                        <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{group.trans.length} 笔交易</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <span className="text-slate-500">月度净流: <span className={`font-mono font-bold ${group.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{group.netFlow > 0 ? '+' : ''}{formatNumber(group.netFlow)}</span></span>
                                        <span className="text-slate-500">月末余额: <span className="font-mono font-bold text-indigo-600">{formatNumber(group.monthEndBal)}</span></span>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        {/* Transactions */}
                        {isExpanded && group.trans.map((t, idx) => {
                             const isForecast = t.status === TransactionStatus.FORECAST;
                             const isDebtGenerated = !!t.linkedDebtId;
                             
                             return (
                                <tr key={t.id} className={`hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0`}>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-600 font-mono">{t.date.substring(5)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {isForecast ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                            <Calendar size={8} className="mr-1"/> 预测
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <CheckCircle2 size={8} className="mr-1"/> 实绩
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex flex-col gap-0.5">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit ${t.entity === Entity.PROPERTY ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{t.entity}</span>
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1 pl-0.5">
                                                {getCategoryIcon(t.category)} {t.category}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-slate-700 font-medium max-w-xs truncate">
                                        <div className="flex items-center gap-2" title={t.description}>
                                            {isDebtGenerated && (
                                                <div className="p-1 bg-slate-100 rounded text-slate-400 flex-shrink-0" title="来自债务台账">
                                                    <Landmark size={12} />
                                                </div>
                                            )}
                                            <span className="truncate">{t.description}</span>
                                        </div>
                                    </td>
                                    
                                    <td className={`px-4 py-3 whitespace-nowrap text-xs text-right font-mono ${t.amountHKD !== 0 ? 'text-slate-900' : 'text-slate-200'}`}>{formatNumber(t.amountHKD)}</td>
                                    <td className={`px-4 py-3 whitespace-nowrap text-xs text-right font-mono ${t.amountRMB !== 0 ? 'text-slate-900' : 'text-slate-200'}`}>{formatNumber(t.amountRMB)}</td>
                                    <td className={`px-4 py-3 whitespace-nowrap text-xs text-right font-mono ${t.amountUSD !== 0 ? 'text-slate-900' : 'text-slate-200'}`}>{formatNumber(t.amountUSD)}</td>
                                    
                                    <td className={`px-6 py-3 whitespace-nowrap text-xs text-right font-mono font-bold bg-slate-50/30 ${t.totalBase < 0 ? 'text-rose-600' : t.totalBase > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {t.totalBase > 0 ? '+' : ''}{formatNumber(t.totalBase)}
                                    </td>
                                    <td className="px-6 py-3 whitespace-nowrap text-xs text-right font-mono font-bold text-indigo-600 bg-indigo-50/10">
                                        {formatNumber(t.runningBal)}
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isDebtGenerated && (
                                                <>
                                                    <button onClick={() => onEdit(t)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-all">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => onDelete(t.id)} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                             );
                        })}
                    </React.Fragment>
                );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <p className="text-xs text-slate-500 font-medium">显示 {transactions.length} 条记录 (按月分组)</p>
      </div>
    </div>
  );
};

export default FinancialTable;
