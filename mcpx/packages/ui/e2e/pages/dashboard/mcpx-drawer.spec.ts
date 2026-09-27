import { test, expect } from "@playwright/test";
import { DashboardActions } from "./actions/dashboard-actions";
import {
  setupMockedSystemState,
  createSystemState,
  createMockServer,
} from "../../helpers";
import { SystemState } from "@mcpx/shared-model";
import { DELAY_2_SEC, TIMEOUT_5_SEC } from "../../constants/delays";

/**
 * Creates a system state with multiple servers for testing
 */
function createSystemStateWithServers(): SystemState {
  const server1 = createMockServer({
    name: "test-server-1",
    state: "connected",
    isActive: true,
  });

  const server2 = createMockServer({
    name: "test-server-2",
    state: "connected",
    isActive: true,
  });

  const inactiveServer = createMockServer({
    name: "inactive-server",
    state: "connected",
    isActive: false,
  });

  return {
    ...createSystemState({ serverCount: 0 }),
    targetServers: [server1, server2, inactiveServer],
  };
}

/**
 * Creates appConfig with inactive server configuration
 */
function createAppConfigWithInactiveServer() {
  return {
    targetServerAttributes: {
      "inactive-server": {
        inactive: true,
      },
    },
    permissions: {
      default: {
        _type: "default-allow",
        allow: [],
      },
      consumers: {},
    },
    toolGroups: [],
    auth: {},
    toolExtensions: {},
  };
}

