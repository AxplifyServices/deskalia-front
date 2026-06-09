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

function previewBody(value: unknown) {
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 4000 ? `${text.slice(0, 4000)}...` : text;
  } catch {
    return value;
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[PROFILE GET][${requestId}] START ${now()}`);
  console.log(`[PROFILE GET][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log(`[PROFILE GET][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log('='.repeat(100));

  if (!authorization) {
    console.warn(`[PROFILE GET][${requestId}] STOP: utilisateur non connecté`);
    return unauthorizedResponse();
  }

  try {
    const url = `${API_BASE_URL}/profile`;

    console.log(`[PROFILE GET][${requestId}] Backend appelé =`, url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const data = await readBackendJson(response);

    console.log(`[PROFILE GET][${requestId}] Backend status =`, response.status);
    console.log(`[PROFILE GET][${requestId}] Backend response =`, previewBody(data));
    console.log(`[PROFILE GET][${requestId}] Durée = ${Date.now() - startedAt}ms`);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error ?? data.details ?? 'Profil inaccessible.',
          backend_status: response.status,
          backend_response: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      profile: data,
    });
  } catch (error) {
    console.error(`[PROFILE GET][${requestId}] Exception =`, error);
    console.log(`[PROFILE GET][${requestId}] Durée avant exception = ${Date.now() - startedAt}ms`);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur profil.',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[PROFILE PUT][${requestId}] START ${now()}`);
  console.log(`[PROFILE PUT][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log(`[PROFILE PUT][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log('='.repeat(100));

  if (!authorization) {
    console.warn(`[PROFILE PUT][${requestId}] STOP: utilisateur non connecté`);
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    console.log(`[PROFILE PUT][${requestId}] Payload reçu du front =`);
    console.log(previewBody(body));

    const updateUrl = `${API_BASE_URL}/profile`;

    console.log(`[PROFILE PUT][${requestId}] Backend PUT appelé =`, updateUrl);

    const updateStartedAt = Date.now();

    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(body),
    });

    const updateData = await readBackendJson(updateResponse);

    console.log(`[PROFILE PUT][${requestId}] Backend PUT status =`, updateResponse.status);
    console.log(`[PROFILE PUT][${requestId}] Backend PUT durée = ${Date.now() - updateStartedAt}ms`);
    console.log(`[PROFILE PUT][${requestId}] Backend PUT response =`);
    console.log(previewBody(updateData));

    if (!updateResponse.ok || updateData?.success === false) {
      console.warn(`[PROFILE PUT][${requestId}] STOP: backend PUT non OK`);
      console.log(`[PROFILE PUT][${requestId}] Durée totale = ${Date.now() - startedAt}ms`);

      return NextResponse.json(
        {
          success: false,
          step: 'backend-put-profile',
          error:
            updateData.error ??
            updateData.details ??
            updateData.message ??
            'Impossible de modifier le profil.',
          backend_status: updateResponse.status,
          backend_response: updateData,
        },
        { status: updateResponse.status || 500 },
      );
    }

    console.log(`[PROFILE PUT][${requestId}] Backend PUT OK, rechargement profil...`);

    const reloadStartedAt = Date.now();

    const reloadResponse = await fetch(`${API_BASE_URL}/profile`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const reloadedProfile = await readBackendJson(reloadResponse);

    console.log(`[PROFILE PUT][${requestId}] Backend GET reload status =`, reloadResponse.status);
    console.log(`[PROFILE PUT][${requestId}] Backend GET reload durée = ${Date.now() - reloadStartedAt}ms`);
    console.log(`[PROFILE PUT][${requestId}] Backend GET reload response =`);
    console.log(previewBody(reloadedProfile));
    console.log(`[PROFILE PUT][${requestId}] Durée totale = ${Date.now() - startedAt}ms`);

    if (!reloadResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: 'backend-reload-profile',
          error:
            reloadedProfile.error ??
            reloadedProfile.details ??
            'Profil modifié côté API, mais impossible de recharger le profil.',
          backend_status: reloadResponse.status,
          backend_response: reloadedProfile,
          update_response: updateData,
        },
        { status: reloadResponse.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: updateData.message ?? 'Profil mis à jour.',
      profile: reloadedProfile,
      update_response: updateData,
    });
  } catch (error) {
    console.error(`[PROFILE PUT][${requestId}] Exception =`, error);
    console.log(`[PROFILE PUT][${requestId}] Durée avant exception = ${Date.now() - startedAt}ms`);

    return NextResponse.json(
      {
        success: false,
        step: 'next-proxy-exception',
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur modification profil.',
      },
      { status: 500 },
    );
  }
}