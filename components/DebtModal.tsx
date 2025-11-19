
import React, { useState, useMemo } from 'react';
import { Debt, Entity, Currency, Benchmark, LoanType } from '../types';
import { X, Plus, Trash2, Landmark, Calendar, Percent, Edit2, Search, Filter, ChevronDown, ShieldCheck, FileText, Briefcase } from 'lucide-react';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: Debt[];
  onAdd: (debt: Debt) => void;
  onUpdate: (debt: Debt) => void;
  onDelete: (id: string) => void;
}

const DebtModal: React.FC<DebtModalProps> = ({ isOpen, onClose, debts, onAdd, onUpdate, onDelete }) => {
  const [view, setView] = useState<'LIST' | 'FORM'>('LIST');
  const [filterEntity, setFilterEntity] = useState<Entity | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const defaultFormState: Partial<Debt> = {
    name: '',
    bankName: '',
    loanType: LoanType.BILATERAL,
    entity: Entity.PROPERTY,
    currency: Currency.RMB,
    principal: 0,
    baseRate: 3.0,
    benchmark: Benchmark.SHIBOR,
    spread: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 3)).toISOString().split('T')[0],
    frequency: 'QUARTERLY',
    status: 'PLANNED',
    guarantor: '',
    remarks: ''
  };

  const [formData, setFormData] = useState<Partial<Debt>>(defaultFormState);
  const [isEditing, setIsEditing] = useState(false);

  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
        const matchesEntity = filterEntity === 'ALL' || d.entity === filterEntity;
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              d.bankName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesEntity && matchesSearch;
    });
  }, [debts, filterEntity, searchTerm]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
      setFormData(defaultFormState);
      setIsEditing(false);
      setView('FORM');
  };

  const handleOpenEdit = (debt: Debt) => {
      setFormData({ ...debt });
      setIsEditing(true);
      setView('FORM');
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.principal) return alert("请填写必要信息");
    
    const payload = {
        ...formData,
        principal: Number(formData.principal),
        baseRate: Number(formData.baseRate),
        spread: Number(formData.spread),
    } as Debt;

    if (isEditing && formData.id) {
        onUpdate(payload);
    } else {
        onAdd({ ...payload, id: Math.random().toString(36).substr(2, 9) });
    }
    setView('LIST');
  };

  // Helper to calc progress
  const getProgress = (start: string, end: string) => {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      const now = new Date().getTime();
      if (now < s) return 0;
      if (now > e) return 100;
      return ((now - s) / (e - s)) * 100;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-[1200px] w-full overflow-hidden flex flex-col h-[90vh] ring-1 ring-white/10">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex justify-between items-center flex-shrink-0 border-b border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Landmark size={20} className="text-white"/>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg tracking-wide">集团债务台账系统 (Debt Management System)</h3>
                        <p className="text-xs text-indigo-200 opacity-80">全口径融资管理 • 动态本息测算 • 期限结构监控</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={18}/></button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
                {view === 'LIST' ? (
                    <div className="flex-1 flex flex-col h-full">
                        {/* Toolbar */}
                        <div className="bg-white p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="搜索合约 / 银行 / 票据..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 border rounded-lg text-sm w-64 transition-all outline-none"
                                    />
                                </div>
                                <div className="h-8 w-px bg-slate-200 mx-1"></div>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    <button onClick={() => setFilterEntity('ALL')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterEntity === 'ALL' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>全部</button>
                                    <button onClick={() => setFilterEntity(Entity.PROPERTY)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterEntity === Entity.PROPERTY ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>越秀地产</button>
                                    <button onClick={() => setFilterEntity(Entity.ENTERPRISE)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterEntity === Entity.ENTERPRISE ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}>越秀企业</button>
                                </div>
                             </div>

                             <button onClick={handleOpenAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95">
                                <Plus size={16} /> 新增融资合约
                             </button>
                        </div>
                        
                        {/* Data Table */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-200">主体 / 状态</th>
                                        <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-200">合约名称 & 银行</th>
                                        <th className="text-right text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-200">本金余额 (亿)</th>
                                        <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-200">定价 (Pricing)</th>
                                        <th className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-200 w-48">期限进度 (Tenor)</th>
                                        <th className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider px-6 py-3 border-b border-slate-200">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredDebts.map(d => {
                                        const progress = getProgress(d.startDate, d.endDate);
                                        const isMature = progress >= 100;
                                        
                                        return (
                                        <tr key={d.id} className="hover:bg-slate-50 group transition-colors">
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${d.entity === Entity.PROPERTY ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                                        {d.entity}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                        {d.status === 'ACTIVE' ? '存续中' : '计划中'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-800">{d.name}</span>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1"><Landmark size={12}/> {d.bankName}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <span>{d.loanType}</span>
                                                    </div>
                                                    {d.guarantor && (
                                                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                                                            <ShieldCheck size={10}/> {d.guarantor}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-right">
                                                <span className="text-sm font-bold text-slate-800 font-mono block">{d.principal.toFixed(2)}</span>
                                                <span className="text-xs text-slate-400 font-bold">{d.currency}</span>
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <div className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200 inline-block">
                                                    {d.benchmark} +{d.spread} bps
                                                </div>
                                                <div className="mt-1 text-[10px] text-slate-400">
                                                    ALL-IN: ~{(d.baseRate + d.spread/100).toFixed(2)}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top">
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                                                    <div className={`h-full rounded-full ${isMature ? 'bg-slate-400' : 'bg-indigo-500'}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                                                </div>
                                                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                                    <span>{d.startDate}</span>
                                                    <span>{d.endDate}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-middle text-center">
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleOpenEdit(d)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="编辑">
                                                        <Edit2 size={16}/>
                                                    </button>
                                                    <button onClick={() => onDelete(d.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="删除">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                            {filteredDebts.length === 0 && (
                                <div className="text-center py-20 text-slate-400">
                                    <FileText size={40} className="mx-auto mb-4 opacity-20"/>
                                    <p>未找到符合条件的债务记录</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* --- FORM VIEW --- */
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                        <div className="max-w-5xl mx-auto">
                             <div className="flex justify-between items-center mb-6">
                                <h4 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    {isEditing ? <Edit2 size={20} className="text-indigo-600"/> : <Plus size={20} className="text-indigo-600"/>}
                                    {isEditing ? '编辑债务条款' : '录入新融资合约'}
                                </h4>
                                <div className="flex gap-3">
                                    <button onClick={() => setView('LIST')} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                                    <button onClick={handleSubmit} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg transition-colors">
                                        {isEditing ? '保存变更' : '确认录入'}
                                    </button>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left Column: Basic Info */}
                                <div className="lg:col-span-2 space-y-6">
                                    <Section title="基础信息 (Basic Information)">
                                        <div className="grid grid-cols-2 gap-5">
                                            <InputGroup label="合约名称 / 项目" value={formData.name} onChange={v => setFormData({...formData, name: v})} placeholder="例: 2024 银团贷款" colSpan={2} />
                                            <InputGroup label="牵头行 / 交易对手" value={formData.bankName} onChange={v => setFormData({...formData, bankName: v})} placeholder="例: 中国银行 (香港)" />
                                            <SelectGroup label="融资类型" value={formData.loanType} onChange={v => setFormData({...formData, loanType: v})} options={Object.values(LoanType)} />
                                            <SelectGroup label="归属实体" value={formData.entity} onChange={v => setFormData({...formData, entity: v})} options={[Entity.PROPERTY, Entity.ENTERPRISE]} />
                                            <SelectGroup label="合约状态" value={formData.status} onChange={v => setFormData({...formData, status: v})} options={['ACTIVE', 'PLANNED', 'SETTLED']} />
                                            <InputGroup label="担保方 / 增信措施" value={formData.guarantor} onChange={v => setFormData({...formData, guarantor: v})} placeholder="例: 越秀集团提供全额担保" colSpan={2}/>
                                        </div>
                                    </Section>

                                    <Section title="期限与还款 (Term & Repayment)">
                                        <div className="grid grid-cols-3 gap-5">
                                            <InputGroup label="起息日 (Start Date)" type="date" value={formData.startDate} onChange={v => setFormData({...formData, startDate: v})} />
                                            <InputGroup label="到期日 (Maturity)" type="date" value={formData.endDate} onChange={v => setFormData({...formData, endDate: v})} />
                                            <SelectGroup label="付息频率" value={formData.frequency} onChange={v => setFormData({...formData, frequency: v})} options={['MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'AT_MATURITY']} />
                                        </div>
                                    </Section>

                                    <Section title="备注说明 (Remarks)">
                                        <textarea 
                                            value={formData.remarks}
                                            onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-24 resize-none"
                                            placeholder="填写资金用途、特殊条款或其他备注..."
                                        ></textarea>
                                    </Section>
                                </div>

                                {/* Right Column: Financials */}
                                <div className="space-y-6">
                                    <Section title="金额与币种 (Principal)">
                                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">本金规模 (Millions)</label>
                                            <div className="flex gap-2 mb-4">
                                                <select className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as Currency})}>
                                                    {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <input type="number" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-lg font-mono font-bold outline-none focus:border-indigo-500 text-indigo-900" value={formData.principal} onChange={e => setFormData({...formData, principal: parseFloat(e.target.value)})} />
                                            </div>
                                            <p className="text-[10px] text-indigo-400 leading-tight">
                                                * 请输入原币种金额。系统将自动按实时汇率折算。
                                            </p>
                                        </div>
                                    </Section>

                                    <Section title="定价条款 (Pricing)">
                                        <div className="space-y-4">
                                            <SelectGroup label="基准利率 (Benchmark)" value={formData.benchmark} onChange={v => setFormData({...formData, benchmark: v})} options={Object.values(Benchmark)} />
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <InputGroup label="当前基准 (%)" type="number" value={formData.baseRate} onChange={v => setFormData({...formData, baseRate: parseFloat(v)})} />
                                                <InputGroup label="加点 (bps)" type="number" value={formData.spread} onChange={v => setFormData({...formData, spread: parseFloat(v)})} />
                                            </div>

                                            <div className="bg-slate-100 p-3 rounded-lg flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-500">预计综合成本</span>
                                                <span className="text-lg font-bold text-slate-800 font-mono">
                                                    {((Number(formData.baseRate) || 0) + (Number(formData.spread) || 0)/100).toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    </Section>
                                </div>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

// --- Subcomponents ---

const Section = ({ title, children }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">{title}</h5>
        {children}
    </div>
);

const InputGroup = ({ label, type = "text", value, onChange, placeholder, colSpan = 1 }: any) => (
    <div className={colSpan > 1 ? `col-span-${colSpan}` : ''}>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder={placeholder} />
    </div>
);

const SelectGroup = ({ label, value, onChange, options }: any) => (
    <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all">
            {options.map((o: any) => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

export default DebtModal;
