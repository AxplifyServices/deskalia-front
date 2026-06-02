import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function POST(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const message = String(body.message ?? '').trim();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message requis.' },
        { status: 400 },
      );
    }

    const payload = {
      chat_history: Array.isArray(body.chat_history)
        ? (body.chat_history as ChatMessage[])
        : [],
      conversation_id: body.conversation_id ?? crypto.randomUUID(),
      message,
      search_id: body.search_id ?? crypto.randomUUID(),
    };

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.error ?? data?.details ?? 'Erreur API chat.' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
      conversation_id: payload.conversation_id,
      search_id: payload.search_id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur chat.',
      },
      { status: 500 },
    );
  }
}