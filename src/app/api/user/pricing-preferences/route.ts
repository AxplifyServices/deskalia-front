import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/user/pricing-preferences`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data.error ??
            data.details ??
            'Impossible de charger les préférences de calcul.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      preferences: data.preferences ?? data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur préférences de calcul.',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/api/user/pricing-preferences`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data.error ??
            data.details ??
            'Impossible de modifier les préférences de calcul.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      preferences: data.preferences ?? body,
      message: data.message,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur modification préférences.',
      },
      { status: 500 },
    );
  }
}