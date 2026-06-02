import { NextResponse } from 'next/server';
import { API_BASE_URL, readBackendJson } from '@/lib/backend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/auth/email/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    });

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error ?? data.details ?? 'Connexion impossible.' },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      access_token: data.access_token,
      user_profile: data.user_profile,
      is_new_user: data.is_new_user ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur login.',
      },
      { status: 500 },
    );
  }
}