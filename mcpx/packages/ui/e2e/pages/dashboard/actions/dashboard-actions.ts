import { Page, expect } from '@playwright/test';

const TIMEOUT = 5000;
const WAIT_DELAY = 2000;

const SERVER_NAME_MAP: Record<string, string> = {
  'Memory': 'memory',
  'Time': 'time',
  'Slack': 'slack',
  'Playwright': 'playwright',
  'Sequential Thinking': 'sequential-thinking',
  'Notion': 'Notion',
  'Asana': 'asana',
  'Atlassian': 'atlassian',
  'LaunchDarkly': 'LaunchDarkly',
  'PostgreSQL': 'postgres',
  'Snowflake': 'snowflake',
  'Redis': 'redis',
};

function getServerNameFromLabel(label: string): string {
  return SERVER_NAME_MAP[label] || label.toLowerCase();
}

export class DashboardActions {
  constructor(private page: Page) {}

  async clickAddServerButton(): Promise<void> {
    const addServerButton = this.page
      .locator('button')
      .filter({ hasText: /Add Server/i })
      .first();
    
    await expect(addServerButton).toBeVisible({ timeout: TIMEOUT });
    await expect(addServerButton).toBeEnabled();
    await addServerButton.click();
    
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async waitForAddServerModal(): Promise<void> {
    const modalTitle = this.page.locator('div').filter({ hasText: /^Add Server$/i });
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUT });
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async selectServerFromCatalog(serverName: string): Promise<void> {
    await this.waitForAddServerModal();
    
    const labelSpan = this.page
      .locator('span')
      .filter({ hasText: new RegExp(`^${serverName}$`, 'i') })
      .first();
    
    await expect(labelSpan).toBeVisible({ timeout: TIMEOUT });
    
    const serverCard = labelSpan
      .locator('xpath=ancestor::div[contains(@class, "border") and contains(@class, "rounded-xl")]')
      .first();
    
    await expect(serverCard).toBeVisible({ timeout: TIMEOUT });
    
    const plusButton = serverCard
      .locator('button')
      .locator('svg')
      .locator('..')
      .first();
    
    await expect(plusButton).toBeVisible({ timeout: TIMEOUT });
    await plusButton.click();
    
    await this.page.waitForTimeout(WAIT_DELAY);
    
    const customTab = this.page.locator('button').filter({ hasText: /^Custom$/i });
    const isCustomTabActive = await customTab.getAttribute('data-state');
    
    if (isCustomTabActive === 'active') {
      const addButton = this.page
        .locator('button')
        .filter({ hasText: /^Add$/i })
        .first();
      
      await expect(addButton).toBeVisible({ timeout: TIMEOUT });
      await expect(addButton).toBeEnabled({ timeout: TIMEOUT });
      await addButton.click();
      
      await this.page.waitForTimeout(WAIT_DELAY);
    }
  }

  async verifyServerOnCanvas(serverLabel: string): Promise<void> {
    const serverName = getServerNameFromLabel(serverLabel);
    const serverNode = this.page.locator(`[data-id^="server-${serverName}"]`);
    await this.page.waitForTimeout(WAIT_DELAY);
    await expect(serverNode).toBeVisible({ timeout: TIMEOUT * 2 });
  }

  async verifyServerCount(expectedCount: number): Promise<void> {
    const serverNodes = this.page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    expect(count).toBeGreaterThanOrEqual(expectedCount);
  }

  async closeAddServerModal(): Promise<void> {
    const closeButton = this.page
      .locator('button')
      .filter({ hasText: /Close/i })
      .or(this.page.locator('[aria-label="Close"]'))
      .first();
    
    const isVisible = await closeButton.isVisible().catch(() => false);
    if (isVisible) {
      await closeButton.click();
      await this.page.waitForTimeout(WAIT_DELAY);
    }
  }

  async createServerFromCatalog(serverLabel: string): Promise<void> {
    await this.clickAddServerButton();
    await this.selectServerFromCatalog(serverLabel);
    await this.verifyServerOnCanvas(serverLabel);
  }

  async clickServerNode(serverName: string): Promise<void> {
    const serverNode = this.page.locator(`[data-id^="server-${serverName}"]`);
    await expect(serverNode).toBeVisible({ timeout: TIMEOUT });
    await serverNode.click();
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async waitForServerDetailsDrawer(): Promise<void> {
    const drawer = this.page.locator('[role="dialog"]').or(this.page.locator('div[class*="sheet"]'));
    await expect(drawer).toBeVisible({ timeout: TIMEOUT });
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async clickDeleteServerButton(): Promise<void> {
    await this.waitForServerDetailsDrawer();
    
    const drawer = this.page.locator('[role="dialog"]').or(this.page.locator('div[class*="sheet"]')).first();
    await expect(drawer).toBeVisible({ timeout: TIMEOUT });
    
    const allButtons = drawer.locator('button');
    const buttonCount = await allButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const svg = button.locator('svg').first();
      const isVisible = await svg.isVisible().catch(() => false);
      if (isVisible) {
        const svgContent = await svg.innerHTML().catch(() => '');
        if (svgContent.includes('M16.875 3.75') || svgContent.includes('M3.75V16.25') || 
            (svgContent.includes('V3.125') && svgContent.includes('V16.25'))) {
          await button.click();
          await this.page.waitForTimeout(WAIT_DELAY);
          return;
        }
      }
    }
    
    throw new Error('Delete button not found');
  }

  async confirmDeleteServer(): Promise<void> {
    const confirmButton = this.page
      .locator('button')
      .filter({ hasText: /^Ok$/i })
      .first();
    
    await expect(confirmButton).toBeVisible({ timeout: TIMEOUT });
    await confirmButton.click();
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async verifyServerDeleted(serverName: string): Promise<void> {
    const serverNode = this.page.locator(`[data-id^="server-${serverName}"]`);
    await expect(serverNode).not.toBeVisible({ timeout: TIMEOUT * 2 });
  }

  async deleteServer(serverName: string): Promise<void> {
    await this.clickServerNode(serverName);
    await this.clickDeleteServerButton();
    await this.confirmDeleteServer();
    await this.verifyServerDeleted(serverName);
  }

  async clickAddAgentButton(): Promise<void> {
    const addAgentButton = this.page
      .locator('button')
      .filter({ hasText: /Add Agent/i })
      .first();
    
    await expect(addAgentButton).toBeVisible({ timeout: TIMEOUT });
    await expect(addAgentButton).toBeEnabled();
    await addAgentButton.click();
    
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async waitForAddAgentModal(): Promise<void> {
    const dialog = this.page
      .locator('[role="dialog"]')
      .filter({ hasText: /Add AI Agent/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: TIMEOUT });
    
    const modalTitle = dialog.locator('h2').filter({ hasText: /Add AI Agent/i });
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUT });
    await this.page.waitForTimeout(WAIT_DELAY);
  }

  async verifyAddAgentModalContent(): Promise<void> {
    await this.waitForAddAgentModal();
    
    const dialog = this.page.locator('[role="dialog"]').first();
    
    const description = dialog.locator('p').filter({ 
      hasText: /Select your agent type and copy the configuration JSON/i 
    }).first();
    await expect(description).toBeVisible({ timeout: TIMEOUT });
    
    const selectLabel = dialog.locator('label').filter({ hasText: /Select Agent Type/i });
    await expect(selectLabel).toBeVisible({ timeout: TIMEOUT });
    
    const selectTrigger = dialog.locator('button').filter({ 
      hasText: /Choose an agent type/i 
    });
    await expect(selectTrigger).toBeVisible({ timeout: TIMEOUT });
  }
}

