
import { createClient } from '@supabase/supabase-js';
import { Transaction } from '../types';

// Initialize client ONLY if keys are present
// trim() prevents connection errors if user accidentally copies whitespace
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = process.env.VITE_SUPABASE_KEY?.trim();

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
    console.error('Supabase Connection Error:', error.message);
    console.error('Hint: Check if your table exists and Row Level Security (RLS) policies are set (or RLS is disabled for this demo).');
    return null;
  }

  return data as Transaction[];
};

export const saveCloudTransaction = async (transaction: Transaction) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .upsert(transaction);

  if (error) console.error('Error saving transaction:', error.message);
};

export const deleteCloudTransaction = async (id: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) console.error('Error deleting transaction:', error.message);
};
