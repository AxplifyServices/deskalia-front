'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import ChatbotScreen from '@/components/chatbot/ChatbotScreen';
import ClientsPage from '@/components/pages/ClientsPage';
import DevisPage from '@/components/pages/DevisPage';
import ComingSoonPage from '@/components/pages/ComingSoonPage';
import { authHeaders, type UserProfile } from '@/lib/auth-client';

export type DeskaliaView =
  | 'chat'
  | 'clients'
  | 'devis'
  | 'clientInvoices'
  | 'supplierInvoices'
  | 'planning'
  | 'settings'
  | 'profile';

type Conversation = {
  conversation_id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type DeskaliaShellProps = {
  profile: UserProfile | null;
  onLogout?: () => void;
};

export default function DeskaliaShell({ profile, onLogout }: DeskaliaShellProps) {
  const t = useTranslations('Shell');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<DeskaliaView>('chat');
  const [chatKey, setChatKey] = useState(() => crypto.randomUUID());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  async function loadConversations() {
    try {
      const response = await fetch('/api/conversations', {
        method: 'GET',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        console.warn('[SHELL] Conversations indisponibles', data);
        return;
      }

      setConversations(data.conversations ?? []);
    } catch (error) {
      console.error('[SHELL] Erreur chargement conversations', error);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function openView(view: DeskaliaView) {
    setActiveView(view);
    closeSidebar();
  }

  function startNewConversation() {
    setActiveView('chat');
    setActiveConversationId(null);
    setChatKey(crypto.randomUUID());
    closeSidebar();
  }

  function openConversation(conversationId: string) {
    setActiveView('chat');
    setActiveConversationId(conversationId);
    setChatKey(conversationId);
    closeSidebar();
  }

  async function deleteConversation(conversationId: string) {
    const confirmed = window.confirm(t('deleteConversationConfirm'));

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}`,
        {
          method: 'DELETE',
          headers: {
            ...authHeaders(),
          },
          cache: 'no-store',
        },
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('deleteConversationError'));
      }

      setConversations((current) =>
        current.filter((item) => item.conversation_id !== conversationId),
      );

      if (activeConversationId === conversationId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('[SHELL] Suppression conversation impossible', error);
      alert(error instanceof Error ? error.message : t('deleteConversationError'));
    }
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#f5f1ee] text-[#2b201e]">
      <div className="mx-auto flex h-dvh w-full max-w-[1180px] overflow-hidden">
        <aside className="hidden w-[310px] shrink-0 border-r border-[#e5d5cd] bg-[#f8f4f1] lg:block">
          <SidebarContent
            t={t}
            profile={profile}
            activeView={activeView}
            conversations={conversations}
            onNewConversation={startNewConversation}
            onOpenConversation={openConversation}
            onDeleteConversation={deleteConversation}
            onOpenView={openView}
            onLogout={onLogout}
          />
        </aside>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label={t('closeSidebar')}
              className="absolute inset-0 bg-black/55"
              onClick={closeSidebar}
            />

            <aside className="absolute left-0 top-0 h-full w-[82vw] max-w-[330px] bg-[#f8f4f1] shadow-2xl">
              <SidebarContent
                t={t}
                profile={profile}
                activeView={activeView}
                conversations={conversations}
                onNewConversation={startNewConversation}
                onOpenConversation={openConversation}
                onDeleteConversation={deleteConversation}
                onOpenView={openView}
                onLogout={onLogout}
              />
            </aside>
          </div>
        ) : null}

        <section className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
          <MobileTopbar
            title={getViewTitle(t, activeView)}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          {activeView === 'chat' ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatbotScreen
                key={chatKey}
                onLogout={onLogout}
                onOpenSidebar={() => setSidebarOpen(true)}
                conversationId={activeConversationId}
              />
            </div>
          ) : null}

          {activeView === 'clients' ? <ClientsPage /> : null}
          {activeView === 'devis' ? <DevisPage /> : null}

          {activeView === 'clientInvoices' ? (
            <ComingSoonPage title={t('clientInvoices')} />
          ) : null}

          {activeView === 'supplierInvoices' ? (
            <ComingSoonPage title={t('supplierInvoices')} />
          ) : null}

          {activeView === 'planning' ? <ComingSoonPage title={t('planning')} /> : null}
          {activeView === 'settings' ? <ComingSoonPage title={t('settings')} /> : null}
          {activeView === 'profile' ? <ComingSoonPage title={t('profile')} /> : null}
        </section>
      </div>
    </main>
  );
}

function MobileTopbar({
  title,
  onOpenSidebar,
}: {
  title: string;
  onOpenSidebar: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#eadbd3] bg-[#f5f1ee]/95 px-4 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#704f49] shadow-sm active:scale-95"
        aria-label="Menu"
      >
        <MenuIcon />
      </button>

      <p className="text-[15px] font-extrabold">{title}</p>

      <div className="h-10 w-10" />
    </header>
  );
}

function SidebarContent({
  t,
  profile,
  activeView,
  conversations,
  onNewConversation,
  onOpenConversation,
  onDeleteConversation,
  onOpenView,
  onLogout,
}: {
  t: (key: string) => string;
  profile: UserProfile | null;
  activeView: DeskaliaView;
  conversations: Conversation[];
  onNewConversation: () => void;
  onOpenConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onOpenView: (view: DeskaliaView) => void;
  onLogout?: () => void;
}) {
  const todayConversations = useMemo(
    () => conversations.filter((item) => isToday(item.updated_at || item.created_at)),
    [conversations],
  );

  const lastConversations = useMemo(
    () => conversations.filter((item) => !isToday(item.updated_at || item.created_at)),
    [conversations],
  );

  return (
    <div className="flex h-full min-h-dvh flex-col px-4 pb-5 pt-5">
      <nav className="space-y-1">
        <SidebarButton
          label={t('newConversation')}
          icon={<PlusMessageIcon />}
          active={activeView === 'chat'}
          onClick={onNewConversation}
        />

        <SidebarButton
          label={t('clients')}
          icon={<UsersIcon />}
          active={activeView === 'clients'}
          onClick={() => onOpenView('clients')}
        />

        <SidebarButton
          label={t('devis')}
          icon={<DocumentIcon />}
          active={activeView === 'devis'}
          onClick={() => onOpenView('devis')}
        />

        <SidebarButton
          label={t('clientInvoices')}
          icon={<InvoiceIcon />}
          active={activeView === 'clientInvoices'}
          onClick={() => onOpenView('clientInvoices')}
        />

        <SidebarButton
          label={t('supplierInvoices')}
          icon={<BlocksIcon />}
          active={activeView === 'supplierInvoices'}
          onClick={() => onOpenView('supplierInvoices')}
        />

        <SidebarButton
          label={t('planning')}
          icon={<CalendarIcon />}
          active={activeView === 'planning'}
          onClick={() => onOpenView('planning')}
        />
      </nav>

      <div className="my-5 h-px bg-[#dfcec5]" />

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {todayConversations.length > 0 ? (
          <ConversationGroup
            title={t('today')}
            conversations={todayConversations}
            onOpenConversation={onOpenConversation}
            onDeleteConversation={onDeleteConversation}
          />
        ) : null}

        {lastConversations.length > 0 ? (
          <ConversationGroup
            title={t('lastDays')}
            conversations={lastConversations}
            onOpenConversation={onOpenConversation}
            onDeleteConversation={onDeleteConversation}
          />
        ) : null}
      </div>

      <div className="border-t border-[#dfcec5] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenView('profile')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#f1ece8] text-[20px] font-bold text-[#704f49]"
            aria-label={t('profile')}
          >
            {getInitial(profile)}
          </button>

          <button
            type="button"
            onClick={() => onOpenView('profile')}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-[15px] font-extrabold">
              {getDisplayName(profile)}
            </p>
            <p className="truncate text-[13px] font-bold text-[#704f49]">
              Deskalia beta
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenView('settings')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#704f49] active:scale-95"
            aria-label={t('settings')}
          >
            <SettingsIcon />
          </button>
        </div>

        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 h-10 w-full rounded-[10px] bg-[#fff0ee] text-[13px] font-extrabold text-[#c63b28]"
          >
            {t('logout')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SidebarButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-full items-center gap-4 rounded-[14px] px-3 text-left text-[17px] font-semibold transition active:scale-[0.98] ${
        active ? 'bg-[#f1ece8]' : 'hover:bg-[#f1ece8]/70'
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[#704f49]">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function ConversationGroup({
  title,
  conversations,
  onOpenConversation,
  onDeleteConversation,
}: {
  title: string;
  conversations: Conversation[];
  onOpenConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-3 text-[12px] font-extrabold text-[#704f49]">
        {title}
      </p>

      <div className="space-y-1">
        {conversations.map((conversation) => (
          <div
            key={conversation.conversation_id}
            className="group flex items-center gap-1 rounded-[12px] hover:bg-[#f1ece8]"
          >
            <button
              type="button"
              onClick={() => onOpenConversation(conversation.conversation_id)}
              className="min-w-0 flex-1 px-3 py-3 text-left text-[15px] font-medium leading-snug active:scale-[0.98]"
            >
              <span className="line-clamp-2">
                {conversation.title || 'Conversation'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onDeleteConversation(conversation.conversation_id)}
              className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px] font-black text-[#c63b28] hover:bg-white"
              aria-label="Supprimer la conversation"
              title="Supprimer la conversation"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function getViewTitle(t: (key: string) => string, view: DeskaliaView) {
  const titles: Record<DeskaliaView, string> = {
    chat: t('chat'),
    clients: t('clients'),
    devis: t('devis'),
    clientInvoices: t('clientInvoices'),
    supplierInvoices: t('supplierInvoices'),
    planning: t('planning'),
    settings: t('settings'),
    profile: t('profile'),
  };

  return titles[view];
}

function getDisplayName(profile: UserProfile | null) {
  const firstName = profile?.prenom ?? '';
  const lastName = profile?.nom ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || profile?.mail_user || 'Utilisateur';
}

function getInitial(profile: UserProfile | null) {
  return getDisplayName(profile).slice(0, 1).toUpperCase();
}

function isToday(value?: string | null) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusMessageIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5h14v10H9l-4 4V5Z" fill="currentColor" opacity=".9" />
      <path d="M12 8v5M9.5 10.5h5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c.5-3.3 2.3-5 5-5s4.5 1.7 5 5H3ZM11 19c.4-2.8 2-4.5 5-4.5s4.6 1.7 5 4.5H11Z" fill="currentColor" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3Z" fill="currentColor" />
      <path d="M14 3v5h5" fill="#f8f4f1" opacity=".85" />
      <path d="M9 12h6M9 15h6M9 18h4" stroke="#f8f4f1" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h8l3 3v15H7V3Z" fill="currentColor" />
      <path d="M12 8v8M9.5 10.5H14a1.5 1.5 0 0 1 0 3h-4" stroke="#f8f4f1" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BlocksIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h6v6H4V5ZM14 5h6v6h-6V5ZM4 14h6v6H4v-6ZM14 14h6v6h-6v-6Z" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5h14v15H5V5Z" fill="currentColor" />
      <path d="M8 3v4M16 3v4M5 10h14" stroke="#f8f4f1" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" fill="currentColor" />
      <path d="M12 2.5 14 5l3.2-.3 1.4 2.4-1.8 2.6L18 12l-1.2 2.3 1.8 2.6-1.4 2.4L14 19l-2 2.5L10 19l-3.2.3-1.4-2.4 1.8-2.6L6 12l1.2-2.3-1.8-2.6 1.4-2.4L10 5l2-2.5Z" fill="currentColor" opacity=".55" />
    </svg>
  );
}