import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profile/mark-first-login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error ?? data.details ?? 'Impossible de terminer l’onboarding.' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur onboarding.',
      },
      { status: 500 },
    );
  }
}