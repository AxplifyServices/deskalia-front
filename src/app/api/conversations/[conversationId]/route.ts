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
    conversationId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const { conversationId } = await context.params;

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId manquant.' },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
        },
        cache: 'no-store',
      },
    );

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error ??
            data?.details ??
            'Impossible de supprimer la conversation.',
          details: data,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error('[API conversations] Erreur DELETE =', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur suppression conversation.',
      },
      { status: 500 },
    );
  }
}