
import { Entity, Transaction, ExchangeRates, TransactionCategory, TransactionStatus, Debt, Currency, Benchmark, LoanType } from './types';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_RATES: ExchangeRates = {
  HKD_TO_RMB: 0.92,
  USD_TO_RMB: 7.23 
};

// Helper to generate ID (mock)
const genId = () => Math.random().toString(36).substr(2, 9);

// Helper to generate date relative to today
const getDate = (monthOffset: number, day: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset);
  d.setDate(day);
  return d.toISOString().split('T')[0];
};

// 1. Define Core Debt Instruments (The "Truth" of Financing)
export const INITIAL_DEBTS: Debt[] = [
  {
    id: 'd-001',
    name: '2023 合作银行定期贷款 A',
    bankName: '合作银行 A (HK)',
    loanType: LoanType.BILATERAL,
    entity: Entity.ENTERPRISE,
    currency: Currency.HKD,
    principal: 20.0, // 20亿 HKD
    baseRate: 4.5,
    benchmark: Benchmark.HIBOR,
    spread: 150,
    startDate: getDate(-6, 1),
    endDate: getDate(18, 1),
    frequency: 'QUARTERLY',
    status: 'ACTIVE',
    guarantor: '信用',
    remarks: '用于置换旧债'
  },
  {
    id: 'd-002',
    name: '2024 境内中期票据 (MTN)',
    bankName: '头部券商 B / 券商 C',
    loanType: LoanType.NOTES,
    entity: Entity.PROPERTY,
    currency: Currency.RMB,
    principal: 30.0, // 30亿 RMB
    baseRate: 3.2,
    benchmark: Benchmark.SHIBOR,
    spread: 80,
    startDate: getDate(-3, 15),
    endDate: getDate(33, 15),
    frequency: 'SEMI_ANNUALLY',
    status: 'ACTIVE',
    guarantor: '集团全额担保'
  },
  {
    id: 'd-003',
    name: '2025 拟发行美元优先票据',
    bankName: '国际投行 D',
    loanType: LoanType.BOND,
    entity: Entity.PROPERTY,
    currency: Currency.USD,
    principal: 5.0, // 5亿 USD
    baseRate: 5.5,
    benchmark: Benchmark.SOFR,
    spread: 220,
    startDate: getDate(2, 1), // Future plan
    endDate: getDate(62, 1),
    frequency: 'SEMI_ANNUALLY',
    status: 'PLANNED',
    remarks: '待监管机构备案'
  },
  {
    id: 'd-004',
    name: '2023 俱乐部贷款 (Club Loan)',
    bankName: '银团 E / 银团 F',
    loanType: LoanType.SYNDICATED,
    entity: Entity.ENTERPRISE,
    currency: Currency.HKD,
    principal: 15.0,
    baseRate: 4.8,
    benchmark: Benchmark.HIBOR,
    spread: 110,
    startDate: getDate(-12, 10),
    endDate: getDate(24, 10),
    frequency: 'QUARTERLY',
    status: 'ACTIVE'
  }
];

const generateOperatingMockData = (): Transaction[] => {
  const data: Transaction[] = [];
  
  // Generate Operating/Investing data ONLY (Financing comes from Debt Engine)
  for (let i = -3; i <= 15; i++) {
    const isForecast = i > 0;
    const status = isForecast ? TransactionStatus.FORECAST : TransactionStatus.ACTUAL;
    
    // --- 1. Operating Cash Flow ---
    
    // Property Sales Collection
    const salesVolume = 15 + Math.random() * 10;
    data.push({
      id: genId(), date: getDate(i, 5), entity: Entity.PROPERTY, category: TransactionCategory.OPERATING,
      description: '销售回款归集', amountHKD: 0, amountRMB: parseFloat(salesVolume.toFixed(2)), amountUSD: 0, status
    });

    // Construction Payments
    const constructionCost = -(10 + Math.random() * 5);
    data.push({
      id: genId(), date: getDate(i, 25), entity: Entity.PROPERTY, category: TransactionCategory.OPERATING,
      description: '支付工程款项', amountHKD: 0, amountRMB: parseFloat(constructionCost.toFixed(2)), amountUSD: 0, status
    });

    // Investment Income
    if (i % 3 === 0) {
      data.push({
        id: genId(), date: getDate(i, 15), entity: Entity.ENTERPRISE, category: TransactionCategory.INVESTING,
        description: '收取联营公司股息', amountHKD: 5.0, amountRMB: 0, amountUSD: 0, status
      });
    }

    // --- 2. Internal Allocation ---
    if (i % 2 === 0) {
        data.push({
            id: genId(), date: getDate(i, 28), entity: Entity.ENTERPRISE, category: TransactionCategory.INTERNAL,
            description: '向地产分部调拨资金支持', amountHKD: 0, amountRMB: -5.0, amountUSD: 0, status
        });
        data.push({
            id: genId(), date: getDate(i, 28), entity: Entity.PROPERTY, category: TransactionCategory.INTERNAL,
            description: '收总部资金支持', amountHKD: 0, amountRMB: 5.0, amountUSD: 0, status
        });
    }
  }

  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const INITIAL_TRANSACTIONS: Transaction[] = generateOperatingMockData();

export const INITIAL_BALANCES = {
  [Entity.PROPERTY]: { HKD: 15.50, RMB: 25.00, USD: 8.00 }, 
  [Entity.ENTERPRISE]: { HKD: 45.00, RMB: 30.00, USD: 12.00 }
};