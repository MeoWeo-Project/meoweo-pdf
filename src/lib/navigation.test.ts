import { describe, expect, it } from 'vitest';

import { DEFAULT_SCREEN, TOOL_SCREENS, pathToScreen, screenToPath } from './navigation';

describe('pathToScreen', () => {
  it('maps the root path to the default screen', () => {
    expect(pathToScreen('/')).toBe(DEFAULT_SCREEN);
    expect(pathToScreen('')).toBe(DEFAULT_SCREEN);
    expect(pathToScreen('///')).toBe(DEFAULT_SCREEN);
  });

  it('maps an unknown segment to the default screen', () => {
    expect(pathToScreen('/nope')).toBe(DEFAULT_SCREEN);
  });

  it('maps each tool path to its screen', () => {
    for (const screen of TOOL_SCREENS) {
      expect(pathToScreen(`/${screen}`)).toBe(screen);
    }
  });

  it('treats extra segments as unknown', () => {
    expect(pathToScreen('/convert/extra')).toBe(DEFAULT_SCREEN);
  });
});

describe('screenToPath', () => {
  it('gives the default screen the root', () => {
    expect(screenToPath(DEFAULT_SCREEN)).toBe('/');
  });

  it('gives other screens their own path', () => {
    expect(screenToPath('convert')).toBe('/convert');
    expect(screenToPath('protect')).toBe('/protect');
  });

  it('round-trips every screen', () => {
    for (const screen of TOOL_SCREENS) {
      expect(pathToScreen(screenToPath(screen))).toBe(screen);
    }
  });
});
