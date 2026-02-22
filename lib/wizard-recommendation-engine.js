/**
 * Wizard Recommendation Engine
 * Generates mission DAG recommendations from natural language goals.
 * Three backends: rules (instant templates), cli (claude -p), api (Anthropic Messages API)
 */

import { spawn } from 'child_process';
import https from 'https';

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a mission architect for a multi-agent workflow system. Given a user's goal, recommend an optimal team of agents organized as a directed acyclic graph (DAG).

## Available Agent Types
- **Plan**: Strategic planning, requirement analysis, architecture design
- **Explore**: Codebase research, file discovery, pattern analysis (read-only)
- **general-purpose**: Full-capability agent for implementation, writing code, making changes
- **code-implementer**: Full implementation agent — takes plans/specs and writes production-ready code with built-in quality standards
- **code-reviewer**: Quality and maintainability review
- **security-reviewer**: Security audit and vulnerability detection
- **architect**: System design decisions and architectural analysis
- **refactor-cleaner**: Code improvement and technical debt reduction
- **e2e-runner**: End-to-end test design and validation
- **Bash**: Command execution specialist

## DAG Rules
- Each node runs one agent with a focused prompt
- Edges define execution order (parent must complete before child starts)
- Fan-out: one node can feed multiple children (parallel execution)
- Fan-in: multiple parents can feed into one child (waits for all)
- Prefer 3-7 agents for most tasks
- Start with a planner/researcher, end with a reviewer
- Each agent prompt should be specific and actionable

## Output Format
Respond with a brief explanation of your recommendation, then a JSON code block:

\`\`\`json
{
  "name": "Mission Name",
  "nodes": [
    { "id": "n1", "label": "Planner", "agentType": "Plan", "prompt": "Analyze requirements and create implementation plan for...", "config": {"timeout":300,"retries":1}, "provider": "claude-code", "model": "", "mcpServers": [] }
  ],
  "edges": [
    { "id": "e-n1-n2", "from": "n1", "to": "n2", "type": "sequential" }
  ],
  "context": { "workdir": "" }
}
\`\`\`

## Design Principles
- **ALWAYS include at least one code-implementer node** — every mission must have an agent that writes code. Read-only agents (Plan, Explore, code-reviewer, security-reviewer, architect) analyze but never produce files. Without a code-implementer, the mission produces 0 files.
- Give each agent a focused, single-responsibility prompt
- Use fan-out for independent tasks that can run in parallel
- Use fan-in when a reviewer needs outputs from multiple agents
- The code-implementer should receive outputs from planning/research agents and produce the actual implementation
- Include context placeholders like {context.workdir} in prompts when relevant
- Set reasonable timeouts (120s for simple, 300s for medium, 600s for complex tasks)`;

// ─── Rules Backend ───────────────────────────────────────────────────────────

