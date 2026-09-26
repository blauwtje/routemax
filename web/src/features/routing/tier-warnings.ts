import type { ProviderTestsResponse } from '../../lib/api-types';

export function tierWarnings(tiers: Record<string, { provider: string }>, tests: ProviderTestsResponse): string[] {
  return Object.entries(tiers).flatMap(([tierName, tier]) => {
    const result = Object.hasOwn(tests, tier.provider) ? tests[tier.provider] : undefined;
    if (result === undefined) return [`${tierName} uses ${tier.provider}, which has never been tested. Run a test on the Providers page.`];
    if (!result.passed) return [`${tierName} uses ${tier.provider}, whose last test failed: ${result.detail}`];
    return [];
  });
}
