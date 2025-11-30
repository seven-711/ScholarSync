
import { createClient } from '@supabase/supabase-js';

// ⚠️ STEP 1: PASTE YOUR SUPABASE CREDENTIALS HERE
// You can find these in your Supabase Dashboard -> Project Settings -> API
const YOUR_SUPABASE_URL = 'https://zruybvalzrjacdgutkit.supabase.co'; 
const YOUR_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydXlidmFsenJqYWNkZ3V0a2l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjc0MjgsImV4cCI6MjA3OTc0MzQyOH0.CE165R5zrv403grjoYL0MXpqJPRqzg6QOcQDxJm5Cbo';

// Safe access for environment variables (Backup method)
const getEnv = (key: string, viteKey: string) => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[viteKey];
    }
  } catch (e) {}

  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env[key] || process.env[viteKey];
    }
  } catch (e) {}

  return '';
};

// Prioritize the hardcoded variables above, then fall back to env vars
const supabaseUrl = YOUR_SUPABASE_URL || getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseAnonKey = YOUR_SUPABASE_ANON_KEY || getEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  // Simple check: do we have values?
  return !!supabaseUrl && !!supabaseAnonKey && supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
};
