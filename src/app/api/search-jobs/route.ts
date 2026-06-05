import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  logServer,
  previewValue,
  readBackendJson,
} from '@/lib/backend';

export const runtime = 'nodejs';

const GUEST_API_KEY =
  process.env.DESKALIA_GUEST_API_KEY ?? 'guest-dev-key-change-in-prod';

console.log('[API search-jobs][BOOT] API_BASE_URL =', API_BASE_URL);
console.log('[API search-jobs][BOOT] DESKALIA_GUEST_API_KEY présent =', Boolean(GUEST_API_KEY));
console.log('[API search-jobs][BOOT] DESKALIA_GUEST_API_KEY preview =', previewValue(GUEST_API_KEY));

type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function normalizeChatHistory(value: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is ChatHistoryMessage => {
      if (!message || typeof message !== 'object') return false;

      const item = message as Partial<ChatHistoryMessage>;

      return (
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
      );
    })
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

async function persistConversationWithChatApi(params: {
  requestId: string;
  authorization: string;
  query: string;
  conversationId: string;
  chatHistory: ChatHistoryMessage[];
}) {
  const { requestId, authorization, query, conversationId, chatHistory } = params;

  try {
    logServer(requestId, '[search-jobs][persist] Sauvegarde conversation via /chat', {
      conversationId,
      historyLength: chatHistory.length,
    });

    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify({
        message: query,
        conversation_id: conversationId,
        chat_history: chatHistory,
        search_id: crypto.randomUUID(),
      }),
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      logServer(requestId, '[search-jobs][persist] Echec sauvegarde /chat', {
        status: response.status,
        data,
      });

      return {
        success: false,
        status: response.status,
        error: data?.error ?? data?.details ?? 'Erreur sauvegarde conversation.',
      };
    }

    logServer(requestId, '[search-jobs][persist] Conversation sauvegardée', {
      conversationId,
    });

    return {
      success: true,
      status: response.status,
    };
  } catch (error) {
    console.error(`[API search-jobs][${requestId}][persist] Exception =`, error);

    return {
      success: false,
      status: 500,
      error:
        error instanceof Error
          ? error.message
          : 'Erreur inconnue pendant la sauvegarde conversation.',
    };
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  console.log('');
  console.log('='.repeat(100));
  logServer(requestId, '[search-jobs] Requête reçue');
  logServer(requestId, '[search-jobs] API_BASE_URL', API_BASE_URL);
  logServer(requestId, '[search-jobs] NEXT_PUBLIC_SKIP_AUTH', process.env.NEXT_PUBLIC_SKIP_AUTH);
  console.log('='.repeat(100));

  const authorization = getBearerToken(request);
  const useGuestMode = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || !authorization;

  logServer(requestId, '[search-jobs] Authorization présent', Boolean(authorization));
  logServer(requestId, '[search-jobs] Mode invité', useGuestMode);

  try {
    const body = await request.json();

    const query = String(body.query ?? '').trim();
    const conversationId =
      typeof body.conversation_id === 'string' && body.conversation_id.trim()
        ? body.conversation_id.trim()
        : crypto.randomUUID();

    const chatHistory = normalizeChatHistory(body.chat_history);
    const shouldPersistConversation =
      !useGuestMode && Boolean(authorization) && body.persist_conversation !== false;

    logServer(requestId, '[search-jobs] Payload front', body);
    logServer(requestId, '[search-jobs] Query nettoyée', query);
    logServer(requestId, '[search-jobs] Conversation ID', conversationId);
    logServer(requestId, '[search-jobs] Persistance conversation demandée', shouldPersistConversation);

    if (!query) {
      logServer(requestId, '[search-jobs] Erreur: query vide');

      return NextResponse.json(
        { success: false, error: 'Query requise.' },
        { status: 400 },
      );
    }

    const backendUrl = useGuestMode
      ? `${API_BASE_URL}/api/guest/search-jobs`
      : `${API_BASE_URL}/api/search-jobs`;

    logServer(requestId, '[search-jobs] URL backend appelée', backendUrl);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (useGuestMode) {
      headers['X-API-Key'] = GUEST_API_KEY;

      logServer(requestId, '[search-jobs] Header X-API-Key ajouté', Boolean(headers['X-API-Key']));
      logServer(requestId, '[search-jobs] Header X-API-Key preview', previewValue(headers['X-API-Key']));
    } else if (authorization) {
      headers.Authorization = authorization;

      logServer(requestId, '[search-jobs] Header Authorization ajouté', true);
      logServer(requestId, '[search-jobs] Header Authorization preview', previewValue(authorization));
    }

    logServer(requestId, '[search-jobs] Headers envoyés au back', {
      Accept: headers.Accept,
      ContentType: headers['Content-Type'],
      hasAuthorization: Boolean(headers.Authorization),
      authorizationPreview: previewValue(headers.Authorization),
      hasApiKey: Boolean(headers['X-API-Key']),
      apiKeyPreview: previewValue(headers['X-API-Key']),
    });

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify({ query }),
    });

    const data = await readBackendJson(response);

    logServer(requestId, '[search-jobs] Status backend', response.status);
    logServer(requestId, '[search-jobs] Réponse backend parsée', data);

    if (!response.ok) {
      const errorMessage =
        data?.error ??
        data?.details ??
        data?.msg ??
        `Erreur API search-jobs côté back. Status ${response.status}`;

      logServer(requestId, '[search-jobs] Erreur backend', {
        status: response.status,
        errorMessage,
        details: data,
      });

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: data,
          backendStatus: response.status,
          mode: useGuestMode ? 'guest' : 'authenticated',
          conversation_id: conversationId,
        },
        { status: response.status },
      );
    }

    let conversationPersistence:
      | {
          success: boolean;
          status: number;
          error?: string;
        }
      | null = null;

    if (shouldPersistConversation && authorization) {
      conversationPersistence = await persistConversationWithChatApi({
        requestId,
        authorization,
        query,
        conversationId,
        chatHistory,
      });
    }

    logServer(requestId, '[search-jobs] Succès', {
      mode: useGuestMode ? 'guest' : 'authenticated',
      conversationId,
      conversationPersistence,
    });

    return NextResponse.json({
      success: true,
      jobs: data,
      mode: useGuestMode ? 'guest' : 'authenticated',
      conversation_id: conversationId,
      conversation_persistence: conversationPersistence,
    });
  } catch (error) {
    console.error(`[API search-jobs][${requestId}] Exception proxy Next =`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur search-jobs.',
      },
      { status: 500 },
    );
  }
}