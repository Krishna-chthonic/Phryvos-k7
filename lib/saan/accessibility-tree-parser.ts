/**
 * @file accessibility-tree-parser.ts
 * @description Clean-room TypeScript adaptation of DOM/HTML accessibility tree serialization
 * and interactive element indexing inspired by browser-use. Generates token-efficient
 * indexed accessibility views [0], [1], [2] for agent interaction.
 */

export interface InteractiveElement {
  index: number;
  tag: string;
  type?: string;
  name?: string;
  role?: string;
  text: string;
  value?: string;
  placeholder?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
}

export interface AccessibilityTreeResult {
  serializedTree: string;
  selectorMap: Record<number, InteractiveElement>;
  interactiveCount: number;
}

const DYNAMIC_CLASSES = new Set([
  'focus',
  'hover',
  'active',
  'selected',
  'disabled',
  'animation',
  'transition',
  'loading',
  'open',
  'closed',
  'expanded',
  'collapsed',
  'visible',
  'hidden',
  'pressed',
  'checked',
  'highlighted',
  'current',
]);

export class AccessibilityTreeParser {
  /**
   * Parses an HTML fragment or page into an indexed accessibility tree with a selector map.
   */
  public parse(html: string): AccessibilityTreeResult {
    if (!html || typeof html !== 'string') {
      return { serializedTree: '', selectorMap: {}, interactiveCount: 0 };
    }

    const selectorMap: Record<number, InteractiveElement> = {};
    let currentIndex = 0;

    // 1. Collapse SVG elements first
    let processed = html.replace(/<svg[\s\S]*?<\/svg>/gi, '<svg /> <!-- SVG content collapsed -->');

    // 2. Strip script, style, comments
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');
    processed = processed.replace(/<(?:script|style|noscript)[\s\S]*?<\/(?:script|style|noscript)>/gi, '');

    // 3. Find and index interactive elements
    // We match specific interactive tags or elements with interactive roles/handlers
    // Avoid matching generic non-interactive containers that swallow children.
    const patterns = [
      {
        // Void/Self-closing input elements
        regex: /<input\b([^>]*?)\/?>/gi,
        isVoid: true,
        tag: 'input',
      },
      {
        // Button elements
        regex: /<button\b([^>]*?)>([\s\S]*?)<\/button>/gi,
        isVoid: false,
        tag: 'button',
      },
      {
        // Anchor elements
        regex: /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi,
        isVoid: false,
        tag: 'a',
      },
      {
        // Select elements
        regex: /<select\b([^>]*?)>([\s\S]*?)<\/select>/gi,
        isVoid: false,
        tag: 'select',
      },
      {
        // Textarea elements
        regex: /<textarea\b([^>]*?)>([\s\S]*?)<\/textarea>/gi,
        isVoid: false,
        tag: 'textarea',
      },
      {
        // ARIA interactive elements (role=button, combobox, link, checkbox, tab)
        regex: /<(div|span|section|li|p)\b([^>]*(?:role=["'](?:button|link|combobox|checkbox|tab|menuitem)["']|onclick)[^>]*)>([\s\S]*?)<\/\1>/gi,
        isVoid: false,
        tag: 'aria',
      },
    ];

    interface FoundCandidate {
      position: number;
      tag: string;
      rawAttrs: string;
      innerContent: string;
    }

    const candidates: FoundCandidate[] = [];

    for (const p of patterns) {
      let match: RegExpExecArray | null;
      while ((match = p.regex.exec(processed)) !== null) {
        if (p.isVoid) {
          candidates.push({
            position: match.index,
            tag: p.tag,
            rawAttrs: match[1] || '',
            innerContent: '',
          });
        } else if (p.tag === 'aria') {
          candidates.push({
            position: match.index,
            tag: match[1].toLowerCase(),
            rawAttrs: match[2] || '',
            innerContent: match[3] || '',
          });
        } else {
          candidates.push({
            position: match.index,
            tag: p.tag,
            rawAttrs: match[1] || '',
            innerContent: match[2] || '',
          });
        }
      }
    }

    // Sort candidates by document appearance order
    candidates.sort((a, b) => a.position - b.position);

    const lines: string[] = [];

    for (const cand of candidates) {
      const attrs = this.parseAttributes(cand.rawAttrs);
      const isInteractive = this.checkIsInteractive(cand.tag, attrs);

      if (isInteractive) {
        const text = this.cleanText(cand.innerContent) || attrs['aria-label'] || attrs['title'] || attrs['placeholder'] || attrs['value'] || '';
        const idx = currentIndex++;

        const item: InteractiveElement = {
          index: idx,
          tag: cand.tag,
          type: attrs['type'],
          name: attrs['name'],
          role: attrs['role'] || (cand.tag === 'button' ? 'button' : cand.tag === 'a' ? 'link' : undefined),
          text: text.slice(0, 120),
          value: attrs['value'],
          placeholder: attrs['placeholder'],
          href: attrs['href'],
          disabled: attrs['disabled'] !== undefined,
          checked: attrs['checked'] !== undefined,
        };

        selectorMap[idx] = item;

        // Build concise LLM-friendly line
        const attrParts: string[] = [];
        if (item.type) attrParts.push(`type="${item.type}"`);
        if (item.name) attrParts.push(`name="${item.name}"`);
        if (item.placeholder) attrParts.push(`placeholder="${item.placeholder}"`);
        if (item.value) attrParts.push(`value="${item.value}"`);
        if (item.href) attrParts.push(`href="${item.href}"`);
        if (item.role && item.role !== cand.tag) attrParts.push(`role="${item.role}"`);
        if (item.disabled) attrParts.push(`disabled`);

        const attrStr = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
        const line = `[${idx}] <${cand.tag}${attrStr}>${item.text}</${cand.tag}>`;
        lines.push(line);
      }
    }

    const serializedTree = lines.join('\n');

    return {
      serializedTree,
      selectorMap,
      interactiveCount: currentIndex,
    };
  }

  private checkIsInteractive(tag: string, attrs: Record<string, string>): boolean {
    if (['button', 'select', 'textarea'].includes(tag)) return true;
    if (tag === 'input' && attrs['type'] !== 'hidden') return true;
    if (tag === 'a' && attrs['href']) return true;

    const role = (attrs['role'] || '').toLowerCase();
    if (['button', 'link', 'combobox', 'checkbox', 'radio', 'tab', 'menuitem'].includes(role)) {
      return true;
    }

    if (attrs['onclick'] || attrs['tabindex']) return true;
    return false;
  }

  private parseAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRegex = /([a-z0-9_-]+)(?:=["']([^"']*)["'])?/gi;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(attrString)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[2] !== undefined ? match[2] : 'true';
      attrs[key] = val;
    }

    return attrs;
  }

  private cleanText(str: string): string {
    return str
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
