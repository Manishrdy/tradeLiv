import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import logger from '../config/logger';

export type AIProvider = 'claude' | 'gemini' | 'agent-router';

/* ─── Singleton clients (lazy-initialized) ────────── */

let _claude: Anthropic | null = null;
let _agentRouter: Anthropic | null = null;
let _gemini: GoogleGenerativeAI | null = null;

function getClaudeClient(): Anthropic {
  if (!_claude) _claude = new Anthropic({ apiKey: config.claudeApiKey });
  return _claude;
}

function getAgentRouterClient(): Anthropic {
  if (!_agentRouter) {
    _agentRouter = new Anthropic({
      apiKey: config.agentRouterApiKey,
      baseURL: 'https://agentrouter.org/',
    });
  }
  return _agentRouter;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!_gemini) _gemini = new GoogleGenerativeAI(config.geminiApiKey);
  return _gemini;
}

/* ─── Model mappings ─────────────────────────────── */

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const AGENT_ROUTER_MODEL = process.env.AGENT_ROUTER_MODEL || 'claude-sonnet-4-6';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getModelForProvider(provider: AIProvider): string {
  switch (provider) {
    case 'claude': return CLAUDE_MODEL;
    case 'agent-router': return AGENT_ROUTER_MODEL;
    case 'gemini': return GEMINI_MODEL;
  }
}

/* ─── Unified generate interface ─────────────────── */

export interface GenerateOptions {
  system: string;
  userMessage: string;
  maxTokens: number;
}

/**
 * Generate text using the configured AI provider.
 * Returns the raw text response.
 */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const provider = config.useAi;
  const model = getModelForProvider(provider);
  logger.info('AI request', { provider, model, maxTokens: opts.maxTokens });

  switch (provider) {
    case 'claude':
      return generateWithAnthropic(getClaudeClient(), model, opts);
    case 'agent-router':
      return generateWithAnthropic(getAgentRouterClient(), model, opts);
    case 'gemini':
      return generateWithGemini(model, opts);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Generate text with Anthropic-compatible tools (e.g. web_search).
 * Falls back to plain generateText for Gemini (no tool support).
 */
export async function generateWithTools(
  opts: GenerateOptions & { tools: any[] },
): Promise<string> {
  const provider = config.useAi;

  if (provider === 'gemini') {
    // Gemini doesn't support Anthropic-style tools — fall back to plain generation
    logger.info('Gemini: tools not supported, using plain generation');
    return generateWithGemini(getModelForProvider('gemini'), opts);
  }

  const client = provider === 'agent-router' ? getAgentRouterClient() : getClaudeClient();
  const model = getModelForProvider(provider);

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: 'user', content: opts.userMessage }],
    tools: opts.tools,
  } as any);

  return extractAnthropicText(response);
}

/* ─── Provider implementations ───────────────────── */

async function generateWithAnthropic(
  client: Anthropic,
  model: string,
  opts: GenerateOptions,
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: 'user', content: opts.userMessage }],
  });

  return extractAnthropicText(response);
}

function extractAnthropicText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function generateWithGemini(model: string, opts: GenerateOptions): Promise<string> {
  const client = getGeminiClient();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: opts.system,
  });

  const result = await genModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: opts.userMessage }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens },
  });

  return result.response.text();
}

/* ─── Expose for testing ─────────────────────────── */

export function _resetClients(): void {
  _claude = null;
  _agentRouter = null;
  _gemini = null;
}
