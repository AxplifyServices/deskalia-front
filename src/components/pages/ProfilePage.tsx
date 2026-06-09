'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/pages/PageFrame';
import { authHeaders, setAuthSession, type UserProfile } from '@/lib/auth-client';

type PricingPreferences = {
  frais_operation: number | '';
  frais_chantier: number | '';
  marge_benefice: number | '';
  tarif_horraire: number | '';
  coefficient_general: number | '';
};

type CompanyResult = {
  denomination?: string;
  nom_complet?: string;
  siren?: string;
  siret?: string;
  adresse?: string;
  code_naf?: string;

  'Dénomination'?: string;
  'Nom complet'?: string;
  'Adresse postale'?: string;
  'SIREN'?: string;
  'SIRET du siège social'?: string;
  'Forme juridique'?: string;
  'Code NAF/APE'?: string;
};

type LinkedCompany = {
  id?: number;
  denomination?: string;
  company_name?: string;
  nom_complet?: string;
  siren?: string;
  siret?: string;
  adresse?: string;
  [key: string]: unknown;
};

const PERSONAL_FIELDS = [
  'nom',
  'prenom',
  'mail_user',
  'tel',
  'numero_gsm',
  'adresse',
  'code_postal',
  'ville',
  'site_web',
  'statut_juridique',
] as const;

const COMPANY_FIELDS = [
  'company_denomination',
  'company_adresse',
  'num_siret',
  'siret',
  'num_tva',
  'capital_social',
  'rcs',
  'code_ape',
  'assurance_decennale',
  'n_rm',
  'rc_pro',
  'iban',
  'bic',
] as const;

const PRICING_FIELDS = [
  'frais_operation',
  'frais_chantier',
  'marge_benefice',
  'tarif_horraire',
  'coefficient_general',
] as const;

export default function ProfilePage() {
  const t = useTranslations('Profile');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [pricing, setPricing] = useState<PricingPreferences>({
    frais_operation: '',
    frais_chantier: '',
    marge_benefice: '',
    tarif_horraire: '',
    coefficient_general: '',
  });

  const [linkedCompany, setLinkedCompany] = useState<LinkedCompany | null>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([]);
const [logoVersion, setLogoVersion] = useState(() => Date.now());
const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
const [logoFailed, setLogoFailed] = useState(true);
const [feedback, setFeedback] = useState<{
  type: 'success' | 'error';
  message: string;
} | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [linkingCompany, setLinkingCompany] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
  let cancelled = false;
  let currentObjectUrl: string | null = null;

  async function loadLogo() {
    try {
      setLogoFailed(true);

      const response = await fetch(`/api/profile/logo?v=${logoVersion}`, {
        method: 'GET',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        if (!cancelled) {
          setLogoObjectUrl(null);
          setLogoFailed(true);
        }

        return;
      }

      const blob = await response.blob();

      if (!blob.type.startsWith('image/')) {
        if (!cancelled) {
          setLogoObjectUrl(null);
          setLogoFailed(true);
        }

        return;
      }

      currentObjectUrl = URL.createObjectURL(blob);

      if (!cancelled) {
        setLogoObjectUrl(currentObjectUrl);
        setLogoFailed(false);
      }
    } catch (error) {
      console.error('[PROFILE LOGO] Impossible de charger le logo', error);

      if (!cancelled) {
        setLogoObjectUrl(null);
        setLogoFailed(true);
      }
    }
  }

  void loadLogo();

  return () => {
    cancelled = true;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
  };
}, [logoVersion]);

function showSuccess(message: string) {
  setFeedback({ type: 'success', message });
  window.setTimeout(() => {
    setFeedback(null);
  }, 4500);
}

function showError(message: string) {
  setFeedback({ type: 'error', message });
}

