/**
 * @file stealth-fetch-headers.ts
 * @description Clean-room TypeScript adaptation of Playwright's device descriptors
 * and anti-bot HTTP header synthesis. Allows fast HTTP page retrieval avoiding bot
 * detection without running heavy Chromium instances.
 */

export type DevicePreset =
  | 'desktop-chrome-linux'
  | 'desktop-chrome-windows'
  | 'desktop-safari-mac'
  | 'desktop-firefox-linux'
  | 'mobile-pixel-android'
  | 'mobile-iphone-safari';

export interface Viewport {
  width: number;
  height: number;
}

export interface DeviceProfile {
  name: string;
  userAgent: string;
  viewport: Viewport;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit';
  platform: string;
  brands: Array<{ brand: string; version: string }>;
}

export const DEVICE_PROFILES: Record<DevicePreset, DeviceProfile> = {
  'desktop-chrome-linux': {
    name: 'Desktop Chrome (Linux)',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'chromium',
    platform: 'Linux',
    brands: [
      { brand: 'Chromium', version: '130' },
      { brand: 'Google Chrome', version: '130' },
      { brand: 'Not?A_Brand', version: '99' },
    ],
  },
  'desktop-chrome-windows': {
    name: 'Desktop Chrome (Windows)',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'chromium',
    platform: 'Windows',
    brands: [
      { brand: 'Chromium', version: '130' },
      { brand: 'Google Chrome', version: '130' },
      { brand: 'Not?A_Brand', version: '99' },
    ],
  },
  'desktop-safari-mac': {
    name: 'Desktop Safari (macOS)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'webkit',
    platform: 'macOS',
    brands: [],
  },
  'desktop-firefox-linux': {
    name: 'Desktop Firefox (Linux)',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'firefox',
    platform: 'Linux',
    brands: [],
  },
  'mobile-pixel-android': {
    name: 'Pixel 7 (Android)',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    platform: 'Android',
    brands: [
      { brand: 'Chromium', version: '130' },
      { brand: 'Google Chrome', version: '130' },
      { brand: 'Not?A_Brand', version: '99' },
    ],
  },
  'mobile-iphone-safari': {
    name: 'iPhone 15 (iOS Safari)',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    platform: 'iOS',
    brands: [],
  },
};

export class StealthHeaderGenerator {
  /**
   * Generates realistic, anti-bot navigation HTTP headers for a given device profile.
   */
  public generateHeaders(
    preset: DevicePreset = 'desktop-chrome-linux',
    overrides: Record<string, string> = {}
  ): Record<string, string> {
    const profile = DEVICE_PROFILES[preset] || DEVICE_PROFILES['desktop-chrome-linux'];
    const headers: Record<string, string> = {
      'User-Agent': profile.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Priority': 'u=0, i',
    };

    // Client hints for Chromium-based browsers
    if (profile.defaultBrowserType === 'chromium' && profile.brands.length > 0) {
      headers['Sec-Ch-Ua'] = profile.brands.map(b => `"${b.brand}";v="${b.version}"`).join(', ');
      headers['Sec-Ch-Ua-Mobile'] = profile.isMobile ? '?1' : '?0';
      headers['Sec-Ch-Ua-Platform'] = `"${profile.platform}"`;
    }

    return { ...headers, ...overrides };
  }

  /**
   * Retrieves full device profile specifications.
   */
  public getProfile(preset: DevicePreset = 'desktop-chrome-linux'): DeviceProfile {
    return DEVICE_PROFILES[preset] || DEVICE_PROFILES['desktop-chrome-linux'];
  }
}
