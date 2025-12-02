import { test, expect } from '@playwright/test';
import {
  mockSystemStates,
  createSystemState,
  setupMockedSystemState,
} from '../../../helpers';

test.describe('Dashboard Canvas with Mocks', () => {
  test('zero state - no servers, no agents', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    
    await page.waitForTimeout(2000);
    
    const reactFlow = page.locator('.react-flow');
    await expect(reactFlow).toBeVisible({ timeout: 5000 });
    
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    const noServersNode = page.locator('.react-flow__node[data-id="no-servers"]');
    const noAgentsNode = page.locator('.react-flow__node[data-id="no-agents"]');
    
    await expect(mcpxNode).toBeVisible({ timeout: 5000 });
    await expect(noServersNode).toBeVisible({ timeout: 5000 });
    await expect(noAgentsNode).toBeVisible({ timeout: 5000 });
    
    const noServersCard = page
      .locator('div[class*="border-dashed"][class*="border-[#5147E4]"]')
      .filter({ hasText: /No MCP Server/i });
    
    await expect(noServersCard).toBeVisible({ timeout: 5000 });
    await expect(noServersCard).toContainText('No MCP Server');
    await expect(noServersCard).toContainText('Waiting for server connection');
  });

  test('one server state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneServer);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('multiple servers state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.multipleServers);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('one agent state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneAgent);
    
    await page.waitForTimeout(2000);
    
    const agentNodes = page.locator('[data-id^="agent-"]');
    const count = await agentNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('one server and one agent state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneServerOneAgent);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const agentNodes = page.locator('[data-id^="agent-"]');
    
    const serverCount = await serverNodes.count();
    const agentCount = await agentNodes.count();
    
    expect(serverCount).toBeGreaterThanOrEqual(1);
    expect(agentCount).toBeGreaterThanOrEqual(1);
  });

  test('multiple servers and agents state', async ({ page }) => {
    await setupMockedSystemState(
      page,
      mockSystemStates.multipleServersMultipleAgents
    );
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const agentNodes = page.locator('[data-id^="agent-"]');
    
    const serverCount = await serverNodes.count();
    const agentCount = await agentNodes.count();
    
    expect(serverCount).toBeGreaterThanOrEqual(3);
    expect(agentCount).toBeGreaterThanOrEqual(2);
  });

  test('active servers state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.activeServers);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('pending auth servers state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.pendingAuthServers);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('failed servers state', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.failedServers);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('mixed server states', async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.mixedServerStates());
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('custom configuration - 5 servers with 10 tools each', async ({ page }) => {
    const customState = createSystemState({
      serverCount: 5,
      serverConfig: { toolCount: 10 },
    });
    
    await setupMockedSystemState(page, customState);
    
    await page.waitForTimeout(2000);
    
    const serverNodes = page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('custom configuration - 2 active agents', async ({ page }) => {
    const customState = createSystemState({
      agentCount: 2,
      agentConfig: { isActive: true },
    });
    
    await setupMockedSystemState(page, customState);
    
    await page.waitForTimeout(2000);
    
    const agentNodes = page.locator('[data-id^="agent-"]');
    const count = await agentNodes.count();
    
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
