
import React, { useState } from 'react';
import { Transaction, Entity, ExchangeRates, TransactionCategory, TransactionStatus, Currency } from '../types';
import { Trash2, Briefcase, Building2, ArrowRightLeft, Wallet, Calendar, CheckCircle2, Landmark, ArrowUpDown, Edit2 } from 'lucide-react';

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

  // Sorting Function
  const handleSort = (key: keyof Transaction | 'amount' | 'total') => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  // Data Processing
  const processedTransactions = [...transactions]
    .filter(t => entityFilter === 'ALL' || t.entity === entityFilter)
    .sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Transaction];
        let bValue: any = b[sortConfig.key as keyof Transaction];

        // Custom sorts
        if (sortConfig.key === 'amount') {
            aValue = Math.abs(a.amountHKD) + Math.abs(a.amountRMB) + Math.abs(a.amountUSD);
            bValue = Math.abs(b.amountHKD) + Math.abs(b.amountRMB) + Math.abs(b.amountUSD);
        } else if (sortConfig.key === 'total') {
            aValue = getTotalInBase(a.amountHKD, a.amountRMB, a.amountUSD);
            bValue = getTotalInBase(b.amountHKD, b.amountRMB, b.amountUSD);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
            <tr>
              <SortableHeader label="日期" width="w-28" onClick={() => handleSort('date')} active={sortConfig.key === 'date'} />
              <SortableHeader label="状态" width="w-24" onClick={() => handleSort('status')} active={sortConfig.key === 'status'} />
              <SortableHeader label="实体 / 类别" width="w-32" onClick={() => handleSort('entity')} active={sortConfig.key === 'entity'} />
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">交易事项</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">HKD (亿)</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">RMB (亿)</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">USD (亿)</th>
              <SortableHeader label={`合计 ${baseCurrency}`} width="w-32" align="right" onClick={() => handleSort('total')} active={sortConfig.key === 'total'} />
              <th className="px-6 py-4 text-center w-20">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {processedTransactions.map((t, idx) => {
              const totalInBase = getTotalInBase(t.amountHKD, t.amountRMB, t.amountUSD);
              const isForecast = t.status === TransactionStatus.FORECAST;
              const isDebtGenerated = !!t.linkedDebtId;
              
              return (
                <tr key={t.id} className={`hover:bg-slate-50/80 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-600 font-mono font-medium">{t.date}</td>
                  <td className="px-6 py-3 whitespace-nowrap">
                      {isForecast ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                           <Calendar size={10} className="mr-1.5"/> 预测
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                            <CheckCircle2 size={10} className="mr-1.5"/> 实绩
                        </span>
                      )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${t.entity === Entity.PROPERTY ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{t.entity}</span>
                         <span className="text-[10px] text-slate-400 flex items-center gap-1.5 pl-0.5">
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
                  
                  <td className={`px-6 py-3 whitespace-nowrap text-xs text-right font-mono ${t.amountHKD !== 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>{formatNumber(t.amountHKD)}</td>
                  <td className={`px-6 py-3 whitespace-nowrap text-xs text-right font-mono ${t.amountRMB !== 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>{formatNumber(t.amountRMB)}</td>
                  <td className={`px-6 py-3 whitespace-nowrap text-xs text-right font-mono ${t.amountUSD !== 0 ? 'text-slate-900 font-bold' : 'text-slate-300'}`}>{formatNumber(t.amountUSD)}</td>
                  
                  <td className={`px-6 py-3 whitespace-nowrap text-xs text-right font-mono font-bold bg-slate-50/50 ${totalInBase < 0 ? 'text-rose-600' : totalInBase > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {totalInBase > 0 ? '+' : ''}{formatNumber(totalInBase)}
                  </td>
                  <td className="px-6 py-3 text-center whitespace-nowrap">
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
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <p className="text-xs text-slate-500 font-medium">显示 {processedTransactions.length} 条记录</p>
      </div>
    </div>
  );
};

const SortableHeader = ({ label, width, onClick, active, align = 'left' }: any) => (
    <th 
        className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-indigo-600 hover:bg-slate-100 transition-colors group ${width} text-${align}`}
        onClick={onClick}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {label}
            <ArrowUpDown size={12} className={`transition-opacity ${active ? 'opacity-100 text-indigo-600' : 'opacity-20 group-hover:opacity-50'}`} />
        </div>
    </th>
);

export default FinancialTable;
