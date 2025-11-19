import { createClient } from '@supabase/supabase-js';
import { Transaction } from '../types';

// --- SAFE CONFIGURATION LOADER ---
// Only use import.meta.env (Standard Vite). 
// NEVER use process.env as it crashes strict browsers/environments.

const getSafeEnv = (key: string) => {
  try {
    // @ts-ignore
    return import.meta.env[key] || '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL');
const supabaseKey = getSafeEnv('VITE_SUPABASE_KEY');

let client = null;

// Only initialize if BOTH keys are present and look valid (not empty)
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    console.log('[Supabase] Initializing connection...');
    client = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('[Supabase] Init failed, falling back to local mode:', e);
    client = null;
  }
} else {
  console.log('[Supabase] Keys missing or invalid. Using Local Mode.');
}

export const supabase = client;
export const isCloudEnabled = !!supabase;

export const fetchCloudTransactions = async (): Promise<Transaction[] | null> => {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*');

    if (error) {
      console.error('[Supabase] Fetch error:', error.message);
      return null;
    }

    return data as Transaction[];
  } catch (err) {
    console.error('[Supabase] Network error:', err);
    return null;
  }
};

export const saveCloudTransaction = async (transaction: Transaction) => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('transactions')
      .upsert(transaction);

    if (error) console.error('[Supabase] Save error:', error.message);
  } catch (err) {
    console.error('[Supabase] Save exception:', err);
  }
};

export const deleteCloudTransaction = async (id: string) => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) console.error('[Supabase] Delete error:', error.message);
  } catch (err) {
    console.error('[Supabase] Delete exception:', err);
  }
};
