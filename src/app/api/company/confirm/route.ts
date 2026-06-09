import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CompanyPayload = Record<string, unknown>;

function getString(source: CompanyPayload, keys: string[]) {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeCompanyPayload(raw: unknown): CompanyPayload {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as CompanyPayload)
      : {};

  const company =
    input.company && typeof input.company === 'object' && !Array.isArray(input.company)
      ? (input.company as CompanyPayload)
      : input;

  const denomination = getString(company, [
    'denomination',
    'Dénomination',
    'nom_entreprise',
    'name',
    'company_name',
    'raison_sociale',
  ]);

  const siren = digitsOnly(
    getString(company, [
      'siren',
      'SIREN',
    ]),
  );

  const siret = digitsOnly(
    getString(company, [
      'siret',
      'SIRET',
      'SIRET du siège social',
      'siret_siege',
    ]),
  );

  const adresse = getString(company, [
    'adresse',
    'Adresse',
    'Adresse postale',
    'address',
  ]);

  const codeNaf = getString(company, [
    'code_naf',
    'code_ape',
    'Code NAF/APE',
    'ape',
  ]);

  const formeJuridique = getString(company, [
    'forme_juridique',
    'Forme juridique',
    'legal_form',
  ]);

  const dirigeants = getString(company, [
    'dirigeants',
    'Dirigeants',
  ]);

  const capitalSocial = getString(company, [
    'capital_social',
    'Capital social',
  ]);

  return {
    ...company,

    // Champs techniques attendus par le backend
    denomination,
    siren,
    siret,
    adresse,
    code_naf: codeNaf,
    code_ape: codeNaf,
    forme_juridique: formeJuridique,
    dirigeants,
    capital_social: capitalSocial || null,

    // On garde aussi les libellés français pour compatibilité avec save_company
    'Dénomination': company['Dénomination'] ?? denomination,
    SIREN: company.SIREN ?? siren,
    'SIRET du siège social': company['SIRET du siège social'] ?? siret,
    'Adresse postale': company['Adresse postale'] ?? adresse,
    'Code NAF/APE': company['Code NAF/APE'] ?? codeNaf,
    'Forme juridique': company['Forme juridique'] ?? formeJuridique,
    Dirigeants: company.Dirigeants ?? dirigeants,
    'Capital social': company['Capital social'] ?? capitalSocial ?? null,
  };
}

function getCompanyIdentifier(company: CompanyPayload) {
  const siret = digitsOnly(getString(company, ['siret', 'SIRET', 'SIRET du siège social']));
  const siren = digitsOnly(getString(company, ['siren', 'SIREN']));

  return {
    siret,
    siren,
  };
}

