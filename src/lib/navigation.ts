/**
 * The PDF suite's screens. Every one of them shows the same page deck; only the action panel
 * beside it changes, because every tool operates on that one ordered list.
 */
export const TOOL_SCREENS = ['organize', 'convert', 'compress', 'protect'] as const;

export type Screen = (typeof TOOL_SCREENS)[number];

export const DEFAULT_SCREEN: Screen = 'organize';

/**
 * Map a URL path to a screen.
 *
 * @param path - `window.location.pathname`.
 * @returns The screen for that path, or the default.
 */
export function pathToScreen(path: string): Screen {
  const segment = path.replace(/^\/+/, '');
  return TOOL_SCREENS.find((screen) => screen === segment) ?? DEFAULT_SCREEN;
}

/**
 * The path a screen lives at; the default screen owns the root.
 *
 * @param screen - The screen to address.
 * @returns Its pathname.
 */
export function screenToPath(screen: Screen): string {
  return screen === DEFAULT_SCREEN ? '/' : `/${screen}`;
}
