import createContextHook from '@nkzw/create-context-hook';
import { supabase, supabaseAdmin, getRedirectUrl } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
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

  const deleteAccount = async () => {
    if (!user) {
      throw new Error('No user logged in');
    }

    const userId = user.id;
    console.log('Deleting account for user:', userId);

    try {
      // Delete user using admin client
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        throw deleteError;
      }

      console.log('User deleted successfully');

      // Sign out and clear local state
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);

      return true;
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  };

  const checkIfNewUser = async (userId: string, createdAt: string): Promise<boolean> => {
    const createdTime = new Date(createdAt).getTime();
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    
    if (createdTime > fiveSecondsAgo) {
      console.log('User appears to be newly created (within last 5 seconds)');
      return true;
    }
    return false;
  };

  const handleNewUserDenied = async (userId: string) => {
    console.log('New user denied - signing out and deleting account');
    
    try {
      await supabase.auth.signOut();
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (deleteError) {
      console.error('Error deleting new user:', deleteError);
    }
    
    setSession(null);
    setUser(null);
    
    const errorMessage = 'Account creation is not allowed. Please contact support if you need access.';
    if (Platform.OS === 'web') {
      alert(errorMessage);
    } else {
      Alert.alert('Access Denied', errorMessage);
    }
    
    throw new Error('NEW_USER_NOT_ALLOWED');
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
          
          if (sessionData.user) {
            const isNew = await checkIfNewUser(sessionData.user.id, sessionData.user.created_at);
            if (isNew) {
              await handleNewUserDenied(sessionData.user.id);
              return null;
            }
          }
          
          return sessionData;
        }
      }
    }

    return data;
  };

  const signInWithApple = async () => {
    if (Platform.OS === 'ios') {
      try {
        console.log('[Apple Sign In] Starting Apple authentication...');
        
        // Check if Apple Sign In is available
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        console.log('[Apple Sign In] isAvailable:', isAvailable);
        
        if (!isAvailable) {
          throw new Error('Apple Sign In is not available on this device');
        }
        
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        console.log('[Apple Sign In] Got credential from Apple');
        console.log('[Apple Sign In] User ID:', credential.user);
        console.log('[Apple Sign In] Email:', credential.email);
        console.log('[Apple Sign In] Full Name:', credential.fullName);
        console.log('[Apple Sign In] Identity Token exists:', !!credential.identityToken);
        console.log('[Apple Sign In] Authorization Code exists:', !!credential.authorizationCode);

        if (credential.identityToken) {
          console.log('[Apple Sign In] Exchanging token with Supabase...');
          console.log('[Apple Sign In] Token length:', credential.identityToken.length);
          
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (error) {
            console.error('[Apple Sign In] Supabase error:', error);
            console.error('[Apple Sign In] Supabase error message:', error.message);
            console.error('[Apple Sign In] Supabase error status:', error.status);
            throw error;
          }

          console.log('[Apple Sign In] Supabase sign in successful!');
          console.log('[Apple Sign In] User:', data?.user?.id);
          console.log('[Apple Sign In] Session:', !!data?.session);
          
          return data;
        } else {
          console.error('[Apple Sign In] No identity token received from Apple');
          throw new Error('No identity token received from Apple');
        }
      } catch (e: unknown) {
        const error = e as { code?: string; message?: string };
        console.error('[Apple Sign In] Error caught:', error);
        console.error('[Apple Sign In] Error code:', error.code);
        console.error('[Apple Sign In] Error message:', error.message);
        
        if (error.code === 'ERR_REQUEST_CANCELED') {
          console.log('[Apple Sign In] User canceled Apple Sign In');
          return null;
        }
        throw e;
      }
    } else {
      const redirectUrl = getRedirectUrl();
      console.log('Apple OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
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
    }
  };

  return {
    user,
    session,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
    signInWithApple,
    deleteAccount,
  };
});
