import { test, expect } from '@playwright/test';

test.describe('Quote e2e', () => {
  test('placeholder flow', async ({ page }) => {
    // Placeholder: with dev server running, navigate and assert basic UI
    // In CI, start the Next.js app before running Playwright
    await page.goto('/quotes/new');
    await expect(page.locator('text=New Quote')).toBeVisible();
  });
});

