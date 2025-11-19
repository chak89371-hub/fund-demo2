
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
    你现在是集团首席财务官(CFO)的AI智能助手。请对当前的资金计划进行简要、犀利的诊断。
    
    【基础信息】
    - 报表本位币: ${baseCurrency}
    - 汇率设定: HKD/RMB=${rates.HKD_TO_RMB.toFixed(3)}, USD/RMB=${rates.USD_TO_RMB.toFixed(3)}
    
    ${isStressTest ? `
    【⚠️ 极端压力测试环境 ACTIVE】
    - 外部融资失败率设定为: ${riskParams.financingFailRate}% (资金渠道严重受阻)
    - 市场利率冲击: +${riskParams.interestRateAdd}% (利息成本飙升)
    请以“底线思维”进行评估，假设最坏情况已经发生。
    ` : '【标准预测模式】基于现有合同和常规预测。'}

    【月度现金流数据 (亿元)】
    ${dataSummary}

    请输出一段**高度浓缩**的决策参考（Markdown格式），包含以下三部分：

    ### 1. 💡 核心洞察 (Insight)
    用一句话指出未来18个月最大的资金风险点或机会点（例如：“2024年Q3存在明显的流动性缺口，主要由XX引起...”）。

    ### 2. 📊 关键指标预警 (Alerts)
    列出净现金流为负且金额最大的2个具体的月份，并注明缺口金额。

    ### 3. 🚀 建议行动 (Action Items)
    给出3条具体的执行建议（例如：“建议立刻启动XX银团贷款置换”、“暂停XX项目支出”、“通过XX手段对冲汇率风险”）。
    
    *要求：不要废话，不要通用套话，只说针对数据的具体结论。*
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.3 }
    });
    
    return response.text || "AI 分析服务暂时无法响应。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "连接 AI 服务超时，请检查网络或 API Key。";
  }
};
