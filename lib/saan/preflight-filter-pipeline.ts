/**
 * @file preflight-filter-pipeline.ts
 * @description Clean-room TypeScript adaptation of Open-WebUI's preflight filter
 * pipeline, sensitive credential scrubbing, and code execution sanitizer.
 * Inspired by open-webui/open-webui (33c1978).
 */

const ANSI_ESCAPE_REGEX =
  /\x1b\[[0-9;]*[A-Za-z]|\x1b\([AB]|\x1b[PX^_].*?\x1b\\|\x1b\].*?(?:\x07|\x1b\\)/g;

export interface RedactionResult {
  cleanedText: string;
  redactedCount: number;
  detectedTypes: string[];
}

export interface ModelGenerationConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPromptOverride?: string;
  enableCredentialScrubber: boolean;
  enablePiiScrubber: boolean;
  enableCodeSanitizer: boolean;
}

export class PreflightFilterPipeline {
  private config: ModelGenerationConfig = {
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 4096,
    systemPromptOverride: '',
    enableCredentialScrubber: true,
    enablePiiScrubber: true,
    enableCodeSanitizer: true,
  };

  public getConfig(): ModelGenerationConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<ModelGenerationConfig>): ModelGenerationConfig {
    this.config = { ...this.config, ...patch };
    return { ...this.config };
  }

  /**
   * Scrubs personally identifiable information (PII) such as email addresses and phone numbers.
   */
  public scrubPii(text: string): RedactionResult {
    if (!text || typeof text !== 'string') {
      return { cleanedText: '', redactedCount: 0, detectedTypes: [] };
    }

    let cleaned = text;
    let count = 0;
    const types: Set<string> = new Set();

    // Email regex
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    if (emailRegex.test(cleaned)) {
      cleaned = cleaned.replace(emailRegex, () => {
        count++;
        types.add('email');
        return '[REDACTED_EMAIL]';
      });
    }

    // Phone regex (e.g. +1-555-123-4567, (555) 123-4567, 555-123-4567)
    const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    if (phoneRegex.test(cleaned)) {
      cleaned = cleaned.replace(phoneRegex, () => {
        count++;
        types.add('phone_number');
        return '[REDACTED_PHONE]';
      });
    }

    return {
      cleanedText: cleaned,
      redactedCount: count,
      detectedTypes: Array.from(types),
    };
  }

  /**
   * Scrubs sensitive secrets, API keys, JWTs, and private keys from prompts
   * before sending to external model APIs.
   */
  public scrubCredentials(promptText: string): RedactionResult {
    if (!promptText || typeof promptText !== 'string') {
      return { cleanedText: '', redactedCount: 0, detectedTypes: [] };
    }

    let cleaned = promptText;
    let count = 0;
    const types: Set<string> = new Set();

    // 1. Private keys
    const privateKeyRegex = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
    if (privateKeyRegex.test(cleaned)) {
      cleaned = cleaned.replace(privateKeyRegex, () => {
        count++;
        types.add('private_key');
        return '[REDACTED_PRIVATE_KEY]';
      });
    }

    // 2. AWS Access Keys
    const awsKeyRegex = /\b(AKIA[0-9A-Z]{16})\b/g;
    if (awsKeyRegex.test(cleaned)) {
      cleaned = cleaned.replace(awsKeyRegex, () => {
        count++;
        types.add('aws_access_key');
        return '[REDACTED_AWS_KEY]';
      });
    }

    // 3. OpenAI / Anthropic / Provider API keys
    const apiKeyRegex = /\b(sk-[a-zA-Z0-9_\-]{20,}|sk-ant-[a-zA-Z0-9_\-]{20,})\b/g;
    if (apiKeyRegex.test(cleaned)) {
      cleaned = cleaned.replace(apiKeyRegex, () => {
        count++;
        types.add('api_key');
        return '[REDACTED_API_KEY]';
      });
    }

    // 4. GitHub Tokens
    const ghTokenRegex = /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/g;
    if (ghTokenRegex.test(cleaned)) {
      cleaned = cleaned.replace(ghTokenRegex, () => {
        count++;
        types.add('github_token');
        return '[REDACTED_GITHUB_TOKEN]';
      });
    }

    // 5. JWT tokens (Header.Payload.Signature)
    const jwtRegex = /\b(ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,})\b/g;
    if (jwtRegex.test(cleaned)) {
      cleaned = cleaned.replace(jwtRegex, () => {
        count++;
        types.add('jwt');
        return '[REDACTED_JWT]';
      });
    }

    return {
      cleanedText: cleaned,
      redactedCount: count,
      detectedTypes: Array.from(types),
    };
  }

  /**
   * Applies the configured preflight pipeline valves to an incoming prompt.
   */
  public applyPreflightPipeline(promptText: string, customConfig?: Partial<ModelGenerationConfig>): {
    processedPrompt: string;
    totalRedactions: number;
    detectedTypes: string[];
  } {
    const activeCfg = { ...this.config, ...customConfig };
    let current = promptText;
    let totalRedactions = 0;
    const detected: Set<string> = new Set();

    if (activeCfg.enableCredentialScrubber) {
      const res = this.scrubCredentials(current);
      current = res.cleanedText;
      totalRedactions += res.redactedCount;
      res.detectedTypes.forEach((t) => detected.add(t));
    }

    if (activeCfg.enablePiiScrubber) {
      const res = this.scrubPii(current);
      current = res.cleanedText;
      totalRedactions += res.redactedCount;
      res.detectedTypes.forEach((t) => detected.add(t));
    }

    return {
      processedPrompt: current,
      totalRedactions,
      detectedTypes: Array.from(detected),
    };
  }

  /**
   * Strips ANSI terminal escape sequences and code fences from code before execution.
   */
  public sanitizeCode(rawCode: string): string {
    if (!rawCode || typeof rawCode !== 'string') return '';

    // 1. Strip ANSI escape sequences
    let code = rawCode.replace(ANSI_ESCAPE_REGEX, '').trim();

    // 2. Strip leading markdown code fence: ```language
    code = code.replace(/^```[a-zA-Z0-9_-]*\n?/, '');

    // 3. Strip trailing markdown code fence: ```
    code = code.replace(/\n?```\s*$/, '');

    return code.trim();
  }
}

export const globalPreflightPipeline = new PreflightFilterPipeline();

