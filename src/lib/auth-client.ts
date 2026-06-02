import { devError, devLog, devWarn, previewValue } from '@/lib/dev-log';

export type UserProfile = {
  id?: number;
  mail_user?: string;
  nom?: string;
  prenom?: string;
  provider?: string;
  first_login_done?: boolean;
  company_id?: number | null;
  [key: string]: unknown;
};

const TOKEN_KEY = 'deskalia_access_token';
const PROFILE_KEY = 'deskalia_user_profile';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(TOKEN_KEY);

  devLog('[AUTH CLIENT] getAccessToken présent =', Boolean(token));
  devLog('[AUTH CLIENT] getAccessToken preview =', previewValue(token, 10, 8));

  return token;
}

export function setAuthSession(token: string, profile?: UserProfile) {
  if (typeof window === 'undefined') return;

  devLog('[AUTH CLIENT] setAuthSession appelé', {
    hasToken: Boolean(token),
    tokenPreview: previewValue(token, 10, 8),
    profileEmail: profile?.mail_user,
    profileId: profile?.id,
    provider: profile?.provider,
    firstLoginDone: profile?.first_login_done,
  });

  localStorage.setItem(TOKEN_KEY, token);

  if (profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;

  devWarn('[AUTH CLIENT] clearAuthSession appelé');

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);

  localStorage.removeItem('access_token');
  localStorage.removeItem('token');
  localStorage.removeItem('jwt');
  localStorage.removeItem('user');
  localStorage.removeItem('auth');
  localStorage.removeItem('refresh_token');

  sessionStorage.removeItem('deskalia_google_state');
  sessionStorage.removeItem('deskalia_google_code_verifier');

  devWarn('[AUTH CLIENT] Session front nettoyée');
}

export function getStoredProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(PROFILE_KEY);

  devLog('[AUTH CLIENT] getStoredProfile présent =', Boolean(raw));

  if (!raw) return null;

  try {
    const profile = JSON.parse(raw) as UserProfile;

    devLog('[AUTH CLIENT] profile stocké', {
      email: profile.mail_user,
      id: profile.id,
    });

    return profile;
  } catch (error) {
    devError('[AUTH CLIENT] Impossible de parser le profil stocké', error);
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
    devWarn('[AUTH CLIENT] NEXT_PUBLIC_SKIP_AUTH=true donc pas de header Authorization');
    return {};
  }

  const token = getAccessToken();

  if (!token) {
    devWarn('[AUTH CLIENT] Aucun token localStorage, pas de header Authorization');
    return {};
  }

  devLog('[AUTH CLIENT] Authorization Bearer ajouté', {
    authorizationPreview: previewValue(token, 10, 8),
  });

  return {
    Authorization: `Bearer ${token}`,
  };
}