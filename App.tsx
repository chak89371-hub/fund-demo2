
import React, { useState, useMemo, useRef, useEffect } from 'react';
import FinancialTable from './components/FinancialTable';
import Dashboard from './components/Dashboard';
import FundCalendar from './components/FundCalendar';
import DebtModal from './components/DebtModal';
import { Transaction, Entity, ExchangeRates, TransactionCategory, TransactionStatus, Currency, Debt, Benchmark, LoanType } from './types';
import { INITIAL_TRANSACTIONS, INITIAL_BALANCES, DEFAULT_RATES, INITIAL_DEBTS } from './constants';
import { fetchCloudTransactions, saveCloudTransaction, deleteCloudTransaction, isCloudEnabled } from './services/supabase';
import { LayoutDashboard, Table2, Plus, Building2, ChevronRight, Download, Settings2, RefreshCw, RotateCcw, CalendarDays, X, TrendingUp, AlertTriangle, Landmark, Upload, Search, Filter, DollarSign, Menu, ArrowRightLeft, Cloud, CloudOff, Loader2 } from 'lucide-react';

// Simple ID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRANSACTIONS' | 'CALENDAR'>('DASHBOARD');
  const [manualTransactions, setManualTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>(INITIAL_DEBTS);
  
  // Cloud Sync State
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'CONNECTED' | 'LOCAL'>('LOCAL');

  const [entityFilter, setEntityFilter] = useState<Entity | 'ALL'>('ALL');
  const [isTransModalOpen, setIsTransModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Import Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Simulation State ---
  const [baseCurrency, setBaseCurrency] = useState<Currency>(Currency.RMB);
  const [simRates, setSimRates] = useState<ExchangeRates>({ ...DEFAULT_RATES });
  
  // Professional Risk Factors
  const [financingFailRate, setFinancingFailRate] = useState<number>(0); // 0-100%
  const [shiborShock, setShiborShock] = useState<number>(0); // bps
  const [hiborShock, setHiborShock] = useState<number>(0); // bps
  const [sofrShock, setSofrShock] = useState<number>(0); // bps

  const [showSim, setShowSim] = useState(false);

  // --- INITIAL DATA LOAD (With Safety Timeout) ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // 1. Create a "Soft Timeout" promise
        // Instead of rejecting (which causes error overlays), we resolve to null gracefully.
        const timeoutPromise = new Promise<Transaction[] | null>((resolve) => 
          setTimeout(() => {
            console.warn("Cloud DB connection timed out (likely cold start). Falling back to local.");
            resolve(null);
          }, 5000) // Increased to 5 seconds for cold starts
        );

        // 2. Race the actual fetch against the timeout
        if (isCloudEnabled) {
            const cloudData = await Promise.race([
              fetchCloudTransactions(),
              timeoutPromise
            ]);

            if (cloudData && cloudData.length > 0) {
              setManualTransactions(cloudData);
              setSyncStatus('CONNECTED');
            } else {
              // Either null (timeout/error) or empty array (new DB)
              // If it was a timeout (null), we default to local.
              // If it was empty array, we technically connected, but have no data.
              // For this demo, let's load mock data if empty, but mark connected.
              if (cloudData && cloudData.length === 0) {
                 setManualTransactions(INITIAL_TRANSACTIONS); 
                 setSyncStatus('CONNECTED');
              } else {
                 // Null result = Timeout or Error
                 setManualTransactions(INITIAL_TRANSACTIONS);
                 setSyncStatus('LOCAL');
              }
            }
        } else {
          // No keys configured
          setManualTransactions(INITIAL_TRANSACTIONS);
          setSyncStatus('LOCAL');
        }
      } catch (e) {
        console.error("Initialization error:", e);
        setManualTransactions(INITIAL_TRANSACTIONS);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);


  // --- DEBT ENGINE LOGIC ---
  const debtTransactions = useMemo(() => {
    const generated: Transaction[] = [];

    debts.forEach(debt => {
        const isPlanned = debt.status === 'PLANNED';
        
        // 1. Principal Inflow
        if (isPlanned) {
            const failFactor = (100 - financingFailRate) / 100;
            const effectivePrincipal = debt.principal * failFactor;
            
            generated.push({
                id: `princ-in-${debt.id}`,
                date: debt.startDate,
                entity: debt.entity,
                category: TransactionCategory.FINANCING,
                description: `[提款] ${debt.name} ${financingFailRate > 0 ? `(融资折扣${financingFailRate}%)` : ''}`,
                amountHKD: debt.currency === Currency.HKD ? effectivePrincipal : 0,
                amountRMB: debt.currency === Currency.RMB ? effectivePrincipal : 0,
                amountUSD: debt.currency === Currency.USD ? effectivePrincipal : 0,
                status: TransactionStatus.FORECAST,
                linkedDebtId: debt.id
            });
        }

        // 2. Interest Payments
        let stressRateAdd = 0;
        if (debt.benchmark === Benchmark.SHIBOR) stressRateAdd = shiborShock / 100;
        if (debt.benchmark === Benchmark.HIBOR) stressRateAdd = hiborShock / 100;
        if (debt.benchmark === Benchmark.SOFR) stressRateAdd = sofrShock / 100;

        const effectiveRate = debt.baseRate + stressRateAdd;
        
        let intervalMonths = 1;
        if (debt.frequency === 'QUARTERLY') intervalMonths = 3;
        if (debt.frequency === 'SEMI_ANNUALLY') intervalMonths = 6;
        if (debt.frequency === 'ANNUALLY') intervalMonths = 12;
        if (debt.frequency === 'AT_MATURITY') intervalMonths = 0;

        if (intervalMonths > 0) {
            const start = new Date(debt.startDate);
            const end = new Date(debt.endDate);
            let curr = new Date(start);
            curr.setMonth(curr.getMonth() + intervalMonths);

            while (curr <= end) {
                const interestAmount = -(debt.principal * (effectiveRate / 100) * (intervalMonths / 12));
                const principalFactor = isPlanned ? ((100 - financingFailRate) / 100) : 1;
                const finalInterest = interestAmount * principalFactor;

                generated.push({
                    id: `int-${debt.id}-${curr.toISOString()}`,
                    date: curr.toISOString().split('T')[0],
                    entity: debt.entity,
                    category: TransactionCategory.FINANCING,
                    description: `[利息] ${debt.name} @ ${(effectiveRate).toFixed(2)}%`,
                    amountHKD: debt.currency === Currency.HKD ? finalInterest : 0,
                    amountRMB: debt.currency === Currency.RMB ? finalInterest : 0,
                    amountUSD: debt.currency === Currency.USD ? finalInterest : 0,
                    status: curr > new Date() ? TransactionStatus.FORECAST : TransactionStatus.ACTUAL,
                    linkedDebtId: debt.id
                });

                curr.setMonth(curr.getMonth() + intervalMonths);
            }
        }

        // 3. Principal Repayment
        const principalFactor = isPlanned ? ((100 - financingFailRate) / 100) : 1;
        generated.push({
             id: `princ-out-${debt.id}`,
             date: debt.endDate,
             entity: debt.entity,
             category: TransactionCategory.FINANCING,
             description: `[还本] ${debt.name}`,
             amountHKD: debt.currency === Currency.HKD ? -debt.principal * principalFactor : 0,
             amountRMB: debt.currency === Currency.RMB ? -debt.principal * principalFactor : 0,
             amountUSD: debt.currency === Currency.USD ? -debt.principal * principalFactor : 0,
             status: TransactionStatus.FORECAST,
             linkedDebtId: debt.id
        });

    });

    return generated;
  }, [debts, financingFailRate, shiborShock, hiborShock, sofrShock]);


  // Combine Manual + Debt Transactions
  const allTransactions = useMemo(() => {
      return [...manualTransactions, ...debtTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [manualTransactions, debtTransactions]);

  // Form State
  const defaultTransState = {
    id: '',
    date: new Date().toISOString().split('T')[0],
    entity: Entity.PROPERTY,
    category: TransactionCategory.OPERATING,
    description: '',
    amountHKD: 0,
    amountRMB: 0,
    amountUSD: 0,
    status: TransactionStatus.FORECAST
  };
  
  const [editingTrans, setEditingTrans] = useState<Partial<Transaction>>(defaultTransState);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm('确认删除此记录?')) {
      // Optimistic Update
      setManualTransactions(prev => prev.filter(t => t.id !== id));
      
      if (syncStatus === 'CONNECTED') {
          await deleteCloudTransaction(id);
      }
    }
  };

  const handleEditStart = (transaction: Transaction) => {
      setEditingTrans({ ...transaction });
      setIsEditMode(true);
      setIsTransModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    if (!editingTrans.description) return alert('请输入项目说明');
    
    const transaction: Transaction = {
        id: editingTrans.id || generateId(), 
        date: editingTrans.date!, 
        entity: editingTrans.entity!, 
        category: editingTrans.category!,
        description: editingTrans.description!, 
        amountHKD: Number(editingTrans.amountHKD) || 0,
        amountRMB: Number(editingTrans.amountRMB) || 0, 
        amountUSD: Number(editingTrans.amountUSD) || 0,
        status: editingTrans.status!
    };

    // Optimistic Update
    if (isEditMode) {
        setManualTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
    } else {
        setManualTransactions(prev => [...prev, transaction]);
    }

    if (syncStatus === 'CONNECTED') {
        await saveCloudTransaction(transaction);
    }

    setIsTransModalOpen(false);
    setEditingTrans(defaultTransState);
    setIsEditMode(false);
  };

  const handleOpenAddTrans = () => {
      setEditingTrans(defaultTransState);
      setIsEditMode(false);
      setIsTransModalOpen(true);
  };

  const handleSaveDebt = (debt: Debt) => {
      setDebts(prev => [...prev, debt]);
  };

  const handleUpdateDebt = (debt: Debt) => {
      setDebts(prev => prev.map(d => d.id === debt.id ? debt : d));
  };

  const handleDeleteDebt = (id: string) => {
      if(confirm("删除此债务将清除所有相关的本金及利息计划，确认删除？")) {
          setDebts(prev => prev.filter(d => d.id !== id));
      }
  }

  const resetSimulation = () => {
      setSimRates({ ...DEFAULT_RATES });
      setFinancingFailRate(0);
      setShiborShock(0);
      setHiborShock(0);
      setSofrShock(0);
  };

  const handleExportCSV = () => {
    const filteredData = entityFilter === 'ALL' 
      ? allTransactions 
      : allTransactions.filter(t => t.entity === entityFilter);
    
    const headers = ['日期', '状态', '实体', '类别', '事项说明', 'HKD (亿)', 'RMB (亿)', 'USD (亿)'];
    const rows = filteredData.map(t => [
      t.date, t.status, t.entity, t.category, `"${t.description.replace(/"/g, '""')}"`,
      t.amountHKD.toFixed(2), t.amountRMB.toFixed(2), t.amountUSD.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Corporate_Fund_Plan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        
        try {
            const lines = text.split(/\r\n|\n/);
            const newTrans: Transaction[] = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',');
                if (cols.length < 5) continue;

                const trans: Transaction = {
                    id: generateId(),
                    date: cols[0] || new Date().toISOString().split('T')[0],
                    status: (cols[1] as TransactionStatus) || TransactionStatus.FORECAST,
                    entity: (cols[2] as Entity) || Entity.PROPERTY,
                    category: (cols[3] as TransactionCategory) || TransactionCategory.OPERATING,
                    description: cols[4]?.replace(/"/g, '') || 'CSV 导入',
                    amountHKD: parseFloat(cols[5]) || 0,
                    amountRMB: parseFloat(cols[6]) || 0,
                    amountUSD: parseFloat(cols[7]) || 0,
                };
                newTrans.push(trans);
            }
            if (newTrans.length > 0) {
                setManualTransactions(prev => [...prev, ...newTrans]);
                
                if (syncStatus === 'CONNECTED') {
                    newTrans.forEach(t => saveCloudTransaction(t));
                }
                
                alert(`成功导入 ${newTrans.length} 条交易记录！`);
            } else {
                alert("未能解析出有效数据，请检查CSV格式");
            }
        } catch (err) {
            console.error(err);
            alert("文件解析出错");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const refreshData = async () => {
      if (syncStatus !== 'CONNECTED') return;
      setLoading(true);
      const cloudData = await fetchCloudTransactions();
      if (cloudData) setManualTransactions(cloudData);
      setLoading(false);
  };

  // Determine if we are in a non-standard scenario
  const isStressTesting = financingFailRate > 0 || Math.abs(shiborShock) > 0 || Math.abs(hiborShock) > 0 || Math.abs(sofrShock) > 0;

  if (loading && manualTransactions.length === 0) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f172a] text-white">
              <Loader2 size={48} className="animate-spin text-indigo-500 mb-4"/>
              <h2 className="text-xl font-bold">正在连接加密资金数据库...</h2>
              <p className="text-slate-400 text-sm mt-2">Connecting to Secure Cloud Environment</p>
          </div>
      )
  }

  return (
    <div className="flex h-screen bg-[#f1f5f9] font-sans overflow-hidden text-slate-900">
      
      {/* Mobile Sidebar Overlay */}
      <div className={`fixed inset-0 bg-slate-900/50 z-40 transition-opacity md:hidden ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)}></div>

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#0f172a] flex flex-col transition-transform duration-300 shadow-2xl
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${!sidebarOpen && 'md:w-20'}
      `}>
        {/* Sidebar Content */}
        <div className="h-20 flex items-center px-5 relative z-10 border-b border-slate-800/50 bg-[#0f172a]">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                <Building2 size={22} />
            </div>
            {sidebarOpen && (
                <div className="ml-4 whitespace-nowrap">
                    <h1 className="text-white font-bold text-lg">集团资金通</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                         <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                         <p className="text-[10px] text-slate-400 font-medium uppercase">
                             {syncStatus === 'CONNECTED' ? 'Cloud Synced' : 'Local Demo Mode'}
                         </p>
                    </div>
                </div>
            )}
        </div>

        <div className="flex-1 py-8 space-y-1 px-3 overflow-y-auto bg-[#0f172a]">
            <NavButton active={activeTab === 'DASHBOARD'} onClick={() => { setActiveTab('DASHBOARD'); setMobileMenuOpen(false); }} icon={<LayoutDashboard size={20} />} label="全景驾驶舱" open={sidebarOpen} />
            <NavButton active={activeTab === 'CALENDAR'} onClick={() => { setActiveTab('CALENDAR'); setMobileMenuOpen(false); }} icon={<CalendarDays size={20} />} label="资金日历" open={sidebarOpen} />
            <NavButton active={activeTab === 'TRANSACTIONS'} onClick={() => { setActiveTab('TRANSACTIONS'); setMobileMenuOpen(false); }} icon={<Table2 size={20} />} label="交易明细账" open={sidebarOpen} />

            <div className="my-6 border-t border-slate-800/50 mx-2"></div>
             
             <button 
                onClick={() => { setIsDebtModalOpen(true); setMobileMenuOpen(false); }}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-slate-400 hover:bg-slate-800/80 hover:text-white`}
            >
                <div className="text-indigo-400"><Landmark size={20} /></div>
                {sidebarOpen && <span className="ml-3 font-medium text-sm">债务融资台账</span>}
            </button>

             <button 
                onClick={() => { setShowSim(!showSim); setMobileMenuOpen(false); }}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group mt-1 ${showSim ? 'bg-amber-950/30 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'}`}
            >
                <div className={`transition-transform duration-300 ${showSim ? 'rotate-90' : ''}`}>
                    <Settings2 size={20} />
                </div>
                {sidebarOpen && <span className="ml-3 font-medium text-sm">压力测试沙箱</span>}
            </button>
        </div>

        <div className="p-4 border-t border-slate-800/50 hidden md:block bg-[#0f172a]">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded-xl w-full flex justify-center text-slate-500 transition-colors">
                {sidebarOpen ? <ChevronRight className="rotate-180"/> : <ChevronRight />}
             </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative bg-[#f8fafc]">
        
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-20 flex-shrink-0 sticky top-0 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Menu size={24} />
                </button>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 truncate">
                    {activeTab === 'DASHBOARD' && <><LayoutDashboard size={20} className="text-indigo-600 hidden sm:block"/> 资金全景驾驶舱</>}
                    {activeTab === 'CALENDAR' && <><CalendarDays size={20} className="text-indigo-600 hidden sm:block"/> 资金运作日历</>}
                    {activeTab === 'TRANSACTIONS' && <><Table2 size={20} className="text-indigo-600 hidden sm:block"/> 交易明细台账</>}
                </h2>
            </div>

            <div className="flex items-center gap-3 md:gap-6">
                
                {/* Sync Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
                    {syncStatus === 'CONNECTED' ? (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                            <Cloud size={14} />
                            <span className="text-[10px] font-bold">云端已连接</span>
                            <button onClick={refreshData} className="ml-1 hover:text-emerald-800" title="刷新数据">
                                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                            </button>
                        </div>
                    ) : (
                         <div className="flex items-center gap-1.5 text-slate-400">
                            <CloudOff size={14} />
                            <span className="text-[10px] font-bold">本地演示模式</span>
                        </div>
                    )}
                </div>

                <div className="hidden md:flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/50">
                    {Object.values(Currency).map((c) => (
                        <button
                            key={c}
                            onClick={() => setBaseCurrency(c)}
                            className={`px-4 py-1 text-xs font-bold rounded-md transition-all shadow-sm ${baseCurrency === c ? 'bg-white text-indigo-700 shadow ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={handleOpenAddTrans}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 md:px-4 md:py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
                >
                    <Plus size={18} />
                    <span className="hidden md:inline">新增事项</span>
                </button>
            </div>
        </header>

        {/* RISK SANDBOX (Collapsible) */}
        <div className={`bg-slate-900 text-white overflow-hidden transition-all duration-500 ease-in-out shadow-inner border-b border-slate-800 ${showSim ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-6 md:p-8 bg-gradient-to-b from-slate-900 to-slate-950 overflow-y-auto max-h-[600px]">
                <div className="max-w-[1400px] mx-auto">
                     <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 ring-1 ring-amber-500/30">
                                <RefreshCw size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-white tracking-wide">资金压力测试沙箱 (Risk Sandbox)</h3>
                                <p className="text-xs text-slate-400">模拟极端市场环境下的资金链韧性</p>
                            </div>
                        </div>
                        <button 
                            onClick={resetSimulation} 
                            className="text-xs flex items-center gap-2 text-slate-300 hover:text-white transition-colors px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 w-fit"
                        >
                            <RotateCcw size={14} /> 重置参数
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Exchange Rates */}
                        <div className="space-y-5 md:border-r border-slate-800 md:pr-8">
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">FX 汇率波动</p>
                            <div className="space-y-6">
                                <RangeInput label="HKD/RMB" val={simRates.HKD_TO_RMB} min={0.8} max={1.1} step={0.005} format={(v: number) => v.toFixed(3)} onChange={(v: number) => setSimRates(p => ({...p, HKD_TO_RMB: v}))} />
                                <RangeInput label="USD/RMB" val={simRates.USD_TO_RMB} min={6.5} max={8.0} step={0.005} format={(v: number) => v.toFixed(3)} onChange={(v: number) => setSimRates(p => ({...p, USD_TO_RMB: v}))} />
                            </div>
                        </div>

                        {/* Interest Rate Shock (Granular) */}
                        <div className="space-y-5 lg:col-span-2 md:px-4 md:border-r border-slate-800">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <ArrowRightLeft size={12} className="text-rose-400"/> 
                                市场利率浮动 (Interest Rate Fluctuation)
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <RangeInput label="SHIBOR 浮动" val={shiborShock} min={-200} max={200} step={10} format={(v: number) => `${v > 0 ? '+' : ''}${v} bps`} onChange={setShiborShock} color={shiborShock > 0 ? "accent-rose-500" : "accent-emerald-500"}/>
                                <RangeInput label="HIBOR 浮动" val={hiborShock} min={-200} max={200} step={10} format={(v: number) => `${v > 0 ? '+' : ''}${v} bps`} onChange={setHiborShock} color={hiborShock > 0 ? "accent-rose-500" : "accent-emerald-500"}/>
                                <RangeInput label="SOFR 浮动" val={sofrShock} min={-200} max={200} step={10} format={(v: number) => `${v > 0 ? '+' : ''}${v} bps`} onChange={setSofrShock} color={sofrShock > 0 ? "accent-rose-500" : "accent-emerald-500"}/>
                            </div>
                        </div>

                        {/* Financing Failure */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <AlertTriangle size={12} className="text-amber-400"/> 
                                融资落地风险
                            </p>
                            <RangeInput label="融资未完成率" val={financingFailRate} min={0} max={100} step={5} format={(v: number) => `${v}%`} onChange={setFinancingFailRate} color="accent-amber-500"/>
                            
                            <div className={`mt-6 flex items-center justify-center p-3 rounded-xl border ${isStressTesting ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'}`}>
                                <span className="text-xs font-bold">
                                    {isStressTesting ? '⚠️ 压力环境 ACTIVE' : '✅ 标准环境 ACTIVE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Main Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
            <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
                
                {activeTab === 'DASHBOARD' && (
                    <div className="space-y-8">
                        <Dashboard 
                            transactions={allTransactions} 
                            rates={simRates} 
                            startBalances={INITIAL_BALANCES}
                            baseCurrency={baseCurrency}
                            onOpenDebtModal={() => setIsDebtModalOpen(true)}
                        />
                    </div>
                )}

                {activeTab === 'CALENDAR' && (
                    <FundCalendar
                        transactions={allTransactions}
                        baseCurrency={baseCurrency}
                        rates={simRates}
                        startBalances={INITIAL_BALANCES}
                    />
                )}

                {activeTab === 'TRANSACTIONS' && (
                    <div className="space-y-6">
                            <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
                            <div className="flex items-center gap-4 overflow-x-auto pb-1 xl:pb-0">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 whitespace-nowrap px-2">
                                    <Filter size={16} className="text-slate-400"/> 实体筛选:
                                </div>
                                <div className="flex bg-slate-100/80 p-1 rounded-xl">
                                    {(['ALL', Entity.PROPERTY, Entity.ENTERPRISE] as const).map((e) => (
                                        <button
                                            key={e}
                                            onClick={() => setEntityFilter(e)}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${entityFilter === e ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {e === 'ALL' ? '全部实体' : e}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                                <button 
                                    onClick={() => setIsDebtModalOpen(true)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all"
                                >
                                    <Landmark size={16} />
                                    债务台账
                                </button>
                                <div className="h-8 w-px bg-slate-200 my-auto mx-1 hidden md:block"></div>
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleImportCSV}
                                />
                                <button 
                                    onClick={handleImportClick}
                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all"
                                >
                                    <Upload size={16} />
                                    导入
                                </button>
                                <button 
                                    onClick={handleExportCSV}
                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all"
                                >
                                    <Download size={16} />
                                    导出
                                </button>
                            </div>
                        </div>
                        <FinancialTable 
                            transactions={allTransactions} 
                            entityFilter={entityFilter} 
                            rates={simRates} 
                            onDelete={handleDelete}
                            onEdit={handleEditStart}
                            startBalances={INITIAL_BALANCES}
                            baseCurrency={baseCurrency}
                        />
                    </div>
                )}
            </div>
        </main>
      </div>

      {/* Transaction Modal */}
      {isTransModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden ring-1 ring-black/5 transform transition-all my-auto">
                <div className="bg-slate-900 px-6 py-5 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                         {isEditMode ? <Settings2 size={18}/> : <Plus size={18}/>} 
                         {isEditMode ? '编辑收支事项' : '编辑日常收支事项'}
                    </h3>
                    <button onClick={() => setIsTransModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                <div className="p-6 md:p-8 space-y-6">
                     <div className="grid grid-cols-2 gap-5">
                        <InputGroup label="日期" type="date" value={editingTrans.date} onChange={(v: string) => setEditingTrans({...editingTrans, date: v})} />
                        <SelectGroup label="状态" value={editingTrans.status} onChange={(v: string) => setEditingTrans({...editingTrans, status: v as TransactionStatus})} options={[TransactionStatus.FORECAST, TransactionStatus.ACTUAL]} />
                     </div>
                     <div className="grid grid-cols-2 gap-5">
                        <SelectGroup label="归属实体" value={editingTrans.entity} onChange={(v: string) => setEditingTrans({...editingTrans, entity: v as Entity})} options={[Entity.PROPERTY, Entity.ENTERPRISE]} />
                        <SelectGroup label="业务类别" value={editingTrans.category} onChange={(v: string) => setEditingTrans({...editingTrans, category: v as TransactionCategory})} options={Object.values(TransactionCategory)} />
                     </div>
                     <InputGroup label="事项说明" value={editingTrans.description} onChange={(v: string) => setEditingTrans({...editingTrans, description: v})} placeholder="例如：销售回款..." />
                     
                     <div className="bg-slate-50 p-5 rounded-xl space-y-4 border border-slate-200">
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                            <DollarSign size={12}/> 交易金额 (亿)
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <CurrencyInput label="HKD" value={editingTrans.amountHKD} onChange={(v: number) => setEditingTrans({...editingTrans, amountHKD: v})} />
                            <CurrencyInput label="RMB" value={editingTrans.amountRMB} onChange={(v: number) => setEditingTrans({...editingTrans, amountRMB: v})} />
                            <CurrencyInput label="USD" value={editingTrans.amountUSD} onChange={(v: number) => setEditingTrans({...editingTrans, amountUSD: v})} />
                        </div>
                     </div>
                     <button onClick={handleSaveTransaction} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all">
                         {isEditMode ? '保存变更' : '确认添加'}
                     </button>
                </div>
            </div>
        </div>
      )}

      {/* Debt Management Modal */}
      {isDebtModalOpen && (
          <DebtModal 
            isOpen={isDebtModalOpen} 
            onClose={() => setIsDebtModalOpen(false)} 
            debts={debts}
            onAdd={handleSaveDebt}
            onUpdate={handleUpdateDebt}
            onDelete={handleDeleteDebt}
          />
      )}

    </div>
  );
};

// UI Helpers
const NavButton = ({ active, onClick, icon, label, open }: any) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center p-3.5 rounded-xl transition-all duration-200 group relative ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'}`}
    >
        <span className="relative z-10">{icon}</span>
        {open && <span className="ml-3 font-medium text-sm relative z-10 tracking-wide">{label}</span>}
        {active && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/20 rounded-l-full"></div>}
    </button>
);

const RangeInput = ({ label, val, min, max, step, format, onChange, color = 'accent-indigo-500' }: any) => (
    <div>
        <div className="flex justify-between text-xs font-medium mb-1.5">
            <span className="text-slate-300">{label}</span>
            <span className={`font-mono font-bold ${val < 0 ? 'text-emerald-400' : val > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{format(val)}</span>
        </div>
        <input 
            type="range" min={min} max={max} step={step} value={val} onChange={(e) => onChange(parseFloat(e.target.value))}
            className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${color}`}
        />
    </div>
);

const InputGroup = ({ label, type = "text", value, onChange, placeholder }: any) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm text-slate-700 placeholder:text-slate-300" placeholder={placeholder} />
    </div>
);

const SelectGroup = ({ label, value, onChange, options }: any) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
        <div className="relative">
            <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm text-slate-700 appearance-none">
                {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronRight size={14} className="rotate-90"/>
            </div>
        </div>
    </div>
);

const CurrencyInput = ({ label, value, onChange }: any) => (
    <div>
        <label className="block text-[10px] font-bold text-slate-400 mb-1.5 text-center">{label}</label>
        <input type="number" step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-center font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700" />
    </div>
);

export default App;
