
import { createClient } from '@supabase/supabase-js';
import { Transaction } from '../types';

// Helper to safely get environment variables in both Vite and Standard environments
// This prevents "ReferenceError: process is not defined" which causes white screens
const getEnvVar = (key: string): string | undefined => {
  // 1. Try Vite's import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // ignore
  }

  // 2. Try Node/Process env
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // ignore
  }

  return undefined;
};

const urlRaw = getEnvVar('VITE_SUPABASE_URL');
const keyRaw = getEnvVar('VITE_SUPABASE_KEY');

// Trim to prevent copy-paste errors and remove potential quotes if user added them
const cleanVar = (v: string | undefined) => v?.replace(/["']/g, '').trim();

const supabaseUrl = cleanVar(urlRaw);
const supabaseKey = cleanVar(keyRaw);

// Log connection attempt (Safety: Don't log the full key)
console.log(
  `[Supabase Init] URL: ${supabaseUrl ? 'Found' : 'Missing'}, Key: ${supabaseKey ? 'Found' : 'Missing'}`
);

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isCloudEnabled = !!supabase;

export const fetchCloudTransactions = async (): Promise<Transaction[] | null> => {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*');

    if (error) {
      console.error('Supabase Connection Error:', error.message);
      return null;
    }

    return data as Transaction[];
  } catch (err) {
    console.error('Unexpected Supabase Error:', err);
    return null;
  }
};

export const saveCloudTransaction = async (transaction: Transaction) => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('transactions')
      .upsert(transaction);

    if (error) console.error('Error saving transaction:', error.message);
  } catch (err) {
    console.error('Save failed:', err);
  }
};

export const deleteCloudTransaction = async (id: string) => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting transaction:', error.message);
  } catch (err) {
    console.error('Delete failed:', err);
  }
};
