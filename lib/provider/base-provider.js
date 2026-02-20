/**
 * Abstract base class for AI providers.
 * All providers must extend this class and implement its methods.
 */
export class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Execute a mission node.
   * @param {Object} node - The mission node to execute
   * @param {Object} context - Execution context (variables, etc.)
   * @param {string} runId - Unique identifier for this run
   * @returns {Promise<{ output: string, agentId: string }>}
   */
  async executeNode(node, context, runId) {
    throw new Error(`${this.constructor.name} must implement executeNode()`);
  }

  /**
   * Abort a running node.
   * @param {string} nodeId - The node to abort
   * @param {string} runId - The run containing the node
   * @returns {Promise<void>}
   */
  async abortNode(nodeId, runId) {
    throw new Error(`${this.constructor.name} must implement abortNode()`);
  }

  /**
   * Check if this provider is available for use.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error(`${this.constructor.name} must implement isAvailable()`);
  }

  /**
   * Get the agent types supported by this provider.
   * @returns {string[]}
   */
  getSupportedAgentTypes() {
    throw new Error(`${this.constructor.name} must implement getSupportedAgentTypes()`);
  }

  /**
   * Get display info for this provider.
   * @returns {{ name: string, displayName: string, faction: string, icon: string }}
   */
  getProviderInfo() {
    throw new Error(`${this.constructor.name} must implement getProviderInfo()`);
  }
}
