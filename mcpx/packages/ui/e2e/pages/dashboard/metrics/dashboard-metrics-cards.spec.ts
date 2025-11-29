import { test, expect } from '@playwright/test';
import {
  mockSystemStates,
  createSystemState,
  setupMockedSystemState,
} from '../../../helpers';

const TIMEOUT = 5000;

test.describe('Dashboard Metrics Cards', () => {
  test('should display all metrics cards in zero state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    
    await page.waitForTimeout(2000);
    
    const connectedServersCard = page
      .locator('.bg-white')
      .filter({ hasText: /Connected MCP servers/i })
      .first();
    const activeAgentsCard = page
      .locator('.bg-white')
      .filter({ hasText: /Active Agents/i })
      .first();
    const totalRequestsCard = page
      .locator('.bg-white')
      .filter({ hasText: /Total Requests/i })
      .first();
    const lastActivityCard = page
      .locator('.bg-white')
      .filter({ hasText: /Last Activity/i })
      .first();
    
    await expect(connectedServersCard).toBeVisible({ timeout: TIMEOUT });
    await expect(activeAgentsCard).toBeVisible({ timeout: TIMEOUT });
    await expect(totalRequestsCard).toBeVisible({ timeout: TIMEOUT });
    await expect(lastActivityCard).toBeVisible({ timeout: TIMEOUT });
  });

  test('should show zero values in zero state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    
    await page.waitForTimeout(2000);
    
    const getCardValue = (labelText: string) => {
      return page
        .locator('.bg-white')
        .filter({ hasText: new RegExp(labelText, 'i') })
        .first()
        .locator('.text-2xl')
        .first();
    };
    
    const connectedServersValue = getCardValue('Connected MCP servers');
    await expect(connectedServersValue).toHaveText('0', { timeout: TIMEOUT });
    
    const activeAgentsValue = getCardValue('Active Agents');
    await expect(activeAgentsValue).toHaveText('0', { timeout: TIMEOUT });
    
    const totalRequestsValue = getCardValue('Total Requests');
    await expect(totalRequestsValue).toHaveText('0', { timeout: TIMEOUT });
    
    const lastActivityValue = getCardValue('Last Activity');
    await expect(lastActivityValue).toHaveText('N/A', { timeout: TIMEOUT });
  });

  test('should show correct server count with one server', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneServer);
    
    await page.waitForTimeout(2000);
    
    const connectedServersCard = page
      .locator('.bg-white')
      .filter({ hasText: /Connected MCP servers/i })
      .first();
    await expect(connectedServersCard).toBeVisible({ timeout: TIMEOUT });
    
    const connectedServersValue = connectedServersCard.locator('.text-2xl').first();
    await expect(connectedServersValue).toHaveText('1', { timeout: TIMEOUT });
  });

  test('should show correct server count with multiple servers', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.multipleServers);
    
    await page.waitForTimeout(2000);
    
    const connectedServersCard = page
      .locator('div')
      .filter({ hasText: /Connected MCP servers/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    await expect(connectedServersCard).toBeVisible({ timeout: TIMEOUT });
    
    const connectedServersValue = connectedServersCard.locator('.text-2xl').first();
    await expect(connectedServersValue).toHaveText('3', { timeout: TIMEOUT });
  });

  test('should show correct agent count with one agent', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneAgent);
    
    await page.waitForTimeout(2000);
    
    const activeAgentsCard = page
      .locator('.bg-white')
      .filter({ hasText: /Active Agents/i })
      .first();
    await expect(activeAgentsCard).toBeVisible({ timeout: TIMEOUT });
    
    const activeAgentsValue = activeAgentsCard.locator('.text-2xl').first();
    await expect(activeAgentsValue).toHaveText('0', { timeout: TIMEOUT });
  });

  test('should show correct agent count with active agents', async ({ page }) => {
    const stateWithActiveAgents = createSystemState({
      agentCount: 2,
      agentConfig: { isActive: true },
    });
    
    await setupMockedSystemState(page, stateWithActiveAgents);
    
    await page.waitForTimeout(2000);
    
    const activeAgentsCard = page
      .locator('div')
      .filter({ hasText: /Active Agents/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    await expect(activeAgentsCard).toBeVisible({ timeout: TIMEOUT });
    
    const activeAgentsValue = activeAgentsCard.locator('.text-2xl').first();
    await expect(activeAgentsValue).toHaveText('2', { timeout: TIMEOUT });
  });

  test('should show correct values with servers and agents', async ({ page }) => {
    await setupMockedSystemState(
      page,
      mockSystemStates.multipleServersMultipleAgents
    );
    
    await page.waitForTimeout(2000);
    
    const connectedServersCard = page
      .locator('div')
      .filter({ hasText: /Connected MCP servers/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    const connectedServersValue = connectedServersCard.locator('.text-2xl').first();
    await expect(connectedServersValue).toHaveText('3', { timeout: TIMEOUT });
    
    const activeAgentsCard = page
      .locator('div')
      .filter({ hasText: /Active Agents/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    await expect(activeAgentsCard).toBeVisible({ timeout: TIMEOUT });
    
    const activeAgentsValue = activeAgentsCard.locator('.text-2xl').first();
    await expect(activeAgentsValue).toHaveText('0', { timeout: TIMEOUT });
  });

  test('should show total requests from system usage', async ({ page }) => {
    const stateWithUsage = createSystemState({
      serverCount: 2,
      serverConfig: { isActive: true },
    });
    
    stateWithUsage.usage = {
      callCount: 150,
      lastCalledAt: new Date(),
    };
    
    await setupMockedSystemState(page, stateWithUsage);
    
    await page.waitForTimeout(2000);
    
    const totalRequestsCard = page
      .locator('.bg-white')
      .filter({ hasText: /Total Requests/i })
      .first();
    await expect(totalRequestsCard).toBeVisible({ timeout: TIMEOUT });
    
    const totalRequestsValue = totalRequestsCard.locator('.text-2xl').first();
    await expect(totalRequestsValue).toHaveText('150', { timeout: TIMEOUT });
  });

  test('should show last activity timestamp when available', async ({ page }) => {
    const stateWithActivity = createSystemState({
      serverCount: 1,
      serverConfig: { isActive: true },
    });
    
    const recentDate = new Date();
    stateWithActivity.usage = {
      callCount: 50,
      lastCalledAt: recentDate,
    };
    
    await setupMockedSystemState(page, stateWithActivity);
    
    await page.waitForTimeout(2000);
    
    const lastActivityCard = page
      .locator('.bg-white')
      .filter({ hasText: /Last Activity/i })
      .first();
    await expect(lastActivityCard).toBeVisible({ timeout: TIMEOUT });
    
    const lastActivityValue = lastActivityCard.locator('.text-2xl').first();
    const valueText = await lastActivityValue.textContent();
    expect(valueText).not.toBe('N/A');
    expect(valueText?.length).toBeGreaterThan(0);
  });

  test('should align card values with actual server and agent counts', async ({ page }) => {
    const customState = createSystemState({
      serverCount: 5,
      agentCount: 3,
      serverConfig: { isActive: true },
      agentConfig: { isActive: true },
    });
    
    await setupMockedSystemState(page, customState);
    
    await page.waitForTimeout(2000);
    
    const connectedServersCard = page
      .locator('div')
      .filter({ hasText: /Connected MCP servers/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    const connectedServersValue = connectedServersCard.locator('.text-2xl').first();
    await expect(connectedServersValue).toHaveText('5', { timeout: TIMEOUT });
    
    const activeAgentsCard = page
      .locator('div')
      .filter({ hasText: /Active Agents/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    const activeAgentsValue = activeAgentsCard.locator('.text-2xl').first();
    await expect(activeAgentsValue).toHaveText('3', { timeout: TIMEOUT });
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const serverCount = await serverNodes.count();
    expect(serverCount).toBeGreaterThanOrEqual(5);
    
    const agentNodes = page.locator('[data-id^="agent-"]');
    const agentCount = await agentNodes.count();
    expect(agentCount).toBeGreaterThanOrEqual(3);
  });

  test('should show correct counts for different server states', async ({ page }) => {
    const mixedState = mockSystemStates.mixedServerStates();
    
    await setupMockedSystemState(page, mixedState);
    
    await page.waitForTimeout(2000);
    
    const connectedServersCard = page
      .locator('div')
      .filter({ hasText: /Connected MCP servers/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    const connectedServersValue = connectedServersCard.locator('.text-2xl').first();
    await expect(connectedServersValue).toHaveText('1', { timeout: TIMEOUT });
  });

  test('should show correct active agents count (only active ones)', async ({ page }) => {
    const stateWithMixedAgents = createSystemState({
      agentCount: 3,
    });
    
    if (stateWithMixedAgents.connectedClientClusters.length >= 2) {
      const recentDate = new Date(Date.now() - 1000 * 30);
      stateWithMixedAgents.connectedClientClusters[0].usage.lastCalledAt = recentDate;
      stateWithMixedAgents.connectedClientClusters[1].usage.lastCalledAt = recentDate;
    }
    
    await setupMockedSystemState(page, stateWithMixedAgents);
    
    await page.waitForTimeout(2000);
    
    const activeAgentsCard = page
      .locator('div')
      .filter({ hasText: /Active Agents/i })
      .locator('xpath=ancestor::div[contains(@class, "bg-white")]')
      .first();
    const activeAgentsValue = activeAgentsCard.locator('.text-2xl').first();
    await expect(activeAgentsValue).toHaveText('2', { timeout: TIMEOUT });
  });
});
