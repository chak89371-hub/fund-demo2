
import { Transaction } from '../types';

// --- FORCE LOCAL MODE ---
// We have completely removed the Supabase client dependency to ensure
// the application runs 100% stable in all network environments (including China).

export const supabase = null;
export const isCloudEnabled = false;

export const fetchCloudTransactions = async (): Promise<Transaction[] | null> => {
  // Always return null to trigger local fallback
  return null;
};

export const saveCloudTransaction = async (transaction: Transaction) => {
  // No-op
};

export const deleteCloudTransaction = async (id: string) => {
  // No-op
};
