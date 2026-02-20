/**
 * Registry for AI providers.
 * Singleton Map pattern - one registry for the entire application.
 */
const providers = new Map();

/**
 * Register a provider under a given name.
 * @param {string} name - Unique identifier for the provider
 * @param {import('./base-provider.js').BaseProvider} provider - Provider instance
 */
export function registerProvider(name, provider) {
  providers.set(name, provider);
}

/**
 * Retrieve a registered provider by name.
 * @param {string} name - The provider name
 * @returns {import('./base-provider.js').BaseProvider | undefined}
 */
export function getProvider(name) {
  return providers.get(name);
}

/**
 * Get summary info for all registered providers.
 * Availability is not checked asynchronously here — call provider.isAvailable() separately.
 * @returns {{ name: string, info: Object, available: boolean }[]}
 */
export function getAvailableProviders() {
  const result = [];
  for (const [name, provider] of providers) {
    result.push({
      name,
      info: provider.getProviderInfo(),
      available: true,
    });
  }
  return result;
}

/**
 * Get the raw provider Map for advanced use cases.
 * @returns {Map<string, import('./base-provider.js').BaseProvider>}
 */
export function getAllProviders() {
  return providers;
}