const RULE_TEMPLATES = {
  'rest api': {
    name: 'REST API Pipeline',
    nodes: [
      { id: 'n1', label: 'Planner', agentType: 'Plan', prompt: 'Analyze requirements and design the REST API architecture including endpoints, data models, and middleware. Output a structured implementation plan.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n2', label: 'Architect', agentType: 'architect', prompt: 'Based on the plan, design the API structure: routes, controllers, models, and middleware. Define the file structure and key interfaces.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n3', label: 'Implementer', agentType: 'code-implementer', prompt: 'Implement the REST API based on the architecture design. Create all route handlers, models, middleware, and configuration files.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n4', label: 'Test Writer', agentType: 'code-implementer', prompt: 'Write comprehensive tests for all API endpoints including unit tests and integration tests. Cover success cases, error handling, and edge cases.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n5', label: 'Reviewer', agentType: 'code-reviewer', prompt: 'Review the complete API implementation for code quality, error handling, and best practices. Check for consistency and maintainability.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
    ],
    edges: [
      { id: 'e-n1-n2', from: 'n1', to: 'n2', type: 'sequential' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3', type: 'sequential' },
      { id: 'e-n3-n4', from: 'n3', to: 'n4', type: 'sequential' },
      { id: 'e-n3-n5', from: 'n3', to: 'n5', type: 'sequential' },
    ],
    context: { workdir: '' },
  },
  'react': {
    name: 'React App Pipeline',
    nodes: [
      { id: 'n1', label: 'Planner', agentType: 'Plan', prompt: 'Analyze requirements for the React application. Define components, state management approach, routing, and implementation plan.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n2', label: 'Component Builder', agentType: 'code-implementer', prompt: 'Implement the React components, hooks, and state management based on the plan. Create reusable, accessible components.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n3', label: 'Test Writer', agentType: 'code-implementer', prompt: 'Write tests for all React components and hooks. Include unit tests, integration tests, and snapshot tests.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n4', label: 'Reviewer', agentType: 'code-reviewer', prompt: 'Review the React implementation for component design, accessibility, performance patterns, and code quality.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
    ],
    edges: [
      { id: 'e-n1-n2', from: 'n1', to: 'n2', type: 'sequential' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3', type: 'sequential' },
      { id: 'e-n2-n4', from: 'n2', to: 'n4', type: 'sequential' },
    ],
    context: { workdir: '' },
  },
  'refactor': {
    name: 'Refactoring Pipeline',
    nodes: [
      { id: 'n1', label: 'Analyzer', agentType: 'Explore', prompt: 'Analyze the codebase to identify code smells, duplication, and improvement opportunities. Document current architecture and pain points.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n2', label: 'Refactorer', agentType: 'refactor-cleaner', prompt: 'Based on the analysis, refactor the code to improve structure, reduce duplication, and enhance maintainability while preserving behavior.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n3', label: 'Test Runner', agentType: 'e2e-runner', prompt: 'Verify all existing tests still pass after refactoring. Add any missing tests for refactored code paths.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n4', label: 'Reviewer', agentType: 'code-reviewer', prompt: 'Review the refactored code for quality, consistency, and that behavior is preserved. Verify no regressions were introduced.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
    ],
    edges: [
      { id: 'e-n1-n2', from: 'n1', to: 'n2', type: 'sequential' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3', type: 'sequential' },
      { id: 'e-n3-n4', from: 'n3', to: 'n4', type: 'sequential' },
    ],
    context: { workdir: '' },
  },
  'security': {
    name: 'Security Audit Pipeline',
    nodes: [
      { id: 'n1', label: 'Researcher', agentType: 'Explore', prompt: 'Map the codebase attack surface: authentication flows, API endpoints, data handling, third-party integrations, and configuration.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n2', label: 'Security Auditor', agentType: 'security-reviewer', prompt: 'Perform a thorough security review based on the research. Check for OWASP Top 10 vulnerabilities, injection risks, auth issues, and data exposure.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n3', label: 'Fixer', agentType: 'code-implementer', prompt: 'Fix all identified security vulnerabilities. Apply secure coding patterns, add input validation, and harden configuration.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n4', label: 'Verification', agentType: 'security-reviewer', prompt: 'Verify that all security fixes are correct and complete. Confirm no new vulnerabilities were introduced.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
    ],
    edges: [
      { id: 'e-n1-n2', from: 'n1', to: 'n2', type: 'sequential' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3', type: 'sequential' },
      { id: 'e-n3-n4', from: 'n3', to: 'n4', type: 'sequential' },
    ],
    context: { workdir: '' },
  },
  'fullstack': {
    name: 'Full-Stack Feature Pipeline',
    nodes: [
      { id: 'n1', label: 'Planner', agentType: 'Plan', prompt: 'Analyze requirements and create implementation plan covering frontend, backend, and data layer changes needed.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n2', label: 'Backend Dev', agentType: 'code-implementer', prompt: 'Implement the backend: API endpoints, database models, business logic, and middleware.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n3', label: 'Frontend Dev', agentType: 'code-implementer', prompt: 'Implement the frontend: UI components, state management, API integration, and routing.', config: { timeout: 600, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n4', label: 'Test Writer', agentType: 'code-implementer', prompt: 'Write comprehensive tests for both frontend and backend. Include unit, integration, and end-to-end tests.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
      { id: 'n5', label: 'Reviewer', agentType: 'code-reviewer', prompt: 'Review the complete full-stack implementation for quality, consistency between frontend and backend, and best practices.', config: { timeout: 300, retries: 1 }, provider: 'claude-code', model: '', mcpServers: [] },
    ],
    edges: [
      { id: 'e-n1-n2', from: 'n1', to: 'n2', type: 'sequential' },
      { id: 'e-n1-n3', from: 'n1', to: 'n3', type: 'sequential' },
      { id: 'e-n2-n4', from: 'n2', to: 'n4', type: 'sequential' },
      { id: 'e-n3-n4', from: 'n3', to: 'n4', type: 'sequential' },
      { id: 'e-n4-n5', from: 'n4', to: 'n5', type: 'sequential' },
    ],
    context: { workdir: '' },
  },
};

function matchRuleTemplate(message) {
  const lower = message.toLowerCase();
  for (const [keywords, template] of Object.entries(RULE_TEMPLATES)) {
    if (keywords.split(' ').every(kw => lower.includes(kw))) {
      return template;
    }
  }
  // Check partial matches
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('server')) return RULE_TEMPLATES['rest api'];
  if (lower.includes('react') || lower.includes('component') || lower.includes('frontend') || lower.includes('ui')) return RULE_TEMPLATES['react'];
  if (lower.includes('refactor') || lower.includes('cleanup') || lower.includes('improve')) return RULE_TEMPLATES['refactor'];
  if (lower.includes('security') || lower.includes('audit') || lower.includes('vulnerability')) return RULE_TEMPLATES['security'];
  if (lower.includes('full-stack') || lower.includes('fullstack') || lower.includes('full stack')) return RULE_TEMPLATES['fullstack'];
  return null;
}

function rulesBackend(message) {
  const template = matchRuleTemplate(message);
  if (template) {
    return {
      message: `Based on your request, I recommend the **${template.name}** with ${template.nodes.length} agents:\n\n${template.nodes.map((n, i) => `${i + 1}. **${n.label}** (${n.agentType}) — ${n.prompt.slice(0, 80)}…`).join('\n')}\n\nThis pipeline uses ${template.edges.some(e => template.edges.filter(e2 => e2.from === e.from).length > 1) ? 'parallel fan-out' : 'sequential'} execution.`,
      mission: JSON.parse(JSON.stringify(template)),
      suggestions: ['Customize agent prompts for your specific project', 'Add a documentation agent', 'Adjust timeouts for complexity'],
    };
  }
  return {
    message: "I couldn't match your request to a template. Try describing your goal with keywords like: REST API, React, refactor, security audit, or full-stack. Or switch to the CLI or API backend for AI-powered recommendations.",
    mission: null,
    suggestions: ['Try "Build a REST API with tests"', 'Try "Refactor and clean up codebase"', 'Switch to CLI backend for AI-powered recommendations'],
  };
}

// ─── CLI Backend ─────────────────────────────────────────────────────────────

function cliBackend(message, history) {
  return new Promise((resolve, reject) => {
    const messages = [
      ...(history || []),
      { role: 'user', content: message },
    ];

    // Build the conversation as a single prompt
    const conversationText = messages.map(m =>
      m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`
    ).join('\n\n');

    const args = [
      '-p', conversationText,
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
      '--max-turns', '1',
      '--system-prompt', SYSTEM_PROMPT,
      '--tools', '',
    ];

    let fullOutput = '';
    let lastText = '';
    let timedOut = false;

    const spawnEnv = { ...process.env };
    delete spawnEnv.CLAUDECODE;

    const child = spawn('claude', args, {
      env: spawnEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 120000);

    child.stdin.end();

    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                lastText = block.text;
              }
            }
          }
          if (event.type === 'result') {
            fullOutput = event.result || lastText;
          }
        } catch { /* partial JSON line, skip */ }
      }
    });

    let stderrOutput = '';
    child.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (stderrOutput) {
        console.error('[wizard] CLI stderr:', stderrOutput.slice(0, 500));
      }

      if (timedOut) {
        resolve({
          message: 'Request timed out after 120 seconds. Try simplifying your request or switch to the Rules backend for instant responses.',
          mission: null,
          suggestions: ['Simplify your request', 'Switch to Rules backend'],
        });
        return;
      }

      if (code !== 0 && !fullOutput && !lastText) {
        const errMsg = stderrOutput.slice(0, 200) || `CLI exited with code ${code}`;
        resolve({
          message: `CLI error: ${errMsg}`,
          mission: null,
          suggestions: ['Switch to Rules backend', 'Check Claude CLI installation'],
        });
        return;
      }

      const output = fullOutput || lastText;
      if (!output) {
        resolve({
          message: 'No recommendation generated. The CLI returned an empty response.',
          mission: null,
          suggestions: ['Try again with a more specific request'],
        });
        return;
      }

      resolve(parseAIResponse(output));
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'ENOENT') {
        resolve({
          message: 'Claude CLI not available. Install it or switch to the Rules backend for template-based recommendations.',
          mission: null,
          suggestions: ['Switch to Rules backend', 'Install Claude CLI'],
        });
      } else {
        resolve({
          message: `CLI error: ${err.message}`,
          mission: null,
          suggestions: ['Try again', 'Switch to Rules backend'],
        });
      }
    });
  });
}

// ─── API Backend ─────────────────────────────────────────────────────────────

function apiBackend(message, history) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      resolve({
        message: 'ANTHROPIC_API_KEY environment variable not set. Set it in your shell or switch to the CLI or Rules backend.',
        mission: null,
        suggestions: ['Set ANTHROPIC_API_KEY', 'Switch to CLI backend', 'Switch to Rules backend'],
      });
      return;
    }

    const messages = [
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            resolve({
              message: `API error: ${json.error.message || JSON.stringify(json.error)}`,
              mission: null,
              suggestions: ['Check your API key', 'Try again'],
            });
            return;
          }
          const text = json.content?.map(b => b.text).join('') || '';
          resolve(parseAIResponse(text));
        } catch (err) {
          resolve({
            message: `Failed to parse API response: ${err.message}`,
            mission: null,
            suggestions: ['Try again'],
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        message: `API request failed: ${err.message}`,
        mission: null,
        suggestions: ['Check your network', 'Try CLI backend'],
      });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({
        message: 'API request timed out after 60 seconds.',
        mission: null,
        suggestions: ['Try again', 'Simplify your request'],
      });
    });

    req.write(body);
    req.end();
  });
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

function parseAIResponse(text) {
  const mission = extractJSON(text);
  const message = extractMessage(text);
  return {
    message: message || (mission ? 'Here is my recommendation:' : text),
    mission,
    suggestions: mission
      ? ['Add a security reviewer', 'Add documentation agent', 'Adjust timeouts']
      : ['Try rephrasing your request'],
  };
}

function extractJSON(text) {
  // Try ```json ... ``` code fence first
  const fenceMatch = text.match(/```json\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed.nodes && parsed.edges) return normalizemission(parsed);
    } catch { /* fall through */ }
  }

  // Try any ``` ... ``` code fence
  const anyFence = text.match(/```\s*\n?([\s\S]*?)```/);
  if (anyFence) {
    try {
      const parsed = JSON.parse(anyFence[1].trim());
      if (parsed.nodes && parsed.edges) return normalizemission(parsed);
    } catch { /* fall through */ }
  }

  // Try raw JSON object
  const braceMatch = text.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);
  if (braceMatch) {
    try {
      const parsed = JSON.parse(braceMatch[0]);
      if (parsed.nodes && parsed.edges) return normalizemission(parsed);
    } catch { /* fall through */ }
  }

  return null;
}

/** Agent types that can write files (implementation agents). */
const IMPLEMENTATION_AGENTS = new Set([
  'code-implementer', 'general-purpose', 'refactor-cleaner', 'e2e-runner',
]);

function normalizemission(m) {
  const nodes = (m.nodes || []).map(n => ({
    id: n.id,
    label: n.label || n.id,
    agentType: n.agentType || 'general-purpose',
    prompt: n.prompt || '',
    config: { timeout: 300, retries: 1, ...n.config },
    provider: n.provider || 'claude-code',
    model: n.model || '',
    mcpServers: n.mcpServers || [],
  }));

  const edges = (m.edges || []).map(e => ({
    id: e.id || `e-${e.from}-${e.to}`,
    from: e.from,
    to: e.to,
    type: e.type || 'sequential',
  }));

  // Safety net: ensure at least one implementation agent exists.
  // Without one, the mission produces analysis but 0 files.
  const hasImplementer = nodes.some(n => IMPLEMENTATION_AGENTS.has(n.agentType));
  if (!hasImplementer && nodes.length > 0) {
    // Find the last non-reviewer node to insert the implementer after
    const reviewerTypes = new Set(['code-reviewer', 'security-reviewer']);
    const lastNonReviewer = [...nodes].reverse().find(n => !reviewerTypes.has(n.agentType));
    const insertAfterId = lastNonReviewer?.id || nodes[nodes.length - 1].id;

    const implId = `n${nodes.length + 1}`;
    nodes.push({
      id: implId,
      label: 'Implementer',
      agentType: 'code-implementer',
      prompt: 'Based on the analysis and plans from previous agents, implement all recommended changes. Write production-ready code with proper error handling.',
      config: { timeout: 600, retries: 1 },
      provider: 'claude-code',
      model: '',
      mcpServers: [],
    });

    // Wire: insertAfter → implementer
    edges.push({ id: `e-${insertAfterId}-${implId}`, from: insertAfterId, to: implId, type: 'sequential' });

    // Re-wire any reviewers that depended on insertAfter to depend on implementer instead
    for (const edge of edges) {
      if (edge.from === insertAfterId && edge.to !== implId) {
        const targetNode = nodes.find(n => n.id === edge.to);
        if (targetNode && reviewerTypes.has(targetNode.agentType)) {
          edge.from = implId;
          edge.id = `e-${implId}-${edge.to}`;
        }
      }
    }
  }

  return {
    name: m.name || 'Untitled Mission',
    nodes,
    edges,
    context: m.context || { workdir: '' },
  };
}

function extractMessage(text) {
  // Get text before the first code fence
  const fenceIndex = text.indexOf('```');
  if (fenceIndex > 0) {
    return text.slice(0, fenceIndex).trim();
  }
  // If no code fence, check if the text starts with a JSON block
  if (text.trim().startsWith('{')) return null;
  return text;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a mission recommendation for a user goal
 * @param {string} message - User's natural language goal
 * @param {Array} history - Previous conversation turns [{role, content}]
 * @param {string} backend - 'rules', 'cli', or 'api'
 * @returns {Promise<{message: string, mission: object|null, suggestions: string[]}>}
 */
export async function getRecommendation(message, history = [], backend = 'cli') {
  switch (backend) {
    case 'rules':
      return rulesBackend(message);
    case 'api':
      return apiBackend(message, history);
    case 'cli':
    default:
      return cliBackend(message, history);
  }
}
