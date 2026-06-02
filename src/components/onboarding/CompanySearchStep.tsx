'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { authHeaders } from '@/lib/auth-client';

type CompanyResult = {
  adresse?: string;
  code_naf?: string;
  denomination?: string;
  siren?: string;
  siret?: string;

  'Adresse postale'?: string;
  'Code NAF/APE'?: string;
  'Dénomination'?: string;
  'SIREN'?: string;
  'SIRET du siège social'?: string;
  'Forme juridique'?: string;
  'Dirigeants'?: string;
  'Capital social'?: string | null;
};

type CompanySearchStepProps = {
  onContinue: (company: CompanyResult) => void;
};

export default function CompanySearchStep({ onContinue }: CompanySearchStepProps) {
  const t = useTranslations('Onboarding.companySearch');

  const [companyName, setCompanyName] = useState('');
  const [result, setResult] = useState<CompanyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedView, setConfirmedView] = useState(false);
  const [error, setError] = useState('');

 async function searchCompany() {
    if (!companyName.trim()) {
      setError(t('fieldsRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setConfirmedView(false);

    try {
      const response = await fetch('/api/company-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          search_type: 'name',
          q: companyName.trim(),
        }),
      });

      const data: {
        success: boolean;
        companies?: CompanyResult[];
        error?: string;
      } = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error ?? t('searchError'));
        return;
      }

      if (!data.companies?.length) {
        setError(t('notFound'));
        return;
      }

      setResult(data.companies[0]);
      setConfirmedView(true);
    } catch {
      setError(t('searchError'));
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    setResult(null);
    setConfirmedView(false);
    setCompanyName('');
    setError('');
  }

async function confirmCompany() {
  if (!result) {
    console.warn('[COMPANY SEARCH] confirmCompany appelé sans résultat entreprise');
    return;
  }

  const requestId = crypto.randomUUID();

  console.log('');
  console.log('='.repeat(100));
  console.log(`[COMPANY SEARCH][${requestId}] Confirmation entreprise`);
  console.log(`[COMPANY SEARCH][${requestId}] Entreprise validée =`, result);
  console.log('='.repeat(100));

  setLoading(true);
  setError('');

  try {
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders(),
    };

    console.log(`[COMPANY SEARCH][${requestId}] Appel POST /api/company/confirm`);
    console.log(`[COMPANY SEARCH][${requestId}] Headers =`, {
      hasAuthorization: Boolean(headers.Authorization),
    });

    const response = await fetch('/api/company/confirm', {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify(result),
    });

    const data = await response.json();

    console.log(`[COMPANY SEARCH][${requestId}] Status /api/company/confirm =`, response.status);
    console.log(`[COMPANY SEARCH][${requestId}] Réponse /api/company/confirm =`, data);

    if (!response.ok || !data.success) {
      console.error(`[COMPANY SEARCH][${requestId}] Liaison entreprise échouée`, data);

      setError(
        data.error ??
          "Impossible d'enregistrer et de lier l'entreprise à votre compte.",
      );
      return;
    }

    console.log(`[COMPANY SEARCH][${requestId}] Entreprise liée au compte avec succès`);
    console.log(`[COMPANY SEARCH][${requestId}] company_id =`, data.company_id);
    console.log(`[COMPANY SEARCH][${requestId}] Passage à la fin de l'onboarding`);

    onContinue(result);
  } catch (error) {
    console.error(`[COMPANY SEARCH][${requestId}] Exception confirmation entreprise =`, error);
    setError("Impossible d'enregistrer l'entreprise.");
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="h-screen overflow-hidden bg-[#f5f1ee] text-[#2b201e]">
      <section className="mx-auto flex h-screen w-full max-w-[560px] flex-col px-5 pb-4 pt-5 sm:px-8 sm:py-7">
        <Header />

        <div className="flex-1 overflow-y-auto pt-8 sm:pt-10">
          {!confirmedView ? (
            <>
              <BotMessage>{t('question')}</BotMessage>

              <div className="mt-8 space-y-3 sm:mt-10">
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder={t('companyName')}
                  className="h-[52px] w-full rounded-[14px] border border-[#ff642d] bg-transparent px-4 text-[16px] outline-none placeholder:text-[#6f4b49] sm:h-[58px] sm:text-[18px]"
                />

                {error ? (
                  <p className="text-[13px] font-semibold text-[#ff642d]">{error}</p>
                ) : null}

                <button
                  type="button"
                  onClick={searchCompany}
                  disabled={loading}
                  className="h-[52px] w-full rounded-[14px] bg-[#ff642d] text-[16px] font-extrabold text-[#241815] disabled:opacity-60 active:scale-[0.98]"
                >
                  {loading ? t('loading') : t('validate')}
                </button>
              </div>
            </>
          ) : result ? (
            <>
              <BotMessage>{t('introConfirmed')}</BotMessage>

              <UserBubble>
                {companyName}
              </UserBubble>

              <BotMessage>
                <p>{t('iaResult')}</p>

                <CompanyInfo result={result} />

                <p className="mt-5 font-extrabold">{t('isItYou')}</p>
              </BotMessage>

              <div className="mt-6 grid grid-cols-2 gap-3 pb-4">
                <button
                  type="button"
                  onClick={confirmCompany}
                  disabled={loading}
                  className="h-[56px] rounded-[14px] bg-white text-[16px] font-extrabold text-[#2b201e] disabled:opacity-60 active:scale-[0.98]"
                >
                  {loading ? t('loading') : t('yes')}
                </button>

                <button
                  type="button"
                  onClick={resetSearch}
                  className="h-[56px] rounded-[14px] bg-white text-[16px] font-extrabold text-[#2b201e] active:scale-[0.98]"
                >
                  {t('no')}
                </button>
              </div>
            </>
          ) : null}
        </div>

      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="flex shrink-0 items-center justify-center">
      <p className="text-[16px] font-extrabold">Deskalia</p>
    </header>
  );
}

function BotMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-full">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#ff642d] text-sm text-white">
        ✺
      </div>
      <div className="whitespace-pre-line text-[20px] leading-[1.35] tracking-[-0.2px] sm:text-[24px]">
        {children}
      </div>
      <p className="mt-2 text-[13px] text-[#a97b6d]">09:41</p>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 ml-auto w-fit max-w-[82%] rounded-[14px] border border-[#ddcec5] bg-white/50 px-4 py-3 text-[16px] leading-[1.45] sm:text-[18px]">
      {children}
    </div>
  );
}

function CompanyInfo({ result }: { result: CompanyResult }) {
  const denomination = result.denomination ?? result['Dénomination'];
  const adresse = result.adresse ?? result['Adresse postale'];
  const codeNaf = result.code_naf ?? result['Code NAF/APE'];
  const siren = result.siren ?? result['SIREN'];
  const siret = result.siret ?? result['SIRET du siège social'];
  const formeJuridique = result['Forme juridique'];
  const dirigeants = result['Dirigeants'];

  return (
    <div className="mt-4 space-y-2 rounded-[16px] bg-white/70 p-4 text-[13px] leading-[1.45] sm:text-[15px]">
      <InfoLine label="Dénomination" value={denomination} />
      <InfoLine label="Adresse" value={adresse} />
      <InfoLine label="Code NAF" value={codeNaf} />
      <InfoLine label="SIREN" value={siren} />
      <InfoLine label="SIRET" value={siret} />
      <InfoLine label="Forme juridique" value={formeJuridique} />
      <InfoLine label="Dirigeants" value={dirigeants} />
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <p>
      <span className="font-extrabold">{label} : </span>
      <span>{value}</span>
    </p>
  );
}

function ChatInput({ placeholder }: { placeholder: string }) {
  return (
    <div className="mt-3 flex h-[54px] shrink-0 items-center rounded-[14px] bg-white px-4">
      <span className="min-w-0 flex-1 truncate text-[15px] text-[#a97b6d] sm:text-[17px]">
        {placeholder}
      </span>

      <span className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f1ece8] text-[22px]">
        ↑
      </span>
    </div>
  );
}