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
    const response = await fetch(`${API_BASE_URL}/clients`, {
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
          error: data?.error ?? data?.details ?? 'Impossible de charger les clients.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      clients: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur clients.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
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
          error: data?.error ?? data?.details ?? 'Impossible de créer le client.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur création client.',
      },
      { status: 500 },
    );
  }
}