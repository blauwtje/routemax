import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_PATHS, SECTIONS, readSection } from './use-section';

function stubWindow(pathname: string) {
  const replaceState = vi.fn();
  vi.stubGlobal('window', { location: { pathname }, history: { replaceState } });
  return replaceState;
}

afterEach(() => vi.unstubAllGlobals());

describe('sections', () => {
  it('lists the four pages and maps the old paths', () => {
    expect(SECTIONS).toEqual(['overview', 'activity', 'routing', 'settings']);
    expect(LEGACY_PATHS).toEqual({ history: 'activity', providers: 'routing' });
  });

  it.each(SECTIONS)('reads /%s without rewriting the address', (section) => {
    const replaceState = stubWindow(`/${section}`);
    expect(readSection()).toBe(section);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it.each(Object.entries(LEGACY_PATHS))('redirects /%s to /%s with replaceState', (oldPath, target) => {
    const replaceState = stubWindow(`/${oldPath}/`);
    expect(readSection()).toBe(target);
    expect(replaceState).toHaveBeenCalledWith(null, '', `/${target}`);
  });

  it('falls back to overview for an unknown path', () => {
    const replaceState = stubWindow('/nope');
    expect(readSection()).toBe('overview');
    expect(replaceState).not.toHaveBeenCalled();
  });
});
