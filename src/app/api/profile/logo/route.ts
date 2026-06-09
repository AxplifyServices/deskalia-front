import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function now() {
  return new Date().toISOString();
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[PROFILE LOGO POST][${requestId}] START ${now()}`);
  console.log(`[PROFILE LOGO POST][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log(`[PROFILE LOGO POST][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log('='.repeat(100));

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get('logo');

    console.log(`[PROFILE LOGO POST][${requestId}] Logo présent =`, Boolean(file));
    console.log(`[PROFILE LOGO POST][${requestId}] Backend appelé = ${API_BASE_URL}/profile/logo`);

    const response = await fetch(`${API_BASE_URL}/profile/logo`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
      },
      cache: 'no-store',
      body: formData,
    });

    const data = await readBackendJson(response);

    console.log(`[PROFILE LOGO POST][${requestId}] Backend status =`, response.status);
    console.log(`[PROFILE LOGO POST][${requestId}] Backend response =`, data);
    console.log(`[PROFILE LOGO POST][${requestId}] Durée = ${Date.now() - startedAt}ms`);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error ?? data.details ?? 'Impossible d’envoyer le logo.',
          backend_status: response.status,
          backend_response: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error(`[PROFILE LOGO POST][${requestId}] Exception =`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur envoi logo.',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[PROFILE LOGO DELETE][${requestId}] START ${now()}`);
  console.log(`[PROFILE LOGO DELETE][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log(`[PROFILE LOGO DELETE][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log('='.repeat(100));

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profile/logo`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const data = await readBackendJson(response);

    console.log(`[PROFILE LOGO DELETE][${requestId}] Backend status =`, response.status);
    console.log(`[PROFILE LOGO DELETE][${requestId}] Backend response =`, data);
    console.log(`[PROFILE LOGO DELETE][${requestId}] Durée = ${Date.now() - startedAt}ms`);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error ?? data.details ?? 'Impossible de supprimer le logo.',
          backend_status: response.status,
          backend_response: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error(`[PROFILE LOGO DELETE][${requestId}] Exception =`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur suppression logo.',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[PROFILE LOGO GET][${requestId}] START ${now()}`);
  console.log(`[PROFILE LOGO GET][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log(`[PROFILE LOGO GET][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log('='.repeat(100));

  if (!authorization) {
    console.warn(`[PROFILE LOGO GET][${requestId}] STOP: pas de Authorization`);
    return unauthorizedResponse();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profile/logo`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    console.log(`[PROFILE LOGO GET][${requestId}] Backend status =`, response.status);
    console.log(`[PROFILE LOGO GET][${requestId}] Backend content-type =`, response.headers.get('content-type'));

    if (!response.ok) {
      const data = await readBackendJson(response);

      console.log(`[PROFILE LOGO GET][${requestId}] Backend error response =`, data);
      console.log(`[PROFILE LOGO GET][${requestId}] Durée = ${Date.now() - startedAt}ms`);

      return NextResponse.json(
        {
          success: false,
          error: data.error ?? data.details ?? 'Aucun logo disponible.',
          backend_status: response.status,
          backend_response: data,
        },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    const buffer = await response.arrayBuffer();

    console.log(`[PROFILE LOGO GET][${requestId}] Image bytes =`, buffer.byteLength);
    console.log(`[PROFILE LOGO GET][${requestId}] Durée = ${Date.now() - startedAt}ms`);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`[PROFILE LOGO GET][${requestId}] Exception =`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur lecture logo.',
      },
      { status: 500 },
    );
  }
}