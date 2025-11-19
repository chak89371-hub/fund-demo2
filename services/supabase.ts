
import { createClient } from '@supabase/supabase-js';
import { Transaction } from '../types';

// Initialize client ONLY if keys are present
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isCloudEnabled = !!supabase;

export const fetchCloudTransactions = async (): Promise<Transaction[] | null> => {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*');

  if (error) {
    console.error('Error fetching transactions:', error);
    return null;
  }

  return data as Transaction[];
};

export const saveCloudTransaction = async (transaction: Transaction) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .upsert(transaction);

  if (error) console.error('Error saving transaction:', error);
};

export const deleteCloudTransaction = async (id: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) console.error('Error deleting transaction:', error);
};
