/**
 * @file stealth-fetch-headers.test.ts
 * @description Comprehensive unit tests for Playwright Stealth Anti-Bot Header Generator
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  StealthHeaderGenerator,
  DEVICE_PROFILES,
  type DevicePreset,
} from '../../lib/saan/stealth-fetch-headers';

describe('Playwright Stealth Anti-Bot Header Generator (Repo #34)', () => {
  const generator = new StealthHeaderGenerator();

  test('Profile Matrix - All 6 device presets defined with realistic parameters', () => {
    const presets: DevicePreset[] = [
      'desktop-chrome-linux',
      'desktop-chrome-windows',
      'desktop-safari-mac',
      'desktop-firefox-linux',
      'mobile-pixel-android',
      'mobile-iphone-safari',
    ];

    for (const preset of presets) {
      const profile = generator.getProfile(preset);
      assert.ok(profile, `Profile for ${preset} must exist`);
      assert.ok(profile.userAgent.length > 20, `UserAgent must be realistic`);
      assert.ok(profile.viewport.width > 0 && profile.viewport.height > 0);
      assert.ok(profile.deviceScaleFactor >= 1);
    }
  });

  test('Chromium Header Synthesis - Includes Client Hints and Platform', () => {
    const headers = generator.generateHeaders('desktop-chrome-linux');

    assert.ok(headers['User-Agent'].includes('Chrome'));
    assert.ok(headers['Accept'].includes('text/html'));
    assert.ok(headers['Sec-Fetch-Site'] === 'none');
    assert.ok(headers['Sec-Fetch-Mode'] === 'navigate');
    assert.ok(headers['Sec-Fetch-Dest'] === 'document');

    // Chromium Client Hints
    assert.ok(headers['Sec-Ch-Ua'], 'Chromium must include Sec-Ch-Ua');
    assert.ok(headers['Sec-Ch-Ua'].includes('Google Chrome'));
    assert.equal(headers['Sec-Ch-Ua-Mobile'], '?0');
    assert.equal(headers['Sec-Ch-Ua-Platform'], '"Linux"');
  });

  test('Mobile Device Synthesis - Includes mobile flag and touch capability', () => {
    const pixelProfile = generator.getProfile('mobile-pixel-android');
    assert.equal(pixelProfile.isMobile, true);
    assert.equal(pixelProfile.hasTouch, true);

    const headers = generator.generateHeaders('mobile-pixel-android');
    assert.equal(headers['Sec-Ch-Ua-Mobile'], '?1');
    assert.equal(headers['Sec-Ch-Ua-Platform'], '"Android"');
  });

  test('Safari & Firefox Synthesis - Clean exclusion of Chromium client hints', () => {
    const safariHeaders = generator.generateHeaders('desktop-safari-mac');
    assert.ok(safariHeaders['User-Agent'].includes('Safari'));
    assert.equal(safariHeaders['Sec-Ch-Ua'], undefined, 'Safari must not emit Chromium Sec-Ch-Ua');

    const firefoxHeaders = generator.generateHeaders('desktop-firefox-linux');
    assert.ok(firefoxHeaders['User-Agent'].includes('Firefox'));
    assert.equal(firefoxHeaders['Sec-Ch-Ua'], undefined, 'Firefox must not emit Chromium Sec-Ch-Ua');
  });

  test('Custom Overrides - Allows surgical header injection', () => {
    const headers = generator.generateHeaders('desktop-chrome-linux', {
      'Authorization': 'Bearer test-token-123',
      'X-Custom-Tracking': 'none',
    });

    assert.equal(headers['Authorization'], 'Bearer test-token-123');
    assert.equal(headers['X-Custom-Tracking'], 'none');
    assert.ok(headers['User-Agent'].includes('Chrome'));
  });
});
