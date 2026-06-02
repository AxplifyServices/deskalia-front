import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  logServer,
  previewValue,
  readBackendJson,
} from '@/lib/backend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  console.log('');
  console.log('='.repeat(100));
  logServer(requestId, '[google-login] Requête reçue côté Next');
  logServer(requestId, '[google-login] API_BASE_URL', API_BASE_URL);
  console.log('='.repeat(100));

  try {
    const body = await request.json();

    const code = typeof body.code === 'string' ? body.code : '';
    const codeVerifier =
      typeof body.code_verifier === 'string' ? body.code_verifier : '';

    logServer(requestId, '[google-login] Body reçu depuis le front', {
      hasCode: Boolean(code),
      codePreview: previewValue(code),
      codeLength: code.length,
      hasCodeVerifier: Boolean(codeVerifier),
      codeVerifierPreview: previewValue(codeVerifier),
      codeVerifierLength: codeVerifier.length,
    });

    if (!code) {
      logServer(requestId, '[google-login] Erreur: code Google manquant');

      return NextResponse.json(
        { success: false, error: 'Code Google manquant.' },
        { status: 400 },
      );
    }

    if (!codeVerifier) {
      logServer(requestId, '[google-login] Erreur: code_verifier PKCE manquant');

      return NextResponse.json(
        { success: false, error: 'Code verifier Google manquant.' },
        { status: 400 },
      );
    }

    const backendUrl = `${API_BASE_URL}/auth/google/login`;

    logServer(requestId, '[google-login] URL backend appelée', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
      }),
    });

    const data = await readBackendJson(response);

    logServer(requestId, '[google-login] Status backend', response.status);
    logServer(requestId, '[google-login] Réponse backend', {
      success: response.ok,
      hasAccessToken: Boolean(data?.access_token),
      accessTokenPreview: previewValue(data?.access_token),
      isNewUser: data?.is_new_user,
      userEmail: data?.user_profile?.mail_user,
      userId: data?.user_profile?.id,
      provider: data?.user_profile?.provider,
      error: data?.error,
      details: data?.details,
    });

    if (!response.ok) {
      const errorMessage =
        data?.error ??
        data?.details ??
        `Connexion Google impossible. Status backend ${response.status}`;

      logServer(requestId, '[google-login] Erreur backend', {
        status: response.status,
        errorMessage,
        details: data,
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: data,
          backendStatus: response.status,
        },
        { status: response.status },
      );
    }

    if (!data?.access_token) {
      logServer(requestId, '[google-login] Erreur: backend OK mais access_token absent');

      return NextResponse.json(
        {
          success: false,
          error: 'Le backend a répondu sans access_token.',
          details: data,
        },
        { status: 500 },
      );
    }

    logServer(requestId, '[google-login] Connexion Google réussie', {
      jwtPreview: previewValue(data.access_token),
      userEmail: data?.user_profile?.mail_user,
      userId: data?.user_profile?.id,
      isNewUser: data?.is_new_user ?? false,
    });

    return NextResponse.json({
      success: true,
      access_token: data.access_token,
      user_profile: data.user_profile,
      is_new_user: data.is_new_user ?? false,
    });
  } catch (error) {
    console.error(`[API google-login][${requestId}] Exception proxy Next =`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur Google.',
      },
      { status: 500 },
    );
  }
}