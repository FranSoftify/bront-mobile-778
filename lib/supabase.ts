import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';


const supabaseUrl = 'https://auth.bront.ai';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzY3dxa3d5Zm96dXFqZGRvZGhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDYxODYsImV4cCI6MjA2OTAyMjE4Nn0.jtBQ1GHJZkASQCkacadxrx6kto1Pzv65oxodUYKU3qk';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzY3dxa3d5Zm96dXFqZGRvZGhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQ0NjE4NiwiZXhwIjoyMDY5MDIyMTg2fQ.q6q1aT7CEojjAfzoSTemeC3iJAmjveQovgQa3s4oZGc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export const getRedirectUrl = () => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  // Use the app's scheme for native OAuth callback
  return 'rork-app://auth/callback';
};

// Admin client with service role - bypasses RLS for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
