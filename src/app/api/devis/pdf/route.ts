import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  previewValue,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  console.log('');
  console.log('='.repeat(80));
  console.log(`[API devis/pdf][${requestId}] Requête reçue`);
  console.log(`[API devis/pdf][${requestId}] API_BASE_URL =`, API_BASE_URL);

  const authorization = getBearerToken(request);

  console.log(
    `[API devis/pdf][${requestId}] Authorization présent =`,
    Boolean(authorization),
  );
  console.log(
    `[API devis/pdf][${requestId}] Authorization preview =`,
    previewValue(authorization),
  );

  if (!authorization) {
    console.warn(`[API devis/pdf][${requestId}] Refus: utilisateur non connecté`);
    return unauthorizedResponse();
  }

  try {
    const url = new URL(request.url);
    const downloadUrl = url.searchParams.get('downloadUrl');

    console.log(`[API devis/pdf][${requestId}] downloadUrl =`, downloadUrl);

    if (!downloadUrl || !downloadUrl.startsWith('/devis/')) {
      console.warn(`[API devis/pdf][${requestId}] downloadUrl invalide`, downloadUrl);

      return NextResponse.json(
        {
          success: false,
          error: 'downloadUrl invalide.',
          downloadUrl,
        },
        { status: 400 },
      );
    }

    const backendPdfUrl = `${API_BASE_URL}${downloadUrl}`;

    console.log(`[API devis/pdf][${requestId}] URL backend appelée =`, backendPdfUrl);

    const response = await fetch(backendPdfUrl, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        Accept: 'application/pdf',
      },
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type');

    console.log(`[API devis/pdf][${requestId}] Status backend =`, response.status);
    console.log(`[API devis/pdf][${requestId}] Content-Type backend =`, contentType);

    if (!response.ok) {
      const details = await response.text().catch(() => '');

      console.error(`[API devis/pdf][${requestId}] PDF inaccessible`, {
        status: response.status,
        details,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'PDF introuvable ou inaccessible.',
          status: response.status,
          details,
        },
        { status: response.status },
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    console.log(
      `[API devis/pdf][${requestId}] PDF récupéré. Taille =`,
      pdfBuffer.byteLength,
    );

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="devis.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(`[API devis/pdf][${requestId}] Exception proxy Next =`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur PDF.',
      },
      { status: 500 },
    );
  }
}