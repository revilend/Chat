import { useState, useCallback, useEffect } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { AccountProvider } from './auth/AccountContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { SettingsModal } from './components/modals/SettingsModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { ContactsModal } from './components/modals/ContactsModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { CreateChannelModal } from './components/modals/CreateChannelModal';
import { PollModal } from './components/modals/PollModal';
import { QRCodeModal } from './components/modals/QRCodeModal';
import { GiftModal } from './components/modals/GiftModal';
import { CallModal } from './components/calls/CallModal';
import { PinLockScreen } from './components/shared/PinLockScreen';
import { MiniAppSnake } from './components/miniapps/SnakeGame';
import { MiniApp2048 } from './components/miniapps/Game2048';
import { WelcomeScreen } from './components/shared/WelcomeScreen';
import { StoriesStrip } from './components/stories/StoriesStrip';
import { ReminderModal, ReminderAlert, JoinRequestModal, WalletModal, LeaderboardModal, SplitBillModal, StickerCreatorModal } from './components/modals/FeatureModals';
import { BookmarksDrawer, MediaConfirmModal } from './components/features/AdvancedFeatures';
import { PhotoEditor } from './components/media/PhotoEditor';
import { MusicPlayer } from './components/chat/MediaViews';

/** Matches Tailwind's `md` breakpoint so the JS layout and the CSS classes agree. */
const DESKTOP_QUERY = '(min-width: 768px)';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    // No matchMedia (server render, old embedded browser): assume a wide screen.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

export function AppInner() {
  const { state } = useApp();
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const isDesktop = useIsDesktop();

  // On a phone only one pane fits: the chat list, or the open chat.
  const showList = isDesktop || !state.activeChatId;
  const showChat = isDesktop || Boolean(state.activeChatId);
  const listWidth = isDesktop ? (state.activeChatId ? Math.min(sidebarWidth, 420) : sidebarWidth) : '100%';

  const handleResize = useCallback((e: MouseEvent) => { if (e.clientX > 200 && e.clientX < 600) setSidebarWidth(e.clientX); }, []);
  const handleMouseDown = useCallback(() => { document.addEventListener('mousemove', handleResize); document.addEventListener('mouseup', () => document.removeEventListener('mousemove', handleResize), { once: true }); }, [handleResize]);

  // Nobody is signed in yet — that is a real login, not a demo workspace.
  if (!state.session) return <AuthScreen />;
  if (state.isLocked) return <PinLockScreen />;

  return (
    <div className="h-full w-full flex bg-tg-bg overflow-hidden">
      <div data-testid="list-pane" className={`h-full flex-shrink-0 border-r border-black/20 relative ${showList ? 'flex' : 'hidden'} flex-col ${isDesktop ? '' : 'w-full'}`} style={{ width: listWidth }}>
        <StoriesStrip /><Sidebar />
        {isDesktop && state.activeChatId && <div className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-tg-accent/30 z-10" onMouseDown={handleMouseDown} />}
      </div>
      <div data-testid="chat-pane" className={`flex-1 h-full ${showChat ? 'flex' : 'hidden'} flex-col min-w-0`}>
        {/* Sticky music player keeps playing while browsing other chats */}
        <MusicPlayer />
        <div className="flex-1 min-h-0">{state.activeChatId ? <ChatArea /> : <WelcomeScreen />}</div>
      </div>
      {/* Modals */}
      {state.isSettingsOpen && <SettingsModal />}
      {state.isProfileOpen && <ProfileModal />}
      {state.isContactsOpen && <ContactsModal />}
      {state.isCreateGroupOpen && <CreateGroupModal />}
      {state.isCreateChannelOpen && <CreateChannelModal />}
      {state.isPollModalOpen && <PollModal />}
      {state.isQRCodeOpen && <QRCodeModal />}
      {state.isGiftModalOpen && <GiftModal />}
      {(state.isCallActive || state.incomingCall) && <CallModal />}
      {state.miniApp === 'snake' && <MiniAppSnake />}
      {state.miniApp === '2048' && <MiniApp2048 />}
      <ReminderModal />
      <ReminderAlert />
      <JoinRequestModal />
      <WalletModal />
      <LeaderboardModal />
      <SplitBillModal />
      <StickerCreatorModal />
      <BookmarksDrawer />
      <MediaConfirmModal />
      <PhotoEditor />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AccountProvider>
        <AppInner />
      </AccountProvider>
    </AppProvider>
  );
}
