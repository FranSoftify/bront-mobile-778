import createContextHook from '@nkzw/create-context-hook';
import { supabase, getRedirectUrl } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { User, Session } from '@supabase/supabase-js';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // On web, check if we have OAuth tokens in the URL hash
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            // Let Supabase handle the hash automatically
            // The onAuthStateChange will pick up the session
            console.log('OAuth callback detected, processing tokens...');
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.log('Get session error (non-critical):', error.message);
        }
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.log('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Clear the hash from URL after successful auth on web
      if (Platform.OS === 'web' && typeof window !== 'undefined' && _event === 'SIGNED_IN') {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Ignore "Auth session missing" error on sign out - user is already signed out
        if (error.message?.includes('Auth session missing')) {
          console.log('User already signed out');
          setSession(null);
          setUser(null);
          return;
        }
        throw error;
      }
    } catch (error) {
      console.log('Sign out error:', error);
      // Force clear local state even if API fails
      setSession(null);
      setUser(null);
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = getRedirectUrl();
    console.log('Google OAuth redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (error) throw error;

    if (Platform.OS !== 'web' && data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );
      console.log('WebBrowser result:', result);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) throw sessionError;
          return sessionData;
        }
      }
    }

    return data;
  };

  return {
    user,
    session,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
  };
});
