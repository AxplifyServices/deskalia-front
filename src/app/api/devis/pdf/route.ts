import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
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
    const url = new URL(request.url);
    const downloadUrl = url.searchParams.get('downloadUrl');

    if (!downloadUrl || !downloadUrl.startsWith('/devis/')) {
      return NextResponse.json({ error: 'downloadUrl invalide.' }, { status: 400 });
    }

    const response = await fetch(`${API_BASE_URL}${downloadUrl}`, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        Accept: 'application/pdf',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'PDF introuvable ou inaccessible.',
          status: response.status,
          details: await response.text(),
        },
        { status: response.status },
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="devis.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur PDF.' },
      { status: 500 },
    );
  }
}