function normalizeApiError(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes('no company linked') ||
    lower.includes('link a company first')
  ) {
    return t('logoNeedsCompany');
  }

  if (
    lower.includes('duplicate key value') &&
    lower.includes('siret')
  ) {
    return t('companyAlreadyExists');
  }

  return message;
}

  async function loadAll() {
    setLoading(true);

    await Promise.all([
      loadProfile(),
      loadPricing(),
      loadLinkedCompany(),
    ]);

    setLoading(false);
  }

  async function loadProfile() {
    try {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('loadProfileError'));
      }

      const loadedProfile = data.profile ?? {};
      setProfile(loadedProfile);

      const nextForm: Record<string, string> = {};
      [...PERSONAL_FIELDS, ...COMPANY_FIELDS].forEach((field) => {
        nextForm[field] = stringifyProfileValue(loadedProfile[field]);
      });
      setProfileForm(nextForm);
    } catch (error) {
      console.error('[PROFILE] Erreur chargement profil', error);
    }
  }

async function loadPricing() {
  try {
    const response = await fetch('/api/user/pricing-preferences', {
      method: 'GET',
      headers: {
        ...authHeaders(),
      },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      setPricing({
        frais_operation: '',
        frais_chantier: '',
        marge_benefice: '',
        tarif_horraire: '',
        coefficient_general: '',
      });

      setFeedback({
        type: 'error',
        message:
          data.error ||
          data.details ||
          t('loadPricingError'),
      });

      return;
    }

    const preferences = data.preferences ?? {};

    setPricing({
      frais_operation: toNumberOrEmpty(preferences.frais_operation),
      frais_chantier: toNumberOrEmpty(preferences.frais_chantier),
      marge_benefice: toNumberOrEmpty(preferences.marge_benefice),
      tarif_horraire: toNumberOrEmpty(preferences.tarif_horraire),
      coefficient_general: toNumberOrEmpty(preferences.coefficient_general),
    });
  } catch {
    setPricing({
      frais_operation: '',
      frais_chantier: '',
      marge_benefice: '',
      tarif_horraire: '',
      coefficient_general: '',
    });

    setFeedback({
      type: 'error',
      message: t('loadPricingError'),
    });
  }
}

  async function loadLinkedCompany() {
    try {
      const response = await fetch('/api/user/company', {
        method: 'GET',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        return;
      }

      setLinkedCompany(data.company ?? null);
    } catch (error) {
      console.error('[PROFILE] Erreur chargement entreprise liée', error);
    }
  }

  function updateProfileField(field: string, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePricingField(field: keyof PricingPreferences, value: string) {
    setPricing((current) => ({
      ...current,
      [field]: value === '' ? '' : Number(value),
    }));
  }

async function saveProfile(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setSavingProfile(true);
  setFeedback(null);

  try {
    const payload: Record<string, string | null> = {};

    [...PERSONAL_FIELDS, ...COMPANY_FIELDS].forEach((field) => {
      if (field === 'mail_user') return;

      const value = profileForm[field]?.trim() ?? '';
      payload[field] = value || null;
    });

    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error ||
          data.details ||
          data.backend_response?.error ||
          t('saveProfileError'),
      );
    }

    const refreshedProfile = data.profile;

    if (!refreshedProfile) {
      throw new Error(
        "Le profil a été envoyé à l'API, mais le profil rechargé est vide.",
      );
    }

    const notPersistedFields = getNotPersistedFields(payload, refreshedProfile);

    setProfile(refreshedProfile);

    const nextForm: Record<string, string> = {};
    [...PERSONAL_FIELDS, ...COMPANY_FIELDS].forEach((field) => {
      nextForm[field] = stringifyProfileValue(refreshedProfile[field]);
    });
    setProfileForm(nextForm);

    const token = localStorage.getItem('deskalia_access_token');

    if (token) {
      setAuthSession(token, refreshedProfile);
    }

    if (notPersistedFields.length > 0) {
      showError(
        `${t('profilePartiallySaved')} ${notPersistedFields
          .map((field) => t(`fields.${field}`))
          .join(', ')}`,
      );
      return;
    }

    showSuccess(t('profileSaved'));
  } catch (error) {
    showError(
      error instanceof Error
        ? normalizeApiError(error.message)
        : t('saveProfileError'),
    );
  } finally {
    setSavingProfile(false);
  }
}

  async function savePricing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPricing(true);

    try {
      const payload: Record<string, number | null> = {};

      PRICING_FIELDS.forEach((field) => {
        const value = pricing[field];
        payload[field] = value === '' ? null : Number(value);
      });

      const response = await fetch('/api/user/pricing-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('savePricingError'));
      }

      showSuccess(t('pricingSaved'));
} catch (error) {
  showError(error instanceof Error ? normalizeApiError(error.message) : t('savePricingError'));
} finally {
      setSavingPricing(false);
    }
  }

