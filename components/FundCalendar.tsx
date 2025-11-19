import React, { useState, useMemo } from 'react';
import { Transaction, Entity, ExchangeRates, Currency, TransactionCategory } from '../types';
import { ChevronLeft, ChevronRight, X, ArrowUpRight, ArrowDownLeft, Wallet, CalendarCheck, AlertCircle } from 'lucide-react';

interface FundCalendarProps {
  transactions: Transaction[];
  baseCurrency: Currency;
  rates: ExchangeRates;
  startBalances: Record<Entity, { HKD: number; RMB: number; USD: number }>;
}

const FundCalendar: React.FC<FundCalendarProps> = ({ transactions, baseCurrency, rates, startBalances }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const convert = (hkd: number, rmb: number, usd: number) => {
    const valInRMB = (hkd * rates.HKD_TO_RMB) + rmb + (usd * rates.USD_TO_RMB);
    switch (baseCurrency) {
        case Currency.RMB: return valInRMB;
        case Currency.HKD: return valInRMB / rates.HKD_TO_RMB;
        case Currency.USD: return valInRMB / rates.USD_TO_RMB;
        default: return valInRMB;
    }
  };

  // 1. Pre-calculate Daily Balances for the entire dataset timeline
  // This is critical to know the 'Starting Balance' of any given day.
  const dailyBalances = useMemo(() => {
      const sortedAll = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const balanceMap: Record<string, number> = {};
      
      // Initial Total
      let currentTotal = 0;
      Object.values(startBalances).forEach(b => {
          currentTotal += convert(b.HKD, b.RMB, b.USD);
      });

      // Iterate through every transaction to build a timeline
      // Note: We need a continuous date range to carry over balances for days with no transactions
      if (sortedAll.length === 0) return {};

      const startDate = new Date(new Date().setDate(new Date().getDate() - 90)); // Start a bit back
      const endDate = new Date(new Date().setDate(new Date().getDate() + 500)); // Go far future
      
      let runningBalance = currentTotal;
      const tempMap: Record<string, number> = {};

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          
          // Find transactions for this specific date
          const daysTrans = sortedAll.filter(t => t.date === dateStr);
          daysTrans.forEach(t => {
               if (t.category !== TransactionCategory.INTERNAL) {
                   runningBalance += convert(t.amountHKD, t.amountRMB, t.amountUSD);
               }
          });
          
          tempMap[dateStr] = runningBalance;
      }
      return tempMap;
  }, [transactions, rates, startBalances, baseCurrency]);


  // 2. Generate Calendar Grid
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    const grid: { day: number | null; dateStr: string | null; netFlow: number; endBalance: number; hasData: boolean }[] = [];

    // Pad start
    for (let i = 0; i < startingDay; i++) {
      grid.push({ day: null, dateStr: null, netFlow: 0, endBalance: 0, hasData: false });
    }

    // Fill days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      // Net Flow
      const dayTrans = transactions.filter(t => t.date === dateStr);
      let dailyNet = 0;
      dayTrans.forEach(t => {
        if (t.category !== TransactionCategory.INTERNAL) {
            dailyNet += convert(t.amountHKD, t.amountRMB, t.amountUSD);
        }
      });

      // End Balance
      const endBalance = dailyBalances[dateStr] || 0;

      grid.push({ 
          day: i, 
          dateStr, 
          netFlow: dailyNet, 
          endBalance,
          hasData: dayTrans.length > 0 
      });
    }

    return grid;
  }, [currentDate, transactions, rates, baseCurrency, dailyBalances]);

  // 3. Month Summary Data
  const monthSummary = useMemo(() => {
      if (calendarGrid.length === 0) return { start: 0, in: 0, out: 0, end: 0 };
      
      // Find first valid day
      const firstDayCell = calendarGrid.find(c => c.day === 1);
      const lastDayCell = calendarGrid[calendarGrid.length - 1];

      const startBal = firstDayCell ? (firstDayCell.endBalance - firstDayCell.netFlow) : 0;
      const endBal = lastDayCell?.endBalance || 0;
      
      const totalIn = calendarGrid.reduce((acc, c) => acc + (c.netFlow > 0 ? c.netFlow : 0), 0);
      const totalOut = calendarGrid.reduce((acc, c) => acc + (c.netFlow < 0 ? Math.abs(c.netFlow) : 0), 0);

      return { start: startBal, in: totalIn, out: totalOut, end: endBal };
  }, [calendarGrid]);

  const selectedTransactions = useMemo(() => {
    if (!selectedDate) return [];
    return transactions.filter(t => t.date === selectedDate);
  }, [selectedDate, transactions]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  // Safety Threshold for Balance Visuals
  const safetyThreshold = convert(0, 100, 0);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Month Summary Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
         <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <CalendarCheck size={24} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                </h2>
                <p className="text-xs text-slate-400">资金月度概览</p>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-1 ml-4">
                <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all shadow-sm hover:shadow"><ChevronLeft size={16}/></button>
                <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all shadow-sm hover:shadow"><ChevronRight size={16}/></button>
            </div>
         </div>
         
         <div className="flex gap-8">
            <SummaryItem label="期初余额" value={monthSummary.start} color="text-slate-600" />
            <div className="w-px bg-slate-200 h-8 my-auto"></div>
            <SummaryItem label="本月流入" value={monthSummary.in} color="text-emerald-600" prefix="+" />
            <div className="w-px bg-slate-200 h-8 my-auto"></div>
            <SummaryItem label="本月流出" value={monthSummary.out} color="text-rose-600" prefix="-" />
            <div className="w-px bg-slate-200 h-8 my-auto"></div>
            <SummaryItem label="期末余额" value={monthSummary.end} color="text-indigo-600" bold />
         </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                    <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 grid-rows-5 flex-1 bg-slate-100 gap-px border-b border-slate-200">
                {calendarGrid.map((cell, idx) => {
                    const isRisk = cell.endBalance < safetyThreshold;
                    const isSelected = selectedDate === cell.dateStr;
                    const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
                    
                    return (
                    <div 
                        key={idx} 
                        onClick={() => cell.dateStr && setSelectedDate(cell.dateStr)}
                        className={`
                            relative bg-white transition-all cursor-pointer hover:bg-indigo-50/30 p-2 flex flex-col justify-between group
                            ${!cell.day ? 'bg-slate-50/50 pointer-events-none' : ''}
                            ${isSelected ? 'ring-2 ring-inset ring-indigo-500 z-10' : ''}
                            ${isRisk && cell.day ? 'bg-rose-50/30' : ''}
                        `}
                    >
                        {cell.day && (
                            <>
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}`}>
                                        {cell.day}
                                    </span>
                                    {/* Risk Dot */}
                                    {isRisk && (
                                        <Tooltip text="余额低于安全线">
                                            <AlertCircle size={14} className="text-amber-500" />
                                        </Tooltip>
                                    )}
                                </div>
                                
                                <div className="space-y-1 mt-1">
                                    {/* Projected Balance (Small) */}
                                    <div className="text-[10px] text-slate-400 font-mono text-right">
                                        余额: {cell.endBalance.toFixed(0)}
                                    </div>

                                    {/* Net Flow Bar */}
                                    {cell.hasData && (
                                        <div className={`text-xs font-bold text-right ${cell.netFlow > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {cell.netFlow > 0 ? '+' : ''}{cell.netFlow.toFixed(1)}
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Line Indicator */}
                                {cell.hasData && (
                                    <div className={`absolute bottom-0 left-0 right-0 h-1 ${cell.netFlow > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                                )}
                            </>
                        )}
                    </div>
                )})}
            </div>
        </div>

        {/* Detail Panel */}
        <div className={`w-80 bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col transition-all duration-300 transform ${selectedDate ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0 pointer-events-none'}`}>
            {selectedDate ? (
                <>
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white rounded-t-2xl">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs text-slate-400 uppercase font-bold">Selected Date</p>
                                <h3 className="text-xl font-bold text-slate-800 mt-0.5">{selectedDate}</h3>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="mt-4 bg-white/60 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
                             <span className="text-xs text-slate-500 font-medium">预计当日余额</span>
                             <span className="text-lg font-bold text-indigo-600 font-mono">
                                {dailyBalances[selectedDate]?.toFixed(2)}
                             </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                        {selectedTransactions.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                <CalendarCheck size={32} className="mb-2 opacity-20"/>
                                <span className="text-sm">无交易安排</span>
                             </div>
                        ) : (
                            selectedTransactions.map(t => {
                                const val = convert(t.amountHKD, t.amountRMB, t.amountUSD);
                                return (
                                    <div key={t.id} className="bg-white border border-slate-100 p-3.5 rounded-xl shadow-sm hover:shadow-md transition-all group hover:border-indigo-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${t.entity === Entity.PROPERTY ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                {t.entity}
                                            </span>
                                            <span className={`text-sm font-bold font-mono ${val > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {val > 0 ? '+' : ''}{val.toFixed(2)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 leading-snug mb-2 group-hover:text-indigo-900 transition-colors">{t.description}</p>
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                            <span className="text-[10px] text-slate-400">{t.category}</span>
                                            <div className="flex items-center gap-1 text-[10px] font-medium">
                                                {val > 0 ? <ArrowDownLeft size={12} className="text-emerald-500"/> : <ArrowUpRight size={12} className="text-rose-500"/>}
                                                <span className={val > 0 ? 'text-emerald-600' : 'text-rose-600'}>{val > 0 ? '流入' : '流出'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            ) : null}
        </div>
      </div>
    </div>
  );
};

const SummaryItem = ({ label, value, color, prefix = '', bold }: any) => (
    <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-mono mt-0.5 ${color} ${bold ? 'font-black' : 'font-medium'}`}>
            {prefix}{Math.abs(value).toFixed(1)} <span className="text-xs text-slate-300 font-normal">亿</span>
        </p>
    </div>
);

const Tooltip = ({ text, children }: any) => (
    <div className="group relative flex items-center">
        {children}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] text-white bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
            {text}
        </span>
    </div>
)

export default FundCalendar;