import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

/**
 * Claude wrapper for the makedemo pipeline brain.
 *
 * Mirrors the proven qaaas flow: one structured call validated against a zod
 * schema (here via the SDK's native structured-outputs + messages.parse), plus
 * a plain free-text completion. Uses claude-opus-4-8 with adaptive thinking,
 * and streams the longer free-text call to avoid request timeouts.
 *
 * Returns null when ANTHROPIC_API_KEY is unset so callers can fall back to
 * heuristics — the same "smart path / fallback" shape the rest of makedemo uses
 * for OpenAI and ElevenLabs.
 */

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

let cached;
function getClient() {
  if (cached !== undefined) return cached;
  cached = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  return cached;
}

export function isLlmEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * One structured Claude call. `schema` is a zod schema; the parsed, validated
 * object is returned (or null on no-key / parse failure).
 */
export async function parseStructured({ system, prompt, schema, maxTokens = 8000 }) {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    // parsed_output is null when the model refused or output didn't validate.
    return response.parsed_output ?? null;
  } catch (err) {
    console.error('llm.parseStructured failed:', err?.message || err);
    return null;
  }
}

/**
 * Plain free-text Claude completion. Streamed because scripts/prompts can run
 * long; we collect the final message rather than handling deltas.
 */
export async function completeText({ system, prompt, maxTokens = 4000 }) {
  const client = getClient();
  if (!client) return null;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return text || null;
  } catch (err) {
    console.error('llm.completeText failed:', err?.message || err);
    return null;
  }
}
