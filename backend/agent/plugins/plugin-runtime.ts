/**
 * Safe runtime helpers available to plugin tools
 * These functions provide useful utilities without exposing dangerous APIs
 */
export const PluginRuntime = {
  /**
   * Wait for a specified number of milliseconds
   * @param ms Milliseconds to wait
   */
  wait(ms: number): Promise<void> {
    const maxWait = 5000; // Max 5 seconds
    const safeMs = Math.min(Math.max(0, ms), maxWait);
    return new Promise((resolve) => setTimeout(resolve, safeMs));
  },

  /**
   * Get current timestamp
   */
  now(): number {
    return Date.now();
  },

  /**
   * Convert string to uppercase
   */
  upper(str: any): string {
    return String(str).toUpperCase();
  },

  /**
   * Convert string to lowercase
   */
  lower(str: any): string {
    return String(str).toLowerCase();
  },

  /**
   * Trim whitespace from string
   */
  trim(str: any): string {
    return String(str).trim();
  },

  /**
   * Get random number between 0 and 1
   */
  random(): number {
    return Math.random();
  },

  /**
   * Generate random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    const safeMin = Math.floor(min);
    const safeMax = Math.floor(max);
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  },

  /**
   * Safe JSON utilities
   */
  json: {
    parse(str: string): any {
      return JSON.parse(str);
    },
    stringify(obj: any, space?: number): string {
      return JSON.stringify(obj, null, space);
    },
  },

  /**
   * Array utilities
   */
  array: {
    sum(arr: number[]): number {
      return arr.reduce((a, b) => a + b, 0);
    },
    avg(arr: number[]): number {
      return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    },
    max(arr: number[]): number {
      return Math.max(...arr);
    },
    min(arr: number[]): number {
      return Math.min(...arr);
    },
  },

  /**
   * String utilities
   */
  string: {
    capitalize(str: string): string {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    reverse(str: string): string {
      return str.split("").reverse().join("");
    },
    truncate(str: string, maxLength: number): string {
      return str.length > maxLength
        ? str.substring(0, maxLength - 3) + "..."
        : str;
    },
  },

  /**
   * Math utilities
   */
  math: {
    round(num: number, decimals: number = 0): number {
      const factor = Math.pow(10, decimals);
      return Math.round(num * factor) / factor;
    },
    clamp(num: number, min: number, max: number): number {
      return Math.min(Math.max(num, min), max);
    },
  },
};
