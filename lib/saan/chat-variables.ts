/**
 * Chat Variable Storage Engine (from SillyTavern variables.js)
 *
 * Implements:
 * 1. Persistent conversational variable store (getvar, setvar, addvar, togglevar)
 * 2. In-memory cache with fallback defaults
 * 3. Type-safe value conversions (number, boolean, string)
 */

export type VariableValue = string | number | boolean;

class ChatVariableStore {
  private store = new Map<string, VariableValue>();

  /**
   * Retrieves a variable value with optional default fallback
   */
  get(key: string, defaultValue?: VariableValue): VariableValue | undefined {
    if (this.store.has(key)) {
      return this.store.get(key);
    }
    return defaultValue;
  }

  /**
   * Sets a variable value
   */
  set(key: string, value: VariableValue): void {
    this.store.set(key, value);
  }

  /**
   * Increments a numeric variable by delta (default +1)
   */
  add(key: string, delta = 1): number {
    const current = Number(this.get(key, 0));
    const next = current + delta;
    this.set(key, next);
    return next;
  }

  /**
   * Toggles a boolean variable
   */
  toggle(key: string): boolean {
    const current = Boolean(this.get(key, false));
    const next = !current;
    this.set(key, next);
    return next;
  }

  /**
   * Returns all stored variables
   */
  getAll(): Record<string, VariableValue> {
    const obj: Record<string, VariableValue> = {};
    for (const [k, v] of this.store.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  /**
   * Clears all stored variables
   */
  clear(): void {
    this.store.clear();
  }
}

// Global Singleton Store
export const globalChatVariables = new ChatVariableStore();