async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!linkedCompany) {
    showError(t('logoNeedsCompany'));
    event.target.value = '';
    return;
  }

  setSavingLogo(true);
  setFeedback(null);

  try {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch('/api/profile/logo', {
      method: 'POST',
      headers: {
        ...authHeaders(),
      },
      cache: 'no-store',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      showError(normalizeApiError(data.error || data.details || t('logoUploadError')));
      return;
    }

setLogoObjectUrl(null);
setLogoFailed(true);
setLogoVersion(Date.now());
showSuccess(t('logoDeleted'));
  } catch (error) {
    showError(error instanceof Error ? normalizeApiError(error.message) : t('logoUploadError'));
  } finally {
    setSavingLogo(false);
    event.target.value = '';
  }
}

  async function deleteLogo() {
    const confirmed = window.confirm(t('deleteLogoConfirm'));

    if (!confirmed) return;

    setSavingLogo(true);

    try {
      const response = await fetch('/api/profile/logo', {
        method: 'DELETE',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('logoDeleteError'));
      }

      setLogoVersion(Date.now());
      setLogoFailed(false);
      showSuccess(t('logoDeleted'));
} catch (error) {
  showError(error instanceof Error ? normalizeApiError(error.message) : t('logoDeleteError'));
} finally {
      setSavingLogo(false);
    }
  }

async function searchCompany() {
  const query = companyQuery.trim();

  if (!query) return;

  setSearchingCompany(true);
  setCompanyResults([]);
  setFeedback(null);

  try {
    const digits = query.replace(/\D/g, '');
    const searchType = digits.length === 9 ? 'siren' : 'name';

    const response = await fetch('/api/company-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify({
        search_type: searchType,
        q: searchType === 'siren' ? digits : query,
        siren: searchType === 'siren' ? digits : undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.error || t('companySearchError'));
    }

    setCompanyResults(data.companies ?? []);
  } catch (error) {
    showError(
      error instanceof Error
        ? normalizeApiError(error.message)
        : t('companySearchError'),
    );
  } finally {
    setSearchingCompany(false);
  }
}