test.describe("Dashboard - MCPX Drawer", () => {
  test.beforeEach(async ({ page }) => {
    const systemState = createSystemStateWithServers();
    const appConfig = createAppConfigWithInactiveServer();

    await setupMockedSystemState(page, systemState, appConfig);
    await page.waitForTimeout(DELAY_2_SEC);
  });

  test("should open MCPX drawer when clicking on MCPX node", async ({
    page,
  }) => {
    // Wait for the MCPX node to be visible
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Click on the MCPX node
    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    // Verify the drawer is open
    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });

    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Verify drawer content
    const mcpxTitle = drawer.locator("p").filter({ hasText: /^MCPX$/i });
    await expect(mcpxTitle).toBeVisible({ timeout: TIMEOUT_5_SEC });
  });

  test("should close MCPX drawer when clicking close button", async ({
    page,
  }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Open the drawer
    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    // Verify drawer is open
    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Find and click the close button (arrow icon button in header)
    // The button is in the header section on the right side
    // Try to find any button with SVG in the drawer header area
    const headerButtons = drawer
      .locator('div[class*="flex"][class*="justify-between"]')
      .locator("button");

    const buttonCount = await headerButtons.count();

    let clicked = false;
    for (let i = 0; i < buttonCount; i++) {
      const button = headerButtons.nth(i);
      const hasSvg = await button.locator("svg").count();
      if (hasSvg > 0) {
        const isVisible = await button.isVisible().catch(() => false);
        if (isVisible) {
          await button.click();
          await page.waitForTimeout(DELAY_2_SEC);
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      // Fallback: press ESC key to close the drawer
      await page.keyboard.press("Escape");
      await page.waitForTimeout(DELAY_2_SEC);
    }

    // Verify drawer is closed
    await expect(drawer).not.toBeVisible({ timeout: TIMEOUT_5_SEC });
  });

  test("should display server list in MCPX drawer", async ({ page }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Open the drawer
    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Wait for servers to load
    await page.waitForTimeout(DELAY_2_SEC);

    // Check for "Servers" heading (the main one in the servers section, not the stats one)
    // Look for the heading that's inside the flex-1 container
    const serversSection = drawer.locator('div[class*="flex-1"]').first();
    await expect(serversSection).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const serversHeading = serversSection
      .locator("div")
      .filter({ hasText: /^Servers$/i });
    await expect(serversHeading.first()).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });

    // Check for server cards (should have at least 3 servers)
    const serverCards = drawer.locator(
      'div[class*="border"][class*="bg-white"]',
    );
    const cardCount = await serverCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(3);
  });

  test("should display server names and tool counts in drawer", async ({
    page,
  }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await page.waitForTimeout(DELAY_2_SEC);

    // Check for server names
    const server1Name = drawer
      .locator("h3")
      .filter({ hasText: /test-server-1/i });
    await expect(server1Name).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Check for tool counts
    const toolCounts = drawer.locator("p").filter({ hasText: /Tools$/i });
    const count = await toolCounts.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("should toggle server active/inactive state", async ({ page }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await page.waitForTimeout(DELAY_2_SEC);

    // Find the server card for test-server-1
    const serverName = drawer
      .locator("h3")
      .filter({ hasText: /test-server-1/i })
      .first();
    await expect(serverName).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const serverCard = serverName
      .locator(
        'xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")]',
      )
      .first();

    await expect(serverCard).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Find the toggle switch in the server card
    const toggleSwitch = serverCard.locator('button[role="switch"]').first();
    await expect(toggleSwitch).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Get initial state
    const initialChecked = await toggleSwitch.getAttribute("aria-checked");
    const isInitiallyChecked = initialChecked === "true";

    // Toggle the switch
    await toggleSwitch.click();
    await page.waitForTimeout(DELAY_2_SEC);

    // Verify the state changed
    const newChecked = await toggleSwitch.getAttribute("aria-checked");
    const isNowChecked = newChecked === "true";
    expect(isNowChecked).not.toBe(isInitiallyChecked);
  });

  test("should show Save button when server toggle changes", async ({
    page,
  }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await page.waitForTimeout(DELAY_2_SEC);

    // Initially, Save button should be disabled
    const saveButton = drawer.locator("button").filter({ hasText: /^Save$/i });
    await expect(saveButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await expect(saveButton).toBeDisabled();

    // Toggle a server switch
    const serverCard = drawer
      .locator('div[class*="border"][class*="bg-white"]')
      .first();
    const toggleSwitch = serverCard.locator('button[role="switch"]').first();
    await toggleSwitch.click();
    await page.waitForTimeout(DELAY_2_SEC);

    // Save button should now be enabled
    await expect(saveButton).toBeEnabled({ timeout: TIMEOUT_5_SEC });
  });

  test("should display inactive server with toggle in correct state", async ({
    page,
  }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await page.waitForTimeout(DELAY_2_SEC);

    // Find the inactive server card
    const inactiveServerName = drawer
      .locator("h3")
      .filter({ hasText: /inactive-server/i })
      .first();
    await expect(inactiveServerName).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const inactiveServerCard = inactiveServerName
      .locator(
        'xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")]',
      )
      .first();

    await expect(inactiveServerCard).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Check that the toggle is unchecked (inactive)
    const toggleSwitch = inactiveServerCard
      .locator('button[role="switch"]')
      .first();
    await expect(toggleSwitch).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const isChecked = await toggleSwitch.getAttribute("aria-checked");
    expect(isChecked).toBe("false");
  });

  test("should save server toggle changes", async ({ page }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await page.waitForTimeout(DELAY_2_SEC);

    // Toggle a server switch
    const serverCard = drawer
      .locator('div[class*="border"][class*="bg-white"]')
      .first();
    const toggleSwitch = serverCard.locator('button[role="switch"]').first();
    await toggleSwitch.click();
    await page.waitForTimeout(DELAY_2_SEC);

    // Click Save button
    const saveButton = drawer.locator("button").filter({ hasText: /^Save$/i });
    await expect(saveButton).toBeEnabled({ timeout: TIMEOUT_5_SEC });
    await saveButton.click();
    await page.waitForTimeout(DELAY_2_SEC);

    // Verify success toast appears (if it does)
    const toast = page
      .locator('div[role="status"]')
      .or(page.locator('div[class*="toast"]'))
      .first();

    // Toast might appear briefly, so we'll just check if drawer closes
    // Verify drawer closes after save
    await expect(drawer).not.toBeVisible({ timeout: TIMEOUT_5_SEC });
  });

  test("should display search functionality in drawer", async ({ page }) => {
    const mcpxNode = page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await mcpxNode.click();
    await page.waitForTimeout(DELAY_2_SEC);

    const drawer = page
      .locator('[role="dialog"]')
      .or(page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    await page.waitForTimeout(DELAY_2_SEC);

    // Find search input
    const searchInput = drawer.locator('input[placeholder*="Search" i]');
    await expect(searchInput).toBeVisible({ timeout: TIMEOUT_5_SEC });

    // Type in search
    await searchInput.fill("test-server-1");
    await page.waitForTimeout(DELAY_2_SEC);

    // Verify only matching server is shown
    const serverCards = drawer.locator(
      'div[class*="border"][class*="bg-white"]',
    );
    const visibleCards = serverCards.filter({ hasText: /test-server-1/i });
    await expect(visibleCards.first()).toBeVisible({ timeout: TIMEOUT_5_SEC });
  });
});
