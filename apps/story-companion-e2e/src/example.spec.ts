import { test, expect } from '@playwright/test';

test('opens the AI-first scenario wizard', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Create the next session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Local proxy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'OpenRouter cloud' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate scenario' })).toBeVisible();
});
