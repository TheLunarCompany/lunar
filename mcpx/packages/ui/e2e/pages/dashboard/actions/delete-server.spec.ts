import { test, expect } from '@playwright/test';
import { DashboardActions } from './dashboard-actions';
import { setupMockedSystemState, createSystemState } from '../../../helpers';

const WAIT_DELAY = 2000;

test.describe('Dashboard - Delete Server', () => {
  test.beforeEach(async ({ page }) => {
    const stateWithServer = createSystemState({
      serverCount: 1,
      serverConfig: { name: 'test-server' },
    });
    
    await setupMockedSystemState(page, stateWithServer);
    await page.waitForTimeout(WAIT_DELAY);
  });

  test('should open server details drawer when clicking on server node', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickServerNode('test-server');
    await actions.waitForServerDetailsDrawer();
    
    const drawer = page.locator('[role="dialog"]').or(page.locator('div[class*="sheet"]'));
    await expect(drawer).toBeVisible({ timeout: 5000 });
  });

  test('should show delete button in server details drawer', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickServerNode('test-server');
    await actions.waitForServerDetailsDrawer();
    
    const drawer = page.locator('[role="dialog"]').or(page.locator('div[class*="sheet"]')).first();
    await expect(drawer).toBeVisible({ timeout: 5000 });
    
    const allButtons = drawer.locator('button');
    const buttonCount = await allButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);
    
    let foundDeleteButton = false;
    
    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const svg = button.locator('svg').first();
      const isVisible = await svg.isVisible().catch(() => false);
      if (isVisible) {
        const svgContent = await svg.innerHTML().catch(() => '');
        if (svgContent.includes('M16.875 3.75') || svgContent.includes('M3.75V16.25') || 
            svgContent.includes('V3.125') && svgContent.includes('V16.25')) {
          foundDeleteButton = true;
          break;
        }
      }
    }
    
    expect(foundDeleteButton).toBe(true);
  });

  test('should show confirmation toast when clicking delete button', async ({ page }) => {
    const actions = new DashboardActions(page);
    
    await actions.clickServerNode('test-server');
    await actions.clickDeleteServerButton();
    
    const confirmButton = page.locator('button').filter({ hasText: /^Ok$/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
  });

});