async function findExistingCompanyId(
  authorization: string,
  normalizedCompany: CompanyPayload,
) {
  const target = getCompanyIdentifier(normalizedCompany);

  if (!target.siret && !target.siren) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/companies`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authorization,
    },
    cache: 'no-store',
  });

  const data = await readBackendJson(response);

  if (!response.ok || !Array.isArray(data?.companies)) {
    return null;
  }

  for (const company of data.companies as CompanyPayload[]) {
    const current = getCompanyIdentifier(company);

    const sameSiret = target.siret && current.siret && target.siret === current.siret;
    const sameSiren = target.siren && current.siren && target.siren === current.siren;

    if (sameSiret || sameSiren) {
      const id =
        company.id ??
        company.company_id ??
        company.id_company;

      const numericId = Number(id);

      return Number.isFinite(numericId) && numericId > 0 ? numericId : null;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[COMPANY CONFIRM][${requestId}] Requête reçue`);
  console.log(`[COMPANY CONFIRM][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log(`[COMPANY CONFIRM][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log('='.repeat(100));

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const rawBody = await request.json();
    const company = normalizeCompanyPayload(rawBody);

    console.log(`[COMPANY CONFIRM][${requestId}] Entreprise normalisée =`, company);

    const denomination = getString(company, ['denomination', 'Dénomination']);
    const siren = getString(company, ['siren', 'SIREN']);
    const siret = getString(company, ['siret', 'SIRET', 'SIRET du siège social']);

    if (!denomination && !siren && !siret) {
      return NextResponse.json(
        {
          success: false,
          step: 'validate-company',
          error:
            "Entreprise invalide : impossible de récupérer la dénomination, le SIREN ou le SIRET.",
        },
        { status: 400 },
      );
    }

    console.log('');
    console.log(`[COMPANY CONFIRM][${requestId}] Étape 1/2 : sauvegarde entreprise`);
    console.log(`[COMPANY CONFIRM][${requestId}] URL appelée = ${API_BASE_URL}/api/companies`);

    const saveResponse = await fetch(`${API_BASE_URL}/api/companies`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(company),
    });

    const saveData = await readBackendJson(saveResponse);

    console.log(`[COMPANY CONFIRM][${requestId}] Status sauvegarde =`, saveResponse.status);
    console.log(`[COMPANY CONFIRM][${requestId}] Réponse sauvegarde =`, saveData);

    let companyId = Number(saveData?.company_id);

    if (!Number.isFinite(companyId) || companyId <= 0) {
      console.warn(
        `[COMPANY CONFIRM][${requestId}] company_id absent après sauvegarde. Tentative de retrouver une entreprise existante.`,
      );

      const existingCompanyId = await findExistingCompanyId(authorization, company);

      if (existingCompanyId) {
        companyId = existingCompanyId;
        console.log(
          `[COMPANY CONFIRM][${requestId}] Entreprise existante retrouvée avec id =`,
          companyId,
        );
      }
    }

    if (!saveResponse.ok && (!Number.isFinite(companyId) || companyId <= 0)) {
      return NextResponse.json(
        {
          success: false,
          step: 'save-company',
          backend_status: saveResponse.status,
          backend_response: saveData,
          error:
            saveData?.error ??
            saveData?.details ??
            "Impossible d'enregistrer l'entreprise.",
        },
        { status: saveResponse.status || 500 },
      );
    }

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json(
        {
          success: false,
          step: 'save-company',
          backend_response: saveData,
          error:
            "Entreprise enregistrée ou déjà existante, mais aucun company_id exploitable n'a été retourné.",
        },
        { status: 400 },
      );
    }

    console.log('');
    console.log(`[COMPANY CONFIRM][${requestId}] Étape 2/2 : liaison entreprise au compte`);
    console.log(`[COMPANY CONFIRM][${requestId}] company_id =`, companyId);
    console.log(`[COMPANY CONFIRM][${requestId}] URL appelée = ${API_BASE_URL}/api/user/link-company`);

    const linkResponse = await fetch(`${API_BASE_URL}/api/user/link-company`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify({
        company_id: companyId,
      }),
    });

    const linkData = await readBackendJson(linkResponse);

    console.log(`[COMPANY CONFIRM][${requestId}] Status liaison =`, linkResponse.status);
    console.log(`[COMPANY CONFIRM][${requestId}] Réponse liaison =`, linkData);

    if (!linkResponse.ok || linkData?.success === false) {
      return NextResponse.json(
        {
          success: false,
          step: 'link-company',
          company_id: companyId,
          backend_status: linkResponse.status,
          backend_response: linkData,
          error:
            linkData?.error ??
            linkData?.details ??
            'Entreprise enregistrée, mais liaison au compte impossible.',
        },
        { status: linkResponse.status || 500 },
      );
    }

    console.log('');
    console.log(`[COMPANY CONFIRM][${requestId}] Entreprise liée avec succès au compte`);
    console.log(`[COMPANY CONFIRM][${requestId}] company_id =`, companyId);
    console.log('='.repeat(100));

    return NextResponse.json({
      success: true,
      company_id: companyId,
      company,
      message: linkData?.message ?? 'Entreprise liée au compte.',
    });
  } catch (error) {
    console.error(`[COMPANY CONFIRM][${requestId}] Exception =`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur entreprise.',
      },
      { status: 500 },
    );
  }
}