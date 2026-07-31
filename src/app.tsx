import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { AppShell, color, font } from 'meoweo-shared';

import { PDF_NAV_SECTIONS } from './lib/pdf_nav';
import { pathToScreen } from './lib/navigation';
import { Workspace } from './screens/workspace';
import { useUiStore } from './store/ui.store';

/** The path of the third-party licences file shipped in `public/`. */
const NOTICES_PATH = '/THIRD-PARTY-NOTICES.txt';

function NoticesLink(): ReactElement {
  return (
    <a
      href={NOTICES_PATH}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block',
        padding: '12px 16px',
        color: color.textMuted,
        fontFamily: font,
        fontSize: 11,
        textDecoration: 'none',
      }}
    >
      Open-source licenses
    </a>
  );
}

/**
 * The PDF suite: one page deck, four tools, entirely in the browser.
 *
 * @returns The application.
 */
export function App(): ReactElement {
  const { screen, setScreen, sidebarOpen, setSidebarOpen } = useUiStore();

  useEffect(() => {
    function onPopState(): void {
      useUiStore.setState({ screen: pathToScreen(window.location.pathname) });
    }
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return (
    <AppShell
      sections={PDF_NAV_SECTIONS}
      activeScreen={screen}
      onNavigate={setScreen}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      footer={<NoticesLink />}
    >
      <Workspace screen={screen} />
    </AppShell>
  );
}
