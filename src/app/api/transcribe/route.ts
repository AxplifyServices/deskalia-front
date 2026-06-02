import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const formData = await request.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Aucun fichier audio fourni.' },
        { status: 400 },
      );
    }

    const backendFormData = new FormData();
    backendFormData.append('audio', audio, audio.name || 'audio.webm');

    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: backendFormData,
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.error ?? data?.details ?? 'Erreur transcription.' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      text: data.text ?? '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur transcription.',
      },
      { status: 500 },
    );
  }
}