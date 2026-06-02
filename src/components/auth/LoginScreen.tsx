'use client';

import { useState } from 'react';
import { setAuthSession, type UserProfile } from '@/lib/auth-client';
import { devError, devLog, devWarn, previewValue } from '@/lib/dev-log';

type LoginScreenProps = {
  onAuthenticated: (
    token: string,
    profile: UserProfile,
    isNewUser?: boolean,
  ) => void;
};

type AuthMode = 'login' | 'signup';


export default function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitEmailAuth() {
    const requestId = crypto.randomUUID();

    devLog('');
    devLog('='.repeat(100));
    devLog(`[LOGIN EMAIL][${requestId}] submitEmailAuth`);
    devLog(`[LOGIN EMAIL][${requestId}] mode =`, mode);
    devLog(`[LOGIN EMAIL][${requestId}] email =`, email);
    devLog(`[LOGIN EMAIL][${requestId}] password présent =`, Boolean(password));
    devLog('='.repeat(100));

    setLoading(true);
    setError('');

    try {
      const endpoint =
        mode === 'login'
          ? '/api/auth/email/login'
          : '/api/auth/email/signup';

      const payload =
        mode === 'login'
          ? { email, password }
          : { email, password, nom, prenom };

      devLog(`[LOGIN EMAIL][${requestId}] endpoint =`, endpoint);
      devLog(`[LOGIN EMAIL][${requestId}] payload =`, {
        ...payload,
        password: password ? '***' : '',
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      devLog(`[LOGIN EMAIL][${requestId}] status =`, response.status);
      devLog(`[LOGIN EMAIL][${requestId}] response =`, {
        success: data?.success,
        hasAccessToken: Boolean(data?.access_token),
        accessTokenPreview: previewValue(data?.access_token),
        userEmail: data?.user_profile?.mail_user,
        userId: data?.user_profile?.id,
        isNewUser: data?.is_new_user,
        error: data?.error,
      });

      if (!response.ok || !data.success || !data.access_token) {
        setError(data.error ?? 'Authentification impossible.');
        return;
      }

      setAuthSession(data.access_token, data.user_profile);
      onAuthenticated(data.access_token, data.user_profile, data.is_new_user);
    } catch (caughtError) {
      devError(`[LOGIN EMAIL][${requestId}] Exception =`, caughtError);
      setError('Authentification impossible.');
    } finally {
      setLoading(false);
    }
  }

  function base64UrlEncode(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function randomString(length = 96) {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

    const values = crypto.getRandomValues(new Uint8Array(length));

    return Array.from(values)
      .map((value) => charset[value % charset.length])
      .join('');
  }

  async function createCodeChallenge(codeVerifier: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    return base64UrlEncode(digest);
  }

  async function redirectToGoogleAuth() {
    const requestId = crypto.randomUUID();

    devLog('');
    devLog('='.repeat(100));
    devLog(`[GOOGLE AUTH][${requestId}] Début génération URL Google`);
    devLog(`[GOOGLE AUTH][${requestId}] window.location.href actuel =`, window.location.href);
    devLog(`[GOOGLE AUTH][${requestId}] NEXT_PUBLIC_GOOGLE_CLIENT_ID =`, process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    devLog(`[GOOGLE AUTH][${requestId}] NEXT_PUBLIC_GOOGLE_REDIRECT_URI =`, process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI);
    devLog(`[GOOGLE AUTH][${requestId}] NEXT_PUBLIC_SKIP_AUTH =`, process.env.NEXT_PUBLIC_SKIP_AUTH);
    devLog('='.repeat(100));

    setError('');

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      devError(`[GOOGLE AUTH][${requestId}] Configuration Google manquante`, {
        hasClientId: Boolean(clientId),
        hasRedirectUri: Boolean(redirectUri),
      });

      setError('Configuration Google manquante.');
      return;
    }

    const codeVerifier = randomString(96);
    const codeChallenge = await createCodeChallenge(codeVerifier);
    const state = `google|${randomString(32)}`;

    sessionStorage.setItem('deskalia_google_code_verifier', codeVerifier);
    sessionStorage.setItem('deskalia_google_state', state);

    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/spreadsheets',
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    devLog(`[GOOGLE AUTH][${requestId}] client_id =`, clientId);
    devLog(`[GOOGLE AUTH][${requestId}] redirect_uri utilisé =`, redirectUri);
    devLog(`[GOOGLE AUTH][${requestId}] redirect_uri encodé =`, encodeURIComponent(redirectUri));
    devLog(`[GOOGLE AUTH][${requestId}] response_type = code`);
    devLog(`[GOOGLE AUTH][${requestId}] access_type = offline`);
    devLog(`[GOOGLE AUTH][${requestId}] prompt = consent`);
    devLog(`[GOOGLE AUTH][${requestId}] state =`, state);
    devLog(`[GOOGLE AUTH][${requestId}] scopes =`, scopes);
    devLog(`[GOOGLE AUTH][${requestId}] code_verifier stocké sessionStorage =`, Boolean(codeVerifier));
    devLog(`[GOOGLE AUTH][${requestId}] code_verifier preview =`, previewValue(codeVerifier));
    devLog(`[GOOGLE AUTH][${requestId}] code_challenge preview =`, previewValue(codeChallenge));
    devLog(`[GOOGLE AUTH][${requestId}] URL Google complète générée =`, googleAuthUrl);

    window.location.href = googleAuthUrl;
  }

  function redirectToMicrosoftAuth() {
    devWarn('[MICROSOFT AUTH] Connexion Microsoft pas encore intégrée dans le front Next.js.');
    setError('Connexion Microsoft pas encore intégrée dans le front Next.js.');
  }

  return (
    <main className="min-h-screen bg-[#f5f1ee] text-[#2b201e]">
      <section className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-6 pb-8 pt-12">
        <div className="flex justify-center">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#ff642d] text-[30px] font-black text-white">
            ✺
          </div>
        </div>

        <div className="mt-auto pb-6">
          <h1 className="mb-8 text-[34px] font-extrabold leading-[1.1] tracking-[-1px] text-[#2b201e]">
            {mode === 'login'
              ? 'Commençons par votre email'
              : 'Créer votre compte'}
          </h1>

          <div className="space-y-4">
            {mode === 'signup' ? (
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={prenom}
                  onChange={(event) => setPrenom(event.target.value)}
                  placeholder="Prénom"
                  className="h-[56px] rounded-[14px] border border-[#ddcec5] bg-transparent px-4 text-[17px] outline-none placeholder:text-[#6f4b49]"
                />
                <input
                  value={nom}
                  onChange={(event) => setNom(event.target.value)}
                  placeholder="Nom"
                  className="h-[56px] rounded-[14px] border border-[#ddcec5] bg-transparent px-4 text-[17px] outline-none placeholder:text-[#6f4b49]"
                />
              </div>
            ) : null}

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              className="h-[64px] w-full rounded-[14px] border border-[#ddcec5] bg-transparent px-4 text-[22px] outline-none placeholder:text-[#2b201e]"
            />

            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              type="password"
              className="h-[64px] w-full rounded-[14px] border border-[#ddcec5] bg-transparent px-4 text-[20px] outline-none placeholder:text-[#2b201e]"
            />

            {error ? (
              <p className="text-[14px] font-semibold text-[#ff642d]">{error}</p>
            ) : null}

            <button
              type="button"
              disabled={loading}
              onClick={submitEmailAuth}
              className="h-[62px] w-full rounded-[14px] bg-[#efc59e] text-[20px] font-extrabold text-[#7a3419] disabled:opacity-60 active:scale-[0.98]"
            >
              {loading
                ? 'Chargement...'
                : mode === 'login'
                  ? 'Continuer'
                  : 'Créer mon compte'}
            </button>

            <button
              type="button"
              onClick={() => {
                devLog('[LOGIN SCREEN] Changement mode auth', {
                  oldMode: mode,
                  newMode: mode === 'login' ? 'signup' : 'login',
                });

                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
              }}
              className="w-full text-center text-[14px] font-bold text-[#7a5149] underline"
            >
              {mode === 'login'
                ? 'Créer un compte avec email'
                : 'J’ai déjà un compte'}
            </button>
          </div>

          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#ddcec5]" />
            <span className="text-[20px] text-[#6f4b49]">ou</span>
            <div className="h-px flex-1 bg-[#ddcec5]" />
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={redirectToGoogleAuth}
              className="flex h-[68px] w-full items-center justify-center gap-5 rounded-full border border-[#ddcec5] bg-white text-[21px] font-semibold text-[#1f2937] active:scale-[0.98]"
            >
              <span className="text-[34px] font-black text-[#4285f4]">G</span>
              <span>Sign in with Google</span>
            </button>

            <button
              type="button"
              onClick={redirectToMicrosoftAuth}
              className="flex h-[68px] w-full items-center justify-center gap-5 rounded-full border border-[#ddcec5] bg-white text-[21px] font-semibold text-[#1f2937] active:scale-[0.98]"
            >
              <span className="grid grid-cols-2 gap-[2px]">
                <span className="h-3 w-3 bg-[#f25022]" />
                <span className="h-3 w-3 bg-[#7fba00]" />
                <span className="h-3 w-3 bg-[#00a4ef]" />
                <span className="h-3 w-3 bg-[#ffb900]" />
              </span>
              <span>Sign in with Microsoft</span>
            </button>
          </div>
        </div>

        <p className="text-[16px] leading-[1.35] text-[#7a5149]">
          En continuant, vous acceptez nos{' '}
          <span className="text-[#2b201e] underline">
            Conditions d’utilisations
          </span>{' '}
          et vous confirmez avoir lu notre{' '}
          <span className="text-[#2b201e] underline">
            politique de confidentialité
          </span>.
        </p>
      </section>
    </main>
  );
}