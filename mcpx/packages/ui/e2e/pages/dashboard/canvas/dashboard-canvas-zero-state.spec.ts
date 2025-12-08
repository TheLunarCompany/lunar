import { test, expect } from "@playwright/test";
import { mockSystemStates, setupMockedSystemState } from "../../../helpers";
import {
  DELAY_2_SEC,
  TIMEOUT_5_SEC,
  TIMEOUT_10_SEC,
} from "../../../constants/delays";

test.describe("Dashboard Canvas Zero State", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);

    await page.waitForSelector('[class*="bg-gray-100"]', {
      timeout: TIMEOUT_10_SEC,
    });
  });

  test("should display zero state when no servers are connected", async ({
    page,
  }) => {
    const canvasCard = page
      .locator('div[class*="flex-1"][class*="shadow-sm"]')
      .first();
    await expect(canvasCard).toBeVisible();

    await page.waitForTimeout(DELAY_2_SEC);

    const reactFlowCanvas = page.locator(".react-flow");
    const isReactFlowVisible = await reactFlowCanvas
      .isVisible()
      .catch(() => false);

    if (isReactFlowVisible) {
      const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
      const noServersNode = page.locator(
        '.react-flow__node[data-id="no-servers"]',
      );
      const noAgentsNode = page.locator(
        '.react-flow__node[data-id="no-agents"]',
      );

      await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
      await expect(noServersNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
      await expect(noAgentsNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
    } else {
      const zeroStateCard = page.locator('div[class*="border-dashed"]').filter({
        hasText: /No MCP servers?/i,
      });
      await expect(zeroStateCard).toBeVisible();
    }
  });

  test("should display zero state card with correct text and icon", async ({
    page,
  }) => {
    await page.waitForTimeout(DELAY_2_SEC);

    const noServersCard = page
      .locator('div[class*="border-dashed"][class*="border-[#5147E4]"]')
      .filter({ hasText: /No MCP Server/i });

    await expect(noServersCard).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await expect(noServersCard).toContainText("No MCP Server");
    await expect(noServersCard).toContainText("Waiting for server connection");

    const icon = noServersCard.locator("svg").first();
    await expect(icon).toBeVisible();
  });

  test("should display placeholder nodes in zero state", async ({ page }) => {
    await page.waitForTimeout(DELAY_2_SEC);

    const reactFlow = page.locator(".react-flow");
    await expect(reactFlow).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    const noServersNode = page.locator(
      '.react-flow__node[data-id="no-servers"]',
    );
    const noAgentsNode = page.locator('.react-flow__node[data-id="no-agents"]');

    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await expect(noServersNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await expect(noAgentsNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const noServersCard = page
      .locator('div[class*="border-dashed"][class*="border-[#5147E4]"]')
      .filter({ hasText: /No MCP Server/i });

    await expect(noServersCard).toBeVisible();
    await expect(noServersCard).toContainText("No MCP Server");
    await expect(noServersCard).toContainText("Waiting for server connection");

    const addServerButton = noServersCard.locator("button").filter({
      hasText: /Add Server/i,
    });
    await expect(addServerButton).toBeVisible();
  });

  test('should have "Add Server" button in zero state', async ({ page }) => {
    await page.waitForTimeout(DELAY_2_SEC);

    const topPanelAddServerButton = page
      .locator("button")
      .filter({ hasText: /Add Server/i })
      .first();

    await expect(topPanelAddServerButton).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });

    await expect(topPanelAddServerButton).toBeEnabled();
  });

  test('should have "Add Agent" button in zero state', async ({ page }) => {
    await page.waitForTimeout(DELAY_2_SEC);

    const addAgentButton = page
      .locator("button")
      .filter({ hasText: /Add Agent/i })
      .first();

    await expect(addAgentButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await expect(addAgentButton).toBeEnabled();
  });

  test('should display "System Connectivity" title', async ({ page }) => {
    await page.waitForTimeout(DELAY_2_SEC);

    const systemConnectivityTitle = page
      .locator("h2")
      .filter({ hasText: /System Connectivity/i });

    await expect(systemConnectivityTitle).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });
  });
});
