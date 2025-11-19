
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
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                        <Landmark size={24} className="text-indigo-300"/>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">债务融资管理台账</h2>
                        <p className="text-sm text-slate-400">Debt Instrument Management</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/5 p-2 rounded-lg hover:bg-white/10">
                    <X size={20}/>
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: List */}
                <div className={`flex-1 flex flex-col bg-slate-50 border-r border-slate-200 ${view === 'FORM' ? 'hidden md:flex md:w-1/3 md:max-w-sm' : 'w-full'}`}>
                    <div className="p-4 space-y-3 border-b border-slate-200 bg-white">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input 
                                type="text" 
                                placeholder="搜索融资项目..." 
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <select 
                                className="flex-1 bg-white border border-slate-200 text-xs rounded-lg px-2 py-2 outline-none font-bold text-slate-600"
                                value={filterEntity}
                                onChange={(e) => setFilterEntity(e.target.value as any)}
                            >
                                <option value="ALL">全部实体</option>
                                <option value={Entity.PROPERTY}>地产分部</option>
                                <option value={Entity.ENTERPRISE}>集团总部</option>
                            </select>
                            <button 
                                onClick={handleOpenAdd}
                                className="flex items-center gap-1 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <Plus size={14}/> 新增融资
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {filteredDebts.map(debt => (
                            <div 
                                key={debt.id} 
                                onClick={() => handleOpenEdit(debt)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md group ${isEditing && formData.id === debt.id ? 'bg-white border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${debt.currency === 'RMB' ? 'bg-rose-50 text-rose-600 border-rose-100' : debt.currency === 'USD' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        {debt.currency}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${debt.status === 'ACTIVE' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {debt.status === 'ACTIVE' ? '存续中' : '计划中'}
                                    </span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight group-hover:text-indigo-700 transition-colors">{debt.name}</h4>
                                <p className="text-xs text-slate-500 mb-3">{debt.bankName}</p>
                                
                                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                                    <div>
                                        <span className="block text-[10px] text-slate-400 uppercase">本金 (亿)</span>
                                        <span className="font-mono font-bold text-slate-800">{debt.principal.toFixed(2)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-slate-400 uppercase">利率</span>
                                        <span className="font-mono font-bold text-indigo-600">{debt.baseRate}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Form / Details */}
                <div className={`flex-1 bg-white flex flex-col ${view === 'LIST' ? 'hidden md:flex' : 'flex'} z-20 md:z-0 absolute md:relative inset-0 md:inset-auto`}>
                    {view === 'FORM' ? (
                         <>
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        {isEditing ? <Edit2 size={18} className="text-indigo-500"/> : <Plus size={18} className="text-indigo-500"/>}
                                        {isEditing ? '编辑债务合同' : '录入新融资合同'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">请完善该笔融资的核心条款信息</p>
                                </div>
                                <div className="flex gap-2">
                                    {isEditing && (
                                        <button onClick={() => onDelete(formData.id!)} className="p-2 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors" title="删除">
                                            <Trash2 size={20}/>
                                        </button>
                                    )}
                                    <button onClick={() => setView('LIST')} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                                        <X size={20}/>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                     <div className="col-span-2">
                                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">融资项目名称</label>
                                         <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例如：2024年第一期中期票据"/>
                                     </div>
                                     <div>
                                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">交易对手 / 银行</label>
                                         <input className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                                            value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})}/>
                                     </div>
                                     <div>
                                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">融资类型</label>
                                         <select className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.loanType} onChange={e => setFormData({...formData, loanType: e.target.value as any})}>
                                            {Object.values(LoanType).map(t => <option key={t} value={t}>{t}</option>)}
                                         </select>
                                     </div>
                                </div>

                                <div className="bg-indigo-50/50 rounded-2xl p-6 mb-6 border border-indigo-100">
                                    <h4 className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2"><Briefcase size={16}/> 核心财务条款</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">本金金额 (亿)</label>
                                            <input type="number" className="w-full p-2 bg-white border border-indigo-200 rounded-lg font-mono font-bold text-indigo-700"
                                                value={formData.principal} onChange={e => setFormData({...formData, principal: parseFloat(e.target.value)})}/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">币种</label>
                                            <select className="w-full p-2 bg-white border border-indigo-200 rounded-lg font-bold text-indigo-700 text-sm"
                                                value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value as any})}>
                                                {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">年化利率 (%)</label>
                                            <div className="relative">
                                                <input type="number" className="w-full p-2 bg-white border border-indigo-200 rounded-lg font-mono font-bold text-indigo-700"
                                                    value={formData.baseRate} onChange={e => setFormData({...formData, baseRate: parseFloat(e.target.value)})}/>
                                                <Percent size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-300"/>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">基准利率</label>
                                            <select className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm text-slate-700"
                                                value={formData.benchmark} onChange={e => setFormData({...formData, benchmark: e.target.value as any})}>
                                                {Object.values(Benchmark).map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">点差 (bps)</label>
                                            <input type="number" className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm text-slate-700"
                                                value={formData.spread} onChange={e => setFormData({...formData, spread: parseFloat(e.target.value)})}/>
                                        </div>
                                         <div>
                                            <label className="block text-[10px] font-bold text-indigo-400 uppercase mb-1">付息频率</label>
                                            <select className="w-full p-2 bg-white border border-indigo-200 rounded-lg text-sm text-slate-700"
                                                value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})}>
                                                <option value="MONTHLY">每月</option>
                                                <option value="QUARTERLY">每季</option>
                                                <option value="SEMI_ANNUALLY">每半年</option>
                                                <option value="ANNUALLY">每年</option>
                                                <option value="AT_MATURITY">到期一次还本付息</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div>
                                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"><Calendar size={12} className="inline mr-1"/> 起息日</label>
                                         <input type="date" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm"
                                            value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})}/>
                                    </div>
                                    <div>
                                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"><Calendar size={12} className="inline mr-1"/> 到期日</label>
                                         <input type="date" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm"
                                            value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})}/>
                                    </div>
                                </div>
                                
                                <div className="mb-6">
                                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">增信措施 / 担保人</label>
                                     <div className="relative">
                                        <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        <input className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm" 
                                            value={formData.guarantor} onChange={e => setFormData({...formData, guarantor: e.target.value})} placeholder="例如：集团全额担保"/>
                                     </div>
                                </div>

                                <div className="flex justify-end pt-6 border-t border-slate-100">
                                    <button onClick={() => setView('LIST')} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl mr-3 transition-colors">取消</button>
                                    <button onClick={handleSubmit} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                                        {isEditing ? '保存变更' : '确认录入'}
                                    </button>
                                </div>
                            </div>
                         </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10">
                            <Landmark size={64} className="mb-4 opacity-20"/>
                            <p className="font-medium">请选择左侧债务项目查看详情或编辑</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default DebtModal;
