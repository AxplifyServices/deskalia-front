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

type BackendMessage = {
  role?: string;
  content?: string;
};

export async function GET(request: Request, context: RouteContext) {
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
      `${API_BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'GET',
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
            'Impossible de charger les messages de la conversation.',
          details: data,
        },
        { status: response.status },
      );
    }

    const rawMessages = Array.isArray(data) ? data : data?.messages;

    const messages = Array.isArray(rawMessages)
      ? rawMessages
          .filter((message: BackendMessage) => {
            return (
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.content === 'string'
            );
          })
          .map((message: BackendMessage) => ({
            role: message.role,
            content: message.content,
          }))
      : [];

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error('[API conversations messages] Erreur GET =', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur messages conversation.',
      },
      { status: 500 },
    );
  }
}