/**
 * Wizard API Handler
 * REST endpoint for mission wizard recommendations
 */

import { sendJson } from './router.js';
import { getRecommendation } from './wizard-recommendation-engine.js';
import { getSettings } from './config-reader.js';

async function handleWizardRecommendation(req, res) {
  try {
    const { message, history, backend } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      sendJson(res, 400, { error: 'Message is required' });
      return;
    }

    // Determine backend: request override > settings > default 'cli'
    let resolvedBackend = backend;
    if (!resolvedBackend) {
      const settings = await getSettings();
      resolvedBackend = settings?.env?.WIZARD_BACKEND || 'cli';
    }

    const validBackends = ['cli', 'api', 'rules'];
    if (!validBackends.includes(resolvedBackend)) {
      sendJson(res, 400, { error: `Invalid backend: ${resolvedBackend}. Must be one of: ${validBackends.join(', ')}` });
      return;
    }

    const result = await getRecommendation(message.trim(), history || [], resolvedBackend);
    sendJson(res, 200, result);
  } catch (error) {
    console.error('[wizard] Error:', error);
    sendJson(res, 500, { error: 'Wizard recommendation failed' });
  }
}

export function registerWizardRoutes(router) {
  router.post('/api/missions/wizard', handleWizardRecommendation);
}