async function linkCompany(company: CompanyResult) {
  const confirmed = window.confirm(
    linkedCompany
      ? t('confirmCompanyChange')
      : t('confirmCompanyLink'),
  );

  if (!confirmed) return;

  setLinkingCompany(true);
  setFeedback(null);

  try {
    const response = await fetch('/api/company/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify(company),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      showError(
        normalizeApiError(
          data.error ||
            data.details ||
            data.backend_response?.error ||
            t('companyLinkError'),
        ),
      );
      return;
    }

    setCompanyQuery('');
    setCompanyResults([]);

    await Promise.all([
      loadProfile(),
      loadLinkedCompany(),
    ]);

    setLogoVersion(Date.now());
    showSuccess(
      linkedCompany ? t('companyChanged') : t('companyLinked'),
    );
  } catch (error) {
    showError(
      error instanceof Error
        ? normalizeApiError(error.message)
        : t('companyLinkError'),
    );
  } finally {
    setLinkingCompany(false);
  }
}

  return (
    <PageFrame title={t('title')}>
      {loading ? (
        <div className="rounded-[18px] bg-white p-5 text-[14px] font-bold text-[#704f49] shadow-sm">
          {t('loading')}
        </div>
      ) : (
        <div className="space-y-4 pb-8">
            {feedback ? (
  <div
    className={`rounded-[14px] border p-4 text-[13px] font-bold leading-relaxed ${
      feedback.type === 'success'
        ? 'border-[#cfe8d4] bg-[#f0fff3] text-[#276738]'
        : 'border-[#ffd4cd] bg-[#fff3f0] text-[#b83220]'
    }`}
  >
    {feedback.message}
  </div>
) : null}
          <section className="rounded-[18px] bg-white p-4 shadow-sm lg:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
<div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-[#f1ece8] text-[28px] font-black text-[#704f49]">
  {logoObjectUrl && !logoFailed ? (
    <img
      key={logoObjectUrl}
      src={logoObjectUrl}
      alt={t('logoAlt')}
      className="h-full w-full object-cover"
      onError={() => {
        setLogoObjectUrl(null);
        setLogoFailed(true);
      }}
    />
  ) : (
    <span className="absolute inset-0 flex items-center justify-center">
      {getInitial(profile)}
    </span>
  )}
</div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[18px] font-extrabold">
                  {getDisplayName(profile)}
                </p>
                <p className="truncate text-[13px] font-bold text-[#704f49]">
                  {profile?.mail_user ? String(profile.mail_user) : t('noEmail')}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#8c7770]">
                  {t('logoHelp')}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:w-[210px]">
                <label className="flex h-11 cursor-pointer items-center justify-center rounded-[12px] bg-[#704f49] px-4 text-[13px] font-extrabold text-white active:scale-[0.98]">
                  {savingLogo ? t('saving') : t('uploadLogo')}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={uploadLogo}
                    disabled={savingLogo}
                  />
                </label>

                <button
                  type="button"
                  onClick={deleteLogo}
                  disabled={savingLogo}
                  className="h-11 rounded-[12px] bg-[#fff0ee] px-4 text-[13px] font-extrabold text-[#c63b28] disabled:opacity-60"
                >
                  {t('deleteLogo')}
                </button>
              </div>
            </div>
          </section>

          <form
            onSubmit={saveProfile}
            className="rounded-[18px] bg-white p-4 shadow-sm lg:p-5"
          >
            <SectionHeader
              title={t('personalInfo')}
              description={t('personalInfoDescription')}
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
{PERSONAL_FIELDS.map((field) => (
  <TextField
    key={field}
    label={t(`fields.${field}`)}
    value={profileForm[field] ?? ''}
    onChange={(value) => updateProfileField(field, value)}
    type={field === 'mail_user' ? 'email' : 'text'}
    disabled={field === 'mail_user'}
    help={field === 'mail_user' ? t('emailLocked') : undefined}
  />
))}
            </div>

            <SectionHeader
              title={t('companyInfo')}
              description={t('companyInfoDescription')}
              className="mt-6"
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COMPANY_FIELDS.map((field) => (
                <TextField
                  key={field}
                  label={t(`fields.${field}`)}
                  value={profileForm[field] ?? ''}
                  onChange={(value) => updateProfileField(field, value)}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="mt-5 h-12 w-full rounded-[14px] bg-[#2b201e] text-[15px] font-extrabold text-white disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {savingProfile ? t('saving') : t('saveProfile')}
            </button>
          </form>

          <form
            onSubmit={savePricing}
            className="rounded-[18px] bg-white p-4 shadow-sm lg:p-5"
          >
            <SectionHeader
              title={t('pricingPreferences')}
              description={t('pricingDescription')}
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PRICING_FIELDS.map((field) => (
                <TextField
                  key={field}
                  label={t(`fields.${field}`)}
                  value={String(pricing[field] ?? '')}
                  onChange={(value) => updatePricingField(field, value)}
                  type="number"
                  step="0.01"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={savingPricing}
              className="mt-5 h-12 w-full rounded-[14px] bg-[#2b201e] text-[15px] font-extrabold text-white disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {savingPricing ? t('saving') : t('savePricing')}
            </button>
          </form>

          <section className="rounded-[18px] bg-white p-4 shadow-sm lg:p-5">
            <SectionHeader
              title={t('linkedCompany')}
              description={t('linkedCompanyDescription')}
            />

            <div className="mt-4 rounded-[14px] bg-[#f8f4f1] p-4">
              <p className="text-[14px] font-extrabold">
                {linkedCompany ? getCompanyName(linkedCompany) : t('noLinkedCompany')}
              </p>
              {linkedCompany ? (
                <p className="mt-1 text-[12px] font-bold text-[#704f49]">
                  {[
                    getCompanySiren(linkedCompany),
                    getCompanySiret(linkedCompany),
                    getCompanyAddress(linkedCompany),
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={companyQuery}
                onChange={(event) => setCompanyQuery(event.target.value)}
                placeholder={t('companySearchPlaceholder')}
                className="h-12 min-w-0 flex-1 rounded-[14px] border border-[#e5d5cd] bg-white px-4 text-[15px] font-semibold outline-none focus:border-[#704f49]"
              />

              <button
                type="button"
                onClick={searchCompany}
                disabled={searchingCompany || !companyQuery.trim()}
                className="h-12 rounded-[14px] bg-[#704f49] px-5 text-[14px] font-extrabold text-white disabled:opacity-60"
              >
                {searchingCompany ? t('searching') : t('searchCompany')}
              </button>
            </div>

            {companyResults.length > 0 ? (
              <div className="mt-3 space-y-2">
                {companyResults.map((company, index) => (
                  <button
                    key={`${getCompanySiren(company)}-${index}`}
                    type="button"
                    onClick={() => linkCompany(company)}
                    disabled={linkingCompany}
                    className="w-full rounded-[14px] border border-[#eadbd3] bg-white p-4 text-left active:scale-[0.99] disabled:opacity-60"
                  >
                    <p className="text-[14px] font-extrabold">
                      {getCompanyName(company)}
                    </p>
                    <p className="mt-1 text-[12px] font-bold text-[#704f49]">
                      {[
                        getCompanySiren(company),
                        getCompanySiret(company),
                        getCompanyAddress(company),
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </PageFrame>
  );
}

function SectionHeader({
  title,
  description,
  className = '',
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-[17px] font-extrabold">{title}</h2>
      <p className="mt-1 text-[13px] font-semibold leading-relaxed text-[#8c7770]">
        {description}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  step,
  disabled = false,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-extrabold text-[#704f49]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        step={step}
        disabled={disabled}
        className={`h-12 w-full rounded-[14px] border border-[#e5d5cd] px-4 text-[15px] font-semibold outline-none focus:border-[#704f49] ${
          disabled
            ? 'cursor-not-allowed bg-[#f3eee9] text-[#8c7770]'
            : 'bg-white'
        }`}
      />
      {help ? (
        <span className="mt-1 block text-[11px] font-semibold text-[#8c7770]">
          {help}
        </span>
      ) : null}
    </label>
  );
}

function stringifyProfileValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toNumberOrEmpty(value: unknown): number | '' {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
}

function getDisplayName(profile: UserProfile | null) {
  const firstName = stringifyProfileValue(profile?.prenom);
  const lastName = stringifyProfileValue(profile?.nom);
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || stringifyProfileValue(profile?.mail_user) || 'Utilisateur';
}

function getInitial(profile: UserProfile | null) {
  return getDisplayName(profile).slice(0, 1).toUpperCase();
}

function getCompanyName(company: CompanyResult | LinkedCompany) {
  return (
    stringifyProfileValue(company.denomination) ||
    stringifyProfileValue(company.nom_complet) ||
    stringifyProfileValue(company.company_name) ||
    stringifyProfileValue(company['Dénomination']) ||
    stringifyProfileValue(company['Nom complet']) ||
    'Entreprise'
  );
}

function getCompanyAddress(company: CompanyResult | LinkedCompany) {
  return (
    stringifyProfileValue(company.adresse) ||
    stringifyProfileValue(company['Adresse postale'])
  );
}

function getCompanySiren(company: CompanyResult | LinkedCompany) {
  return (
    stringifyProfileValue(company.siren) ||
    stringifyProfileValue(company['SIREN'])
  );
}

function getCompanySiret(company: CompanyResult | LinkedCompany) {
  return (
    stringifyProfileValue(company.siret) ||
    stringifyProfileValue(company['SIRET du siège social'])
  );
}

function normalizeProfileComparableValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getNotPersistedFields(
  payload: Record<string, string | null>,
  refreshedProfile: Record<string, unknown>,
) {
  return Object.entries(payload)
    .filter(([field, expectedValue]) => {
      const expected = normalizeProfileComparableValue(expectedValue);
      const actual = normalizeProfileComparableValue(refreshedProfile[field]);

      return expected !== actual;
    })
    .map(([field]) => field);
}