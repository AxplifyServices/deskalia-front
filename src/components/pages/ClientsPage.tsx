'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/pages/PageFrame';
import { authHeaders } from '@/lib/auth-client';

type ClientType = 'particulier' | 'entreprise';

type Client = {
  id?: number;
  nom_client?: string | null;
  prenom_client?: string | null;
  mail_client?: string | null;
  numero_tel?: string | null;
  adresse?: string | null;
  statut_client?: string | null;
  domaine_expertise_client?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  company_siren?: string | null;
  company_siret?: string | null;
  company_adresse?: string | null;
  company_forme_juridique?: string | null;
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

export default function ClientsPage() {
  const t = useTranslations('Clients');

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientType, setClientType] = useState<ClientType>('particulier');

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');

  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const clientCountLabel = useMemo(() => {
    if (clients.length <= 1) return t('oneClient');
    return t('manyClients', { count: clients.length });
  }, [clients.length, t]);

  async function loadClients() {
    setLoading(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'GET',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('loadError'));
      }

      setClients(data.clients ?? []);
    } catch (error) {
      console.error('[CLIENTS] Erreur chargement', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function searchCompany() {
    const query = companyQuery.trim();

    if (!query) return;

    setCompanyLoading(true);
    setCompanyResults([]);

    try {
      const response = await fetch('/api/company-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        cache: 'no-store',
        body: JSON.stringify({
          search_type: 'name',
          q: query,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('companySearchError'));
      }

      setCompanyResults(data.companies ?? []);
    } catch (error) {
      console.error('[CLIENTS] Erreur recherche entreprise', error);
      alert(error instanceof Error ? error.message : t('companySearchError'));
    } finally {
      setCompanyLoading(false);
    }
  }

  function selectCompany(company: CompanyResult) {
    setSelectedCompany(company);
    setCompanyResults([]);
    setClientType('entreprise');

    const companyName = getCompanyName(company);
    const companyAddress = getCompanyAddress(company);

    if (!nom.trim()) {
      setNom(companyName);
    }

    if (!adresse.trim() && companyAddress) {
      setAdresse(companyAddress);
    }
  }

  function openCreateForm() {
    if (formOpen && !editingClient) {
      resetClientForm();
      return;
    }

    resetClientForm(false);
    setFormOpen(true);
  }

  function startEditClient(client: Client) {
    setEditingClient(client);
    setFormOpen(true);
    setClientType(client.company_id ? 'entreprise' : 'particulier');
    setNom(client.nom_client ?? '');
    setPrenom(client.prenom_client ?? '');
    setEmail(client.mail_client ?? '');
    setTelephone(client.numero_tel ?? '');
    setAdresse(client.adresse ?? '');
    setCompanyQuery('');
    setCompanyResults([]);
    setSelectedCompany(null);
  }

  function resetClientForm(close = true) {
    setEditingClient(null);
    setClientType('particulier');
    setNom('');
    setPrenom('');
    setEmail('');
    setTelephone('');
    setAdresse('');
    setCompanyQuery('');
    setCompanyResults([]);
    setSelectedCompany(null);

    if (close) {
      setFormOpen(false);
    }
  }

  async function saveClient() {
    if (editingClient?.id) {
      await updateClient(editingClient.id);
      return;
    }

    await createClient();
  }

  async function createClient() {
    if (!nom.trim() && !prenom.trim()) return;

    setSaving(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        cache: 'no-store',
        body: JSON.stringify({
        nom_client: nom.trim(),
        prenom_client: clientType === 'entreprise' ? '' : prenom.trim(),
        mail_client: email.trim(),
        numero_tel: telephone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('saveError'));
      }

      const clientId = Number(data.client_id);

      if (selectedCompany && clientId) {
        await linkCompanyToClient(clientId, selectedCompany);
      }

      resetClientForm();
      await loadClients();
    } catch (error) {
      console.error('[CLIENTS] Erreur création', error);
      alert(error instanceof Error ? error.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function updateClient(clientId: number) {
    setSaving(true);

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        cache: 'no-store',
        body: JSON.stringify({
          nom_client: nom.trim(),
          prenom_client: clientType === 'entreprise' ? '' : prenom.trim(),
          mail_client: email.trim(),
          numero_tel: telephone.trim(),
          statut_client: 'Actif',
          domaine_expertise_client:
            clientType === 'entreprise' ? 'Entreprise' : 'Particulier',
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('updateError'));
      }

      if (selectedCompany) {
        await linkCompanyToClient(clientId, selectedCompany);
      }

      resetClientForm();
      await loadClients();
    } catch (error) {
      console.error('[CLIENTS] Erreur modification', error);
      alert(error instanceof Error ? error.message : t('updateError'));
    } finally {
      setSaving(false);
    }
  }

  async function linkCompanyToClient(clientId: number, company: CompanyResult) {
    const response = await fetch(`/api/clients/${clientId}/link-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      cache: 'no-store',
      body: JSON.stringify({
        company,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(data.error || t('linkCompanyError'));
    }
  }

  async function deleteClient(client: Client) {
    if (!client.id) return;

    const confirmed = window.confirm(t('deleteConfirm'));

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('deleteError'));
      }

      await loadClients();
    } catch (error) {
      console.error('[CLIENTS] Erreur suppression', error);
      alert(error instanceof Error ? error.message : t('deleteError'));
    }
  }

  return (
    <PageFrame
      title={t('title')}
      action={
        <button
          type="button"
          onClick={openCreateForm}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ff642d] text-[24px] font-black text-white shadow-sm active:scale-95"
          aria-label={t('add')}
        >
          +
        </button>
      }
    >
      <p className="mb-4 text-[13px] font-bold text-[#704f49]">
        {clientCountLabel}
      </p>

      {formOpen ? (
        <section className="mb-4 rounded-[18px] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[15px] font-extrabold">
              {editingClient ? t('editClient') : t('newClient')}
            </p>

            <button
              type="button"
              onClick={() => resetClientForm()}
              className="rounded-full bg-[#f1ece8] px-3 py-1 text-[12px] font-extrabold text-[#704f49]"
            >
              {t('cancel')}
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setClientType('particulier')}
              className={`h-10 rounded-[10px] text-[13px] font-extrabold ${
                clientType === 'particulier'
                  ? 'bg-[#ffc69d] text-[#721b12]'
                  : 'bg-[#f1ece8] text-[#704f49]'
              }`}
            >
              {t('individual')}
            </button>

            <button
              type="button"
              onClick={() => setClientType('entreprise')}
              className={`h-10 rounded-[10px] text-[13px] font-extrabold ${
                clientType === 'entreprise'
                  ? 'bg-[#ffc69d] text-[#721b12]'
                  : 'bg-[#f1ece8] text-[#704f49]'
              }`}
            >
              {t('company')}
            </button>
          </div>

          <div className="space-y-3">
            {clientType === 'entreprise' ? (
              <>
                <input
                  value={companyQuery}
                  onChange={(event) => setCompanyQuery(event.target.value)}
                  placeholder={t('companySearchPlaceholder')}
                  className="h-11 w-full rounded-[12px] border border-[#eadbd3] bg-[#fbf8f6] px-3 text-[14px] outline-none"
                />

                <button
                  type="button"
                  onClick={searchCompany}
                  disabled={companyLoading || !companyQuery.trim()}
                  className="h-10 w-full rounded-[10px] bg-[#f1ece8] text-[13px] font-extrabold disabled:opacity-50"
                >
                  {companyLoading ? t('searching') : t('searchCompany')}
                </button>

                {companyResults.length > 0 ? (
                  <div className="space-y-2">
                    {companyResults.map((company, index) => (
                      <button
                        key={`${getCompanySiret(company) || getCompanySiren(company) || index}`}
                        type="button"
                        onClick={() => selectCompany(company)}
                        className="block w-full rounded-[12px] border border-[#eadbd3] bg-white p-3 text-left active:scale-[0.99]"
                      >
                        <p className="text-[13px] font-extrabold">
                          {getCompanyName(company) || t('unknownCompany')}
                        </p>
                        <p className="mt-1 text-[12px] text-[#704f49]">
                          {getCompanyAddress(company)}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8b7770]">
                          SIREN/SIRET : {getCompanySiren(company) || getCompanySiret(company) || '-'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}

                {selectedCompany ? (
                  <div className="rounded-[12px] bg-[#f1ece8] p-3 text-[12px]">
                    <strong>{t('selectedCompany')}</strong>
                    <p className="mt-1">{getCompanyName(selectedCompany)}</p>
                    <p className="mt-1 text-[#704f49]">
                      {getCompanyAddress(selectedCompany)}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={nom}
                onChange={(event) => setNom(event.target.value)}
                placeholder={
                  clientType === 'entreprise'
                    ? t('companyName')
                    : t('lastNameOrCompany')
                }
                className="h-11 rounded-[12px] border border-[#eadbd3] bg-[#fbf8f6] px-3 text-[14px] outline-none"
              />

              {clientType === 'particulier' ? (
                <input
                  value={prenom}
                  onChange={(event) => setPrenom(event.target.value)}
                  placeholder={t('firstName')}
                  className="h-11 rounded-[12px] border border-[#eadbd3] bg-[#fbf8f6] px-3 text-[14px] outline-none"
                />
              ) : null}
            </div>

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('email')}
              className="h-11 w-full rounded-[12px] border border-[#eadbd3] bg-[#fbf8f6] px-3 text-[14px] outline-none"
            />

            <input
              value={telephone}
              onChange={(event) => setTelephone(event.target.value)}
              placeholder={t('phone')}
              className="h-11 w-full rounded-[12px] border border-[#eadbd3] bg-[#fbf8f6] px-3 text-[14px] outline-none"
            />

            <input
              value={adresse}
              onChange={(event) => setAdresse(event.target.value)}
              placeholder={t('address')}
              className="h-11 w-full rounded-[12px] border border-[#eadbd3] bg-[#fbf8f6] px-3 text-[14px] outline-none"
            />

            <button
              type="button"
              onClick={saveClient}
              disabled={saving || (!nom.trim() && !prenom.trim())}
              className="h-11 w-full rounded-[12px] bg-[#ff642d] text-[14px] font-extrabold text-white disabled:opacity-50"
            >
              {saving ? t('saving') : editingClient ? t('update') : t('save')}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-[14px] font-bold text-[#704f49]">
          {t('loading')}
        </p>
      ) : null}

      {!loading && clients.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : null}

      <div className="space-y-3">
        {clients.map((client) => (
          <article
            key={client.id ?? `${client.nom_client}-${client.prenom_client}`}
            className="rounded-[18px] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold">
                  {formatClientName(client)}
                </p>

                {client.mail_client ? (
                  <p className="mt-1 truncate text-[13px] text-[#704f49]">
                    {client.mail_client}
                  </p>
                ) : null}

                {client.numero_tel ? (
                  <p className="mt-1 truncate text-[13px] text-[#704f49]">
                    {client.numero_tel}
                  </p>
                ) : null}
              </div>

              <span className="rounded-full bg-[#f1ece8] px-3 py-1 text-[11px] font-extrabold text-[#704f49]">
                {client.company_id ? t('company') : t('individual')}
              </span>
            </div>

            {client.adresse ? (
              <p className="mt-3 text-[12px] leading-snug text-[#7b6862]">
                {client.adresse}
              </p>
            ) : null}

            {client.company_id ? (
              <div className="mt-3 rounded-[12px] bg-[#fbf8f6] p-3 text-[12px] text-[#704f49]">
                <p className="font-extrabold text-[#2b201e]">
                  {client.company_name || t('companyLinked')}
                </p>

                {client.company_siren ? <p>SIREN : {client.company_siren}</p> : null}
                {client.company_siret ? <p>SIRET : {client.company_siret}</p> : null}
                {client.company_forme_juridique ? <p>{client.company_forme_juridique}</p> : null}
                {client.company_adresse ? <p>{client.company_adresse}</p> : null}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => startEditClient(client)}
                className="h-10 flex-1 rounded-[10px] bg-[#f1ece8] text-[13px] font-extrabold text-[#704f49]"
              >
                {t('edit')}
              </button>

              <button
                type="button"
                onClick={() => deleteClient(client)}
                className="h-10 flex-1 rounded-[10px] bg-[#fff0ee] text-[13px] font-extrabold text-[#c63b28]"
              >
                {t('delete')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] bg-white p-6 text-center shadow-sm">
      <p className="text-[17px] font-extrabold">{title}</p>
      <p className="mt-2 text-[13px] text-[#704f49]">{description}</p>
    </div>
  );
}

function formatClientName(client: Client) {
  if (client.company_id && client.company_name) {
    return client.company_name;
  }

  const fullName = `${client.prenom_client ?? ''} ${client.nom_client ?? ''}`.trim();

  return fullName || client.mail_client || 'Client';
}

function getCompanyName(company: CompanyResult) {
  return (
    company.denomination ||
    company.nom_complet ||
    company['Dénomination'] ||
    company['Nom complet'] ||
    ''
  );
}

function getCompanyAddress(company: CompanyResult) {
  return company.adresse || company['Adresse postale'] || '';
}

function getCompanySiren(company: CompanyResult) {
  return normalizeCompanyIdentifier(company.siren || company['SIREN'] || '');
}

function getCompanySiret(company: CompanyResult) {
  return normalizeCompanyIdentifier(company.siret || company['SIRET du siège social'] || '');
}

function normalizeCompanyIdentifier(value: string) {
  return value.replace(/\s+/g, '').trim();
}