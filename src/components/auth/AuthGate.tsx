'use client';

import { useEffect, useRef, useState } from 'react';
import OnboardingScreen from '@/components/onboarding/OnboardingScreen';
import LoginScreen from './LoginScreen';
import {
  authHeaders,
  clearAuthSession,
  getAccessToken,
  getStoredProfile,
  setAuthSession,
  type UserProfile,
} from '@/lib/auth-client';
import DeskaliaShell from '@/components/layout/DeskaliaShell';
import { devError, devLog, devWarn, previewValue } from '@/lib/dev-log';

type AuthStatus = 'loading' | 'anonymous' | 'onboarding' | 'authenticated';

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const bootStartedRef = useRef(false);

  async function loadProfile() {
    const requestId = crypto.randomUUID();

    devLog(`[AUTH GATE][${requestId}] loadProfile`, {
      status,
    });

    const token = getAccessToken();

    devLog(`[AUTH GATE][${requestId}] token`, {
      hasToken: Boolean(token),
      tokenPreview: previewValue(token, 10, 8),
    });

    if (!token) {
      devWarn(`[AUTH GATE][${requestId}] Aucun token -> anonymous`);
      setStatus('anonymous');
      return;
    }

try {
  const headers: HeadersInit = {};

  const authorization = authHeaders().Authorization;

  if (authorization) {
    headers.Authorization = authorization;
  }

  devLog(`[AUTH GATE][${requestId}] Appel /api/profile`, {
    hasAuthorization: Boolean(authorization),
    authorizationPreview: previewValue(authorization, 10, 8),
  });

  const response = await fetch('/api/profile', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

      const data = await response.json();

      devLog(`[AUTH GATE][${requestId}] /api/profile response`, {
        status: response.status,
        success: data?.success,
        profileEmail: data?.profile?.mail_user,
        profileId: data?.profile?.id,
        firstLoginDone: data?.profile?.first_login_done,
        error: data?.error,
      });

if (!response.ok || !data.success) {
  devWarn(`[AUTH GATE][${requestId}] Profil inaccessible`, {
    status: response.status,
    error: data?.error,
  });

  // On supprime la session uniquement si le token est vraiment refusé.
  // Un 500, 502, 503 ou fetch failed ne doit jamais déconnecter l’utilisateur.
  if (response.status === 401 || response.status === 422) {
    devWarn(`[AUTH GATE][${requestId}] Token refusé -> clear session`);
    clearAuthSession();
    setProfile(null);
    setStatus('anonymous');
    return;
  }

  const storedProfile = getStoredProfile();

  if (storedProfile) {
    devWarn(
      `[AUTH GATE][${requestId}] Erreur temporaire profil -> session locale conservée`,
    );

    setProfile(storedProfile);
    setStatus(storedProfile.first_login_done ? 'authenticated' : 'onboarding');
    return;
  }

  setStatus('anonymous');
  return;
}

      const loadedProfile = data.profile as UserProfile;

      setProfile(loadedProfile);
      setAuthSession(token, loadedProfile);

      if (loadedProfile.first_login_done) {
        devLog(`[AUTH GATE][${requestId}] first_login_done=true -> authenticated`);
        setStatus('authenticated');
      } else {
        devLog(`[AUTH GATE][${requestId}] first_login_done=false -> onboarding`);
        setStatus('onboarding');
      }
} catch (error) {
  devError(`[AUTH GATE][${requestId}] Exception loadProfile =`, error);

  const storedProfile = getStoredProfile();

  if (storedProfile) {
    devWarn(
      `[AUTH GATE][${requestId}] Erreur réseau profil -> session locale conservée`,
    );

    setProfile(storedProfile);
    setStatus(storedProfile.first_login_done ? 'authenticated' : 'onboarding');
    return;
  }

  setProfile(null);
  setStatus('anonymous');
}
  }

  function readTokenFromCallbackUrl() {
    const requestId = crypto.randomUUID();
    const url = new URL(window.location.href);

    const queryToken =
      url.searchParams.get('token') ||
      url.searchParams.get('access_token');

    const hashParams = new URLSearchParams(
      url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
    );

    const hashToken =
      hashParams.get('token') ||
      hashParams.get('access_token');

    const token = queryToken || hashToken;

    devLog(`[AUTH GATE][${requestId}] readTokenFromCallbackUrl`, {
      hasQueryToken: Boolean(queryToken),
      hasHashToken: Boolean(hashToken),
      tokenPreview: previewValue(token, 10, 8),
    });

    if (!token) {
      devLog(`[AUTH GATE][${requestId}] Aucun token direct dans URL`);
      return false;
    }

    localStorage.setItem('deskalia_access_token', token);

    url.searchParams.delete('token');
    url.searchParams.delete('access_token');
    url.searchParams.delete('is_new_user');
    url.hash = '';

    window.history.replaceState({}, '', `${url.pathname}${url.search}`);

    devLog(`[AUTH GATE][${requestId}] Token URL sauvegardé puis nettoyé`);

    return true;
  }

  async function handleGoogleCallback() {
    const requestId = crypto.randomUUID();
    const url = new URL(window.location.href);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const scope = url.searchParams.get('scope');
    const authuser = url.searchParams.get('authuser');
    const prompt = url.searchParams.get('prompt');

    devLog(`[GOOGLE CALLBACK][${requestId}] Vérification callback Google`, {
      hasCode: Boolean(code),
      codePreview: previewValue(code, 10, 8),
      state,
      scope,
      authuser,
      prompt,
    });

    if (!code) {
      devLog(`[GOOGLE CALLBACK][${requestId}] Pas de code Google`);
      return false;
    }

    const expectedState = sessionStorage.getItem('deskalia_google_state');
    const codeVerifier = sessionStorage.getItem('deskalia_google_code_verifier');

    devLog(`[GOOGLE CALLBACK][${requestId}] Session PKCE`, {
      hasExpectedState: Boolean(expectedState),
      stateMatches: Boolean(expectedState && state && expectedState === state),
      hasCodeVerifier: Boolean(codeVerifier),
      codeVerifierPreview: previewValue(codeVerifier, 10, 8),
    });

    if (!expectedState || !state || expectedState !== state || !codeVerifier) {
      devError(`[GOOGLE CALLBACK][${requestId}] State ou codeVerifier invalide`, {
        hasExpectedState: Boolean(expectedState),
        hasState: Boolean(state),
        stateMatches: expectedState === state,
        hasCodeVerifier: Boolean(codeVerifier),
      });

      sessionStorage.removeItem('deskalia_google_state');
      sessionStorage.removeItem('deskalia_google_code_verifier');
      clearAuthSession();
      setProfile(null);
      setStatus('anonymous');
      return true;
    }

    try {
      devLog(`[GOOGLE CALLBACK][${requestId}] Appel POST /api/auth/google/login`);

      const response = await fetch('/api/auth/google/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
        }),
      });

      const data = await response.json();

      devLog(`[GOOGLE CALLBACK][${requestId}] /api/auth/google/login response`, {
        status: response.status,
        success: data?.success,
        hasAccessToken: Boolean(data?.access_token),
        accessTokenPreview: previewValue(data?.access_token, 10, 8),
        userEmail: data?.user_profile?.mail_user,
        userId: data?.user_profile?.id,
        provider: data?.user_profile?.provider,
        firstLoginDone: data?.user_profile?.first_login_done,
        isNewUser: data?.is_new_user,
        error: data?.error,
        backendStatus: data?.backendStatus,
      });

      sessionStorage.removeItem('deskalia_google_state');
      sessionStorage.removeItem('deskalia_google_code_verifier');

      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('scope');
      url.searchParams.delete('authuser');
      url.searchParams.delete('prompt');

      window.history.replaceState({}, '', `${url.pathname}${url.search}`);

      if (!response.ok || !data.success || !data.access_token) {
        devError(`[GOOGLE CALLBACK][${requestId}] Connexion Google échouée`, data);

        clearAuthSession();
        setProfile(null);
        setStatus('anonymous');
        return true;
      }

      setAuthSession(data.access_token, data.user_profile);
      setProfile(data.user_profile);

      if (data.is_new_user || !data.user_profile?.first_login_done) {
        devLog(`[GOOGLE CALLBACK][${requestId}] Nouvel utilisateur -> onboarding`);
        setStatus('onboarding');
      } else {
        devLog(`[GOOGLE CALLBACK][${requestId}] Utilisateur existant -> authenticated`);
        setStatus('authenticated');
      }

      return true;
    } catch (error) {
      devError(`[GOOGLE CALLBACK][${requestId}] Exception callback Google =`, error);

      sessionStorage.removeItem('deskalia_google_state');
      sessionStorage.removeItem('deskalia_google_code_verifier');
      clearAuthSession();
      setProfile(null);
      setStatus('anonymous');
      return true;
    }
  }

  useEffect(() => {
    if (bootStartedRef.current) {
      return;
    }

    bootStartedRef.current = true;

    async function boot() {
      const requestId = crypto.randomUUID();

      devLog(`[AUTH GATE][${requestId}] boot`, {
        skipAuth: process.env.NEXT_PUBLIC_SKIP_AUTH,
        url: window.location.href,
      });

      const handledGoogleCallback = await handleGoogleCallback();

      devLog(`[AUTH GATE][${requestId}] handledGoogleCallback =`, handledGoogleCallback);

      if (handledGoogleCallback) {
        return;
      }

      const hasCallbackToken = readTokenFromCallbackUrl();

      devLog(`[AUTH GATE][${requestId}] hasCallbackToken =`, hasCallbackToken);

      if (hasCallbackToken) {
        await loadProfile();
        return;
      }

      await loadProfile();
    }

    void boot();
  }, []);

  function handleAuthenticated(token: string, userProfile: UserProfile, isNewUser?: boolean) {
    devLog('[AUTH GATE] handleAuthenticated', {
      tokenPresent: Boolean(token),
      tokenPreview: previewValue(token, 10, 8),
      userEmail: userProfile?.mail_user,
      userId: userProfile?.id,
      provider: userProfile?.provider,
      firstLoginDone: userProfile?.first_login_done,
      isNewUser,
    });

    setAuthSession(token, userProfile);
    setProfile(userProfile);

    if (isNewUser || !userProfile.first_login_done) {
      devLog('[AUTH GATE] handleAuthenticated -> onboarding');
      setStatus('onboarding');
    } else {
      devLog('[AUTH GATE] handleAuthenticated -> authenticated');
      setStatus('authenticated');
    }
  }

  async function handleOnboardingComplete() {
    const requestId = crypto.randomUUID();

    devLog(`[AUTH GATE][${requestId}] handleOnboardingComplete`);

try {
  const headers: HeadersInit = {};

  const authorization = authHeaders().Authorization;

  if (authorization) {
    headers.Authorization = authorization;
  }

  devLog(`[AUTH GATE][${requestId}] Appel POST /api/profile/mark-first-login`, {
    hasAuthorization: Boolean(authorization),
  });

  const response = await fetch('/api/profile/mark-first-login', {
    method: 'POST',
    headers,
    cache: 'no-store',
  });

      const data = await response.json().catch(() => null);

      devLog(`[AUTH GATE][${requestId}] /api/profile/mark-first-login response`, {
        status: response.status,
        data,
      });

      if (!response.ok) {
        devWarn(
          `[AUTH GATE][${requestId}] mark-first-login échoué, passage chatbot maintenu`,
        );
      }

      setProfile((currentProfile) => {
        if (!currentProfile) {
          return currentProfile;
        }

        const updatedProfile = {
          ...currentProfile,
          first_login_done: true,
        };

        const token = getAccessToken();

        if (token) {
          setAuthSession(token, updatedProfile);
        }

        return updatedProfile;
      });

      setStatus('authenticated');
    } catch (error) {
      devError(`[AUTH GATE][${requestId}] Exception handleOnboardingComplete =`, error);
      setStatus('onboarding');
    }
  }

  function handleLogout() {
    const requestId = crypto.randomUUID();

    devWarn(`[AUTH GATE][${requestId}] LOGOUT`, {
      email: profile?.mail_user,
      id: profile?.id,
      provider: profile?.provider,
    });

    clearAuthSession();

    setProfile(null);
    setStatus('anonymous');
  }

  if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
    devWarn('[AUTH GATE] NEXT_PUBLIC_SKIP_AUTH=true -> DeskaliaShell direct');
    return <DeskaliaShell profile={profile} onLogout={handleLogout} />;
  }

  if (status === 'loading') {
    return (
      <main className="flex h-screen items-center justify-center bg-[#f5f1ee] text-[#2b201e]">
        <p className="text-[16px] font-bold">Chargement...</p>
      </main>
    );
  }

  if (status === 'anonymous') {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  if (status === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  devLog('[AUTH GATE] Render DeskaliaShell avec profile =', {
    email: profile?.mail_user,
    id: profile?.id,
    provider: profile?.provider,
  });

  return <DeskaliaShell profile={profile} onLogout={handleLogout} />;
}