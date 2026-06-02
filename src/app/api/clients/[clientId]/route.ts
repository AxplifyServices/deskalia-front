import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

type ClientUpdatePayload = {
  nom_client?: string;
  prenom_client?: string;
  mail_client?: string;
  numero_tel?: string;
};

function sanitizeClientUpdatePayload(body: Record<string, unknown>): ClientUpdatePayload {
  return {
    nom_client: typeof body.nom_client === 'string' ? body.nom_client : undefined,
    prenom_client: typeof body.prenom_client === 'string' ? body.prenom_client : undefined,
    mail_client: typeof body.mail_client === 'string' ? body.mail_client : undefined,
    numero_tel: typeof body.numero_tel === 'string' ? body.numero_tel : undefined,
  };
}

export async function PUT(request: Request, context: RouteContext) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await context.params;
    const body = await request.json();
    const safeBody = sanitizeClientUpdatePayload(body ?? {});

    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(safeBody),
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data?.error ?? data?.details ?? 'Impossible de modifier le client.',
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
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur modification client.',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await context.params;

    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, {
      method: 'DELETE',
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
          error: data?.error ?? data?.details ?? 'Impossible de supprimer le client.',
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
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur suppression client.',
      },
      { status: 500 },
    );
  }
}