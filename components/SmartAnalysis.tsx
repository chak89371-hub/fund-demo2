
import React, { useState } from 'react';
import { analyzeFinancialData } from '../services/gemini';
import { Transaction, ExchangeRates, Currency } from '../types';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';

interface SmartAnalysisProps {
  transactions: Transaction[];
  rates: ExchangeRates;
  baseCurrency: Currency;
  riskParams?: {
      financingFailRate: number;
      interestRateAdd: number;
  };
}

const SmartAnalysis: React.FC<SmartAnalysisProps> = ({ transactions, rates, baseCurrency, riskParams }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await analyzeFinancialData(transactions, rates, baseCurrency, riskParams);
      setAnalysis(result);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-1 shadow-xl relative overflow-hidden group">
       <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
       {/* Decorative background elements */}
       <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-purple-500 rounded-full opacity-20 blur-3xl group-hover:opacity-30 transition-opacity duration-1000"></div>
       <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-indigo-500 rounded-full opacity-20 blur-3xl group-hover:opacity-30 transition-opacity duration-1000"></div>

      <div className="relative z-10 bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl border border-white/20 shadow-inner">
                <Sparkles className="text-indigo-300" size={24} />
            </div>
            <div className="flex flex-col">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-indigo-200">
                    AI 智能财务分析 (基于{baseCurrency}本位)
                </h3>
                <div className="flex items-center gap-2">
                     <p className="text-xs text-indigo-200/70">由 Google Gemini 2.5 Flash 提供支持</p>
                    {riskParams && (riskParams.financingFailRate > 0 || riskParams.interestRateAdd > 0) && (
                        <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                            <AlertCircle size={10}/> 压力测试模式
                        </span>
                    )}
                </div>
            </div>
          </div>
          {!analysis && !loading && (
             <button 
                onClick={handleAnalyze}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2 hover:scale-105 active:scale-95"
             >
                <Sparkles size={18} />
                开始智能诊断
             </button>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-white/5 rounded-xl border border-white/5">
            <Loader2 className="animate-spin text-indigo-300" size={40} />
            <p className="text-indigo-200 animate-pulse font-medium">Gemini 正在读取财务模型并进行压力测试...</p>
          </div>
        )}

        {analysis && (
          <div className="mt-6 bg-slate-800/50 rounded-xl p-8 border border-white/10 shadow-inner">
            <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                <Markdown>{analysis}</Markdown>
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                <button 
                    onClick={handleAnalyze}
                    className="text-sm text-indigo-300 hover:text-white hover:underline flex items-center gap-2 transition-colors"
                >
                    <Sparkles size={14} /> 重新生成分析报告
                </button>
            </div>
          </div>
        )}

        {error && (
           <div className="mt-4 p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-200 flex items-center gap-3">
                <AlertCircle size={20} />
                <span className="font-medium">分析服务暂时不可用，请检查网络或 API Key 设置。</span>
           </div>
        )}
      </div>
    </div>
  );
};

export default SmartAnalysis;
