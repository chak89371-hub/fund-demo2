
import { GoogleGenAI } from "@google/genai";
import { Transaction, Entity, ExchangeRates, Currency } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeFinancialData = async (
  transactions: Transaction[],
  rates: ExchangeRates,
  baseCurrency: Currency = Currency.RMB,
  riskParams?: { financingFailRate: number; interestRateAdd: number }
): Promise<string> => {
  if (!process.env.API_KEY) {
    return "错误：未配置 API Key。请确保 process.env.API_KEY 可用。";
  }

  // Helper for conversion logic in the loop
  const getVal = (hkd: number, rmb: number, usd: number) => {
    const valRMB = (hkd * rates.HKD_TO_RMB) + rmb + (usd * rates.USD_TO_RMB);
    if (baseCurrency === Currency.RMB) return valRMB;
    if (baseCurrency === Currency.HKD) return valRMB / rates.HKD_TO_RMB;
    if (baseCurrency === Currency.USD) return valRMB / rates.USD_TO_RMB;
    return valRMB;
  };

  const monthlyData: Record<string, { inflow: number, outflow: number, net: number, notes: string[] }> = {};
  
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sorted.forEach(t => {
    const month = t.date.substring(0, 7);
    if (!monthlyData[month]) {
        monthlyData[month] = { inflow: 0, outflow: 0, net: 0, notes: [] };
    }

    const val = getVal(t.amountHKD, t.amountRMB, t.amountUSD);
    
    if (val > 0) monthlyData[month].inflow += val;
    else monthlyData[month].outflow += Math.abs(val);
    monthlyData[month].net += val;

    // Highlight large transactions
    if (Math.abs(val) > 5) {
        monthlyData[month].notes.push(`${t.entity} ${t.description} (${val.toFixed(1)}亿)`);
    }
  });

  const dataSummary = Object.entries(monthlyData).map(([m, d]) => {
    const noteStr = d.notes.length > 0 ? `重点: ${d.notes.join(', ')}` : '';
    return `| ${m} | 流入: ${d.inflow.toFixed(1)} | 流出: ${d.outflow.toFixed(1)} | 净流: ${d.net.toFixed(1)} | ${noteStr}`;
  }).join('\n');

  const isStressTest = riskParams && (riskParams.financingFailRate > 0 || riskParams.interestRateAdd > 0);
  
  const prompt = `
    你是一位首席财务官(CFO)助理，负责集团总部的资金流动性分析。
    当前报表本位币为: ${baseCurrency}。
    当前汇率设定: HKD/RMB=${rates.HKD_TO_RMB.toFixed(3)}, USD/RMB=${rates.USD_TO_RMB.toFixed(3)}。
    
    ${isStressTest ? `
    【⚠️ 严重警告：当前正处于极端压力测试模式！】
    1. 融资未完成率设定为: ${riskParams.financingFailRate}% (意味着预计的新增贷款/发债有大幅落空的风险)。
    2. 市场利率上浮: +${riskParams.interestRateAdd}% (意味着利息支出成本显著增加)。
    请务必基于以上恶劣环境，严厉评估公司的资金链断裂风险。
    ` : '当前处于标准预测模式。'}

    数据如下（单位：亿元 ${baseCurrency}）：
    ${dataSummary}

    请生成一份简报，包含以下四个部分（使用Markdown格式）：
    
    1.  **流动性预警**: 识别净现金流为负且金额较大的月份。
    2.  **压力测试/风险评估**: ${isStressTest ? '重点分析在融资失败和利率飙升的双重打击下，哪些月份可能出现违约风险。' : '基于当前设定的汇率和现金流情况，评估资金链韧性。'}
    3.  **应对策略**: ${isStressTest ? '在融资渠道受阻的情况下，建议如何出售资产或压缩开支以求生存。' : '针对资金缺口月份，建议融资方式。'}
    4.  **总体评价**: 对未来18个月资金安全打分（1-10分）。${isStressTest ? '分数应严格反映压力环境下的脆弱性。' : ''}

    保持语气专业、客观、精炼。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.2 }
    });
    
    return response.text || "无法生成分析结果。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "分析服务暂时繁忙，请稍后再试。";
  }
};
