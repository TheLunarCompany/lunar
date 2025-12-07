import { test, expect } from '@playwright/test';
import { DashboardActions } from './dashboard-actions';
import { setupMockedSystemState, mockSystemStates } from '../../../helpers';

const WAIT_DELAY = 2000;
const TIMEOUT = 5000;

test.describe('Dashboard - Add Agent', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    await page.waitForTimeout(WAIT_DELAY);
  });

  test('should open Add Agent modal when clicking Add Agent button', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddAgentButton();
    await actions.waitForAddAgentModal();
    
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Add AI Agent/i });
    await expect(dialog).toBeVisible({ timeout: TIMEOUT });
    
    const modalTitle = dialog.locator('h2').filter({ hasText: /Add AI Agent/i });
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUT });
  });

  test('should display Add Agent modal content', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddAgentButton();
    await actions.verifyAddAgentModalContent();
  });

  test('should show agent type selector in modal', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickAddAgentButton();
    await actions.waitForAddAgentModal();
    
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Add AI Agent/i }).first();
    const selectTrigger = dialog.locator('button').filter({ 
      hasText: /Choose an agent type/i 
    });
    await expect(selectTrigger).toBeVisible({ timeout: TIMEOUT });
  });
});

