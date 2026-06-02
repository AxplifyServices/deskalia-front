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
    const response = await fetch(`${API_BASE_URL}/conversations`, {
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
            data?.error ??
            data?.details ??
            'Impossible de charger les conversations.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      conversations: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur conversations.',
      },
      { status: 500 },
    );
  }
}