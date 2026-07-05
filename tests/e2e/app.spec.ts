import { test, expect } from '@playwright/test';

test('home page shell', async ({ page }) => {
  await page.goto('http://127.0.0.1:3000');
  await expect(page.getByText('Production scaffold initialized.')).toBeVisible();
});
