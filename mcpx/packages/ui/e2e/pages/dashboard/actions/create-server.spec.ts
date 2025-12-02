import { test, expect } from '@playwright/test';
import { DashboardActions } from './dashboard-actions';
import { setupMockedSystemState, mockSystemStates } from '../../../helpers';

const WAIT_DELAY = 2000;

test.describe('Dashboard - Create Server from Catalog', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    await page.waitForTimeout(WAIT_DELAY);
  });

  test('should open Add Server modal when clicking Add Server button', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddServerButton();
    await actions.waitForAddServerModal();
    
    const modalTitle = page.locator('div').filter({ hasText: /^Add Server$/i });
    await expect(modalTitle).toBeVisible({ timeout: 5000 });
  });

  test('should display server catalog in modal', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddServerButton();
    await actions.waitForAddServerModal();
    
    const memoryServer = page.locator('span').filter({ hasText: /^Memory$/i });
    await expect(memoryServer).toBeVisible({ timeout: 5000 });
    
    const timeServer = page.locator('span').filter({ hasText: /^Time$/i });
    await expect(timeServer).toBeVisible({ timeout: 5000 });
  });

  test('should select server from catalog and show Add button for servers with env vars', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddServerButton();
    await actions.waitForAddServerModal();
    
    await actions.selectServerFromCatalog('Memory');
    
    const addButton = page.locator('button').filter({ hasText: /^Add$/i });
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });

  test('should select server without env vars and add immediately', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddServerButton();
    await actions.waitForAddServerModal();
    
    const timeServerSpan = page.locator('span').filter({ hasText: /^Time$/i }).first();
    await expect(timeServerSpan).toBeVisible({ timeout: 5000 });
    
    const serverCard = timeServerSpan
      .locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "rounded-xl")]')
      .first();
    
    const plusButton = serverCard.locator('button').locator('svg').locator('..').first();
    await plusButton.click();
    
    await page.waitForTimeout(WAIT_DELAY);
    
    const customTab = page.locator('button').filter({ hasText: /^Custom$/i });
    const isCustomTabActive = await customTab.getAttribute('data-state');
    
    expect(isCustomTabActive).not.toBe('active');
  });
});

