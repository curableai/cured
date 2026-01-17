import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';

// Helper to ensure keys are SecureStore compliant (alphanumeric, ., -, _)
const sanitizeKey = (key) => key.replace(/[^a-zA-Z0-9.\-_]/g, '_');

const SecureStorageAdapter = {
    getItem: (key) => SecureStore.getItemAsync(sanitizeKey(key)),
    setItem: (key, value) => SecureStore.setItemAsync(sanitizeKey(key), value),
    removeItem: (key) => SecureStore.deleteItemAsync(sanitizeKey(key)),
}

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://xyqagdrhbrjtmxcftlfs.supabase.co'
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5cWFnZHJoYnJqdG14Y2Z0bGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTMwNTIsImV4cCI6MjA3MjA2OTA1Mn0.ctkWX6M1tKVLtYp5bMJb81MvWSw79l4-pRKmWnOziAQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: SecureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})
