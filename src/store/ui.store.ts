import { create } from 'zustand';

import { pathToScreen, screenToPath } from '../lib/navigation';
import type { Screen } from '../lib/navigation';

type UiState = {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

/** Below this width the sidebar starts collapsed. */
const MOBILE_BREAKPOINT_PX = 768;

export const useUiStore = create<UiState>((set) => ({
  screen: pathToScreen(window.location.pathname),
  setScreen: (screen) => {
    history.pushState(null, '', screenToPath(screen));
    set({ screen });
  },
  sidebarOpen: window.innerWidth >= MOBILE_BREAKPOINT_PX,
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },
}));
