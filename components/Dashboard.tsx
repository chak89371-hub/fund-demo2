
import React, { useMemo, useState } from 'react';
import { 
  ComposedChart, Line, Bar, Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, ReferenceLine
} from 'recharts';
import { Transaction, Entity, ExchangeRates, TransactionCategory, Currency } from '../types';
import { ShieldCheck, Activity, PieChart as PieIcon, ArrowUpRight, ArrowDownLeft, Layers, Landmark, Timer, TrendingDown } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  rates: ExchangeRates;
  startBalances: Record<Entity, { HKD: number; RMB: number; USD: number }>;
  baseCurrency: Currency;
  onOpenDebtModal?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, rates, startBalances, baseCurrency, onOpenDebtModal }) => {
  
  const [chartFilter, setChartFilter] = useState<'ALL' | Entity>('ALL');

  // --- Conversion Helper ---
  const convertToBase = (hkd: number, rmb: number, usd: number): number => {
    const totalInRMB = (hkd * rates.HKD_TO_RMB) + rmb + (usd * rates.USD_TO_RMB);
    switch (baseCurrency) {
        case Currency.RMB: return totalInRMB;
        case Currency.HKD: return totalInRMB / rates.HKD_TO_RMB;
        case Currency.USD: return totalInRMB / rates.USD_TO_RMB;
        default: return totalInRMB;
    }
  };

  // --- Data Processing ---
  const chartData = useMemo(() => {
    const dataMap: Record<string, any> = {};
    const balances = { 
        [Entity.PROPERTY]: { ...startBalances[Entity.PROPERTY] },
        [Entity.ENTERPRISE]: { ...startBalances[Entity.ENTERPRISE] }
    };

    const sortedTrans = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedTrans.forEach(t => {
        const month = t.date.substring(0, 7);
        if (!dataMap[month]) {
            dataMap[month] = { month, inflow: 0, outflow: 0, net: 0, propBalance: 0, entBalance: 0, totalBalance: 0, filteredBalance: 0 };
        }

        const valBase = convertToBase(t.amountHKD, t.amountRMB, t.amountUSD);
        
        // Net Flow Calc (Only for display in bars)
        if (t.category !== TransactionCategory.INTERNAL) { 
            // If filter is active, only count if entity matches
            if (chartFilter === 'ALL' || t.entity === chartFilter) {
                 if (valBase > 0) dataMap[month].inflow += valBase;
                 else dataMap[month].outflow += Math.abs(valBase);
                 dataMap[month].net += valBase;
            }
        }

        // Balance Update
        balances[t.entity].HKD += t.amountHKD;
        balances[t.entity].RMB += t.amountRMB;
        balances[t.entity].USD += t.amountUSD;

        const propTotal = convertToBase(balances[Entity.PROPERTY].HKD, balances[Entity.PROPERTY].RMB, balances[Entity.PROPERTY].USD);
        const entTotal = convertToBase(balances[Entity.ENTERPRISE].HKD, balances[Entity.ENTERPRISE].RMB, balances[Entity.ENTERPRISE].USD);
        
        dataMap[month].propBalance = parseFloat(propTotal.toFixed(2));
        dataMap[month].entBalance = parseFloat(entTotal.toFixed(2));
        dataMap[month].totalBalance = parseFloat((propTotal + entTotal).toFixed(2));

        if (chartFilter === 'ALL') dataMap[month].filteredBalance = dataMap[month].totalBalance;
        else if (chartFilter === Entity.PROPERTY) dataMap[month].filteredBalance = dataMap[month].propBalance;
        else dataMap[month].filteredBalance = dataMap[month].entBalance;
    });
    return Object.values(dataMap);
  }, [transactions, rates, startBalances, baseCurrency, chartFilter]);

  // STRICT 18-MONTH FILTER
  const displayChartData = useMemo(() => {
      const today = new Date();
      const startStr = today.toISOString().substring(0, 7); 
      const endDate = new Date(today);
      endDate.setMonth(today.getMonth() + 18);
      const endStr = endDate.toISOString().substring(0, 7);
      return chartData.filter(d => d.month >= startStr && d.month <= endStr);
  }, [chartData]);


  // --- KPI Calculations ---
  const currentMonth = displayChartData[0];
  const currentBalance = currentMonth?.filteredBalance || 0;
  const latestKnownData = chartData[chartData.length - 1];
  const latestBalance = latestKnownData?.filteredBalance || 0;

  // Safety Threshold
  const safetyThreshold = useMemo(() => convertToBase(0, 100, 0), [baseCurrency, rates]);
  const netFlow = currentMonth?.net || 0;

  // Runway Calculation (Months until balance < 0 if avg burn persists)
  const runway = useMemo(() => {
      const burnMonths = displayChartData.filter(d => d.net < 0);
      if (burnMonths.length === 0) return 999; // Infinite runway
      const avgBurn = burnMonths.reduce((acc, curr) => acc + Math.abs(curr.net), 0) / burnMonths.length;
      if (avgBurn === 0) return 999;
      return currentBalance / avgBurn;
  }, [displayChartData, currentBalance]);

  // FX Data (Total Exposure)
  const fxData = useMemo(() => {
    const finalBal = { HKD: 0, RMB: 0, USD: 0 };
    const relevantStart = chartFilter === 'ALL' ? [startBalances[Entity.PROPERTY], startBalances[Entity.ENTERPRISE]] : [startBalances[chartFilter as Entity]];
    
    relevantStart.forEach(b => { finalBal.HKD += b.HKD; finalBal.RMB += b.RMB; finalBal.USD += b.USD; });
    
    transactions
        .filter(t => chartFilter === 'ALL' || t.entity === chartFilter)
        .forEach(t => { finalBal.HKD += t.amountHKD; finalBal.RMB += t.amountRMB; finalBal.USD += t.amountUSD; });
    
    return [
        { name: 'RMB', value: Math.abs(convertToBase(0, finalBal.RMB, 0)), color: '#f43f5e' },
        { name: 'HKD', value: Math.abs(convertToBase(finalBal.HKD, 0, 0)), color: '#3b82f6' },
        { name: 'USD', value: Math.abs(convertToBase(0, 0, finalBal.USD)), color: '#10b981' },
    ];
  }, [transactions, rates, startBalances, baseCurrency, chartFilter]);

  // Debt Data
  const debtData = useMemo(() => {
      const quarterMap: Record<string, { hkd: number, usd: number, rmb: number }> = {};
      transactions
        .filter(t => t.category === TransactionCategory.FINANCING && (t.amountHKD < 0 || t.amountRMB < 0 || t.amountUSD < 0))
        .filter(t => chartFilter === 'ALL' || t.entity === chartFilter)
        .forEach(t => {
            const date = new Date(t.date);
            const q = `Q${Math.floor(date.getMonth() / 3) + 1} '${date.getFullYear().toString().substr(2)}`;
            if (!quarterMap[q]) quarterMap[q] = { hkd: 0, usd: 0, rmb: 0 };
            quarterMap[q].hkd += Math.abs(convertToBase(t.amountHKD, 0, 0));
            quarterMap[q].usd += Math.abs(convertToBase(0, 0, t.amountUSD));
            quarterMap[q].rmb += Math.abs(convertToBase(0, t.amountRMB, 0));
      });
      return Object.entries(quarterMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions, rates, baseCurrency, chartFilter]);

  // Smart Score Logic
  const healthScore = useMemo(() => {
      let score = 100;
      if (latestBalance < safetyThreshold) score -= 30;
      if (netFlow < 0) score -= 10;
      if (runway < 6) score -= 20;
      return Math.max(0, score);
  }, [latestBalance, safetyThreshold, netFlow, runway]);

  const radarData = [
    { subject: '流动性 (Liquidity)', A: runway > 12 ? 95 : runway > 6 ? 70 : 40, fullMark: 100 },
    { subject: '偿债覆盖 (DSCR)', A: 80, fullMark: 100 },
    { subject: '融资弹性', A: 70, fullMark: 100 },
    { subject: '汇率对冲', A: 50, fullMark: 100 },
    { subject: '运营效率', A: netFlow > 0 ? 90 : 60, fullMark: 100 },
  ];

  return (
    <div className="space-y-8">
      
      {/* --- Row 1: KPI Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SparklineCard 
            title={chartFilter === 'ALL' ? '集团总资金余额' : `${chartFilter}资金余额`}
            value={latestBalance} 
            unit={`亿 ${baseCurrency}`} 
            data={displayChartData} 
            dataKey="filteredBalance" 
            color="#4f46e5" 
            trend={latestBalance > safetyThreshold ? 'up' : 'down'}
            subText={`警戒线: ${safetyThreshold.toFixed(0)}`}
          />
          <SparklineCard 
            title="本月净流量 (Net Flow)" 
            value={netFlow} 
            unit="亿" 
            data={displayChartData} 
            dataKey="net" 
            color={netFlow > 0 ? "#10b981" : "#f43f5e" } 
            type="bar"
            trend={netFlow > 0 ? 'up' : 'down'}
            subText={netFlow > 0 ? "资金净流入" : "资金净流出"}
          />
          
          {/* New: Runway Card */}
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md hover:border-amber-200 transition-all">
                <div className="flex justify-between items-start mb-4 relative z-10">
                     <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">资金跑道 (Runway)</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-2 tracking-tight">
                            {runway > 24 ? '> 24' : runway.toFixed(1)} <span className="text-xs font-normal text-slate-400">个月</span>
                        </h3>
                     </div>
                     <div className={`p-2 rounded-xl ${runway < 6 ? 'bg-rose-100 text-rose-600' : 'bg-amber-50 text-amber-500'}`}>
                         <Timer size={20}/>
                     </div>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative z-10">
                    <div className={`h-full rounded-full transition-all duration-1000 ${runway < 6 ? 'bg-rose-500' : 'bg-amber-400'}`} style={{width: `${Math.min(runway * 5, 100)}%`}}></div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 relative z-10">按当前平均消耗速度计算</p>
           </div>

           {/* Health Score */}
           <div className="bg-gradient-to-br from-slate-800 to-slate-950 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden ring-1 ring-black/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                <div className="relative z-10">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">集团综合健康分</p>
                    <h3 className="text-3xl font-bold mt-1 tracking-tight">{healthScore.toFixed(1)} <span className="text-sm font-normal text-slate-500">/ 100</span></h3>
                </div>
                <div className="h-24 -mb-4 relative z-10 opacity-90">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{fontSize: 0}} />
                            <Radar name="Score" dataKey="A" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
           </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- Main Chart: Liquidity with Filter --- */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 ring-1 ring-indigo-100"><Activity size={20}/></div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">流动性趋势预测 (Liquidity Forecast)</h3>
                        <p className="text-xs text-slate-400 font-medium">未来18个月资金池水位变化</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl overflow-hidden">
                        <button onClick={() => setChartFilter('ALL')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${chartFilter === 'ALL' ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>合并</button>
                        <button onClick={() => setChartFilter(Entity.PROPERTY)} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${chartFilter === Entity.PROPERTY ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>地产</button>
                        <button onClick={() => setChartFilter(Entity.ENTERPRISE)} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${chartFilter === Entity.ENTERPRISE ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>企业</button>
                    </div>
                </div>
             </div>
             
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10}/>
                        <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} dx={-10}/>
                        <Tooltip content={<CustomTooltip />} cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4'}}/>
                        <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '20px'}}/>
                        
                        <ReferenceLine y={safetyThreshold} label={{ value: '安全警戒线', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} stroke="#ef4444" strokeDasharray="3 3" />
                        
                        <Area 
                            type="monotone" 
                            dataKey="filteredBalance" 
                            name={chartFilter === 'ALL' ? "合并资金余额" : `${chartFilter}余额`}
                            stroke="#4f46e5" 
                            strokeWidth={3} 
                            fill="url(#colorTotal)" 
                            activeDot={{r:6, strokeWidth:0, fill: '#4f46e5'}} 
                            animationDuration={1000}
                        />
                        <Bar dataKey="net" name="净流量" barSize={4} fill="#cbd5e1" radius={[2,2,0,0]} />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
        </div>

        {/* --- Debt Tower --- */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 ring-1 ring-rose-100"><Layers size={20}/></div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">债务偿还压力</h3>
                        <p className="text-xs text-slate-400 font-medium">季度分布 (Maturity)</p>
                    </div>
                </div>
                {onOpenDebtModal && (
                     <button onClick={onOpenDebtModal} className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded hover:bg-rose-100 transition-colors flex items-center gap-1">
                        <Landmark size={12}/> 管理
                     </button>
                )}
             </div>
             
             <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={debtData} margin={{ top: 20, right: 0, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                            dataKey="name" 
                            tick={{fontSize: 10, fill: '#94a3b8'}} 
                            axisLine={false} 
                            tickLine={false} 
                            interval={0} 
                            angle={-45} 
                            textAnchor="end" 
                            height={60}
                        />
                        <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} dx={-10}/>
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}}/>
                        <Bar dataKey="rmb" name="RMB" stackId="a" fill="#f43f5e" radius={[0,0,4,4]} barSize={20} />
                        <Bar dataKey="usd" name="USD" stackId="a" fill="#10b981" barSize={20} />
                        <Bar dataKey="hkd" name="HKD" stackId="a" fill="#3b82f6" radius={[4,4,0,0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
        </div>
      </div>

    </div>
  );
};

// --- Subcomponents ---

const SparklineCard = ({ title, value, unit, data, dataKey, color, type = 'area', trend, subText }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md hover:border-indigo-100 transition-all duration-300">
        <div className="flex justify-between items-start relative z-10">
            <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-2 tracking-tight">{typeof value === 'number' ? value.toFixed(1) : value} <span className="text-xs font-normal text-slate-400">{unit}</span></h3>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {trend === 'up' ? <ArrowUpRight size={12}/> : <ArrowDownLeft size={12}/>}
                {subText}
            </div>
        </div>
        <div className="h-14 w-full mt-5 opacity-60 group-hover:scale-105 transition-transform duration-500">
            <ResponsiveContainer width="100%" height="100%">
                {type === 'area' ? (
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.4}/>
                                <stop offset="100%" stopColor={color} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} animationDuration={1500}/>
                    </AreaChart>
                ) : (
                     <BarChart data={data}>
                        <Bar dataKey={dataKey} fill={color} radius={[2,2,0,0]} animationDuration={1500}/>
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 border border-slate-100 shadow-xl rounded-2xl text-xs ring-1 ring-black/5">
          <p className="font-bold text-slate-800 mb-3 text-sm">{label}</p>
          {payload.map((p: any) => (
              <div key={p.name} className="flex items-center justify-between gap-8 mb-1.5">
                  <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <span className="w-2 h-2 rounded-full" style={{background: p.color}}></span>
                      {p.name}
                  </span>
                  <span className="font-mono font-bold text-slate-700 text-sm">{p.value.toFixed(2)}</span>
              </div>
          ))}
        </div>
      );
    }
    return null;
};

export default Dashboard;
