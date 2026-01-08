import { Page, expect } from "@playwright/test";
import { DELAY_2_SEC, TIMEOUT_5_SEC } from "../../../constants/delays";

const SERVER_NAME_MAP: Record<string, string> = {
  Memory: "memory",
  Time: "time",
  Slack: "slack",
  Playwright: "playwright",
  "Sequential Thinking": "sequential-thinking",
  Notion: "Notion",
  Asana: "asana",
  Atlassian: "atlassian",
  LaunchDarkly: "LaunchDarkly",
  PostgreSQL: "postgres",
  Snowflake: "snowflake",
  Redis: "redis",
};

function getServerNameFromLabel(label: string): string {
  return SERVER_NAME_MAP[label] || label.toLowerCase();
}

export class DashboardActions {
  constructor(private page: Page) {}

  async clickAddServerButton(): Promise<void> {
    const addServerButton = this.page
      .locator("button")
      .filter({ hasText: /Add Server/i })
      .first();

    await expect(addServerButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await expect(addServerButton).toBeEnabled();
    await addServerButton.click();

    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async waitForAddServerModal(): Promise<void> {
    const modalTitle = this.page
      .locator("div")
      .filter({ hasText: /^Add Server$/i });
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async selectServerFromCatalog(serverName: string): Promise<void> {
    await this.waitForAddServerModal();

    const labelSpan = this.page
      .locator("span")
      .filter({ hasText: new RegExp(`^${serverName}$`, "i") })
      .first();

    await expect(labelSpan).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const serverCard = labelSpan
      .locator(
        'xpath=ancestor::div[contains(@class, "border") and contains(@class, "rounded-xl")]',
      )
      .first();

    await expect(serverCard).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const plusButton = serverCard
      .locator("button")
      .locator("svg")
      .locator("..")
      .first();

    await expect(plusButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await plusButton.click();

    await this.page.waitForTimeout(DELAY_2_SEC);

    const customTab = this.page
      .locator("button")
      .filter({ hasText: /^Custom$/i });
    const isCustomTabActive = await customTab.getAttribute("data-state");

    if (isCustomTabActive === "active") {
      const addButton = this.page
        .locator("button")
        .filter({ hasText: /^Add$/i })
        .first();

      await expect(addButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
      await expect(addButton).toBeEnabled({ timeout: TIMEOUT_5_SEC });
      await addButton.click();

      await this.page.waitForTimeout(DELAY_2_SEC);
    }
  }

  async verifyServerOnCanvas(serverLabel: string): Promise<void> {
    const serverName = getServerNameFromLabel(serverLabel);
    const serverNode = this.page.locator(`[data-id^="server-${serverName}"]`);
    await this.page.waitForTimeout(DELAY_2_SEC);
    await expect(serverNode).toBeVisible({ timeout: TIMEOUT_5_SEC * 2 });
  }

  async verifyServerCount(expectedCount: number): Promise<void> {
    const serverNodes = this.page.locator('[data-id^="server-"]');
    const count = await serverNodes.count();
    expect(count).toBeGreaterThanOrEqual(expectedCount);
  }

  async closeAddServerModal(): Promise<void> {
    const closeButton = this.page
      .locator("button")
      .filter({ hasText: /Close/i })
      .or(this.page.locator('[aria-label="Close"]'))
      .first();

    const isVisible = await closeButton.isVisible().catch(() => false);
    if (isVisible) {
      await closeButton.click();
      await this.page.waitForTimeout(DELAY_2_SEC);
    }
  }

  async createServerFromCatalog(serverLabel: string): Promise<void> {
    await this.clickAddServerButton();
    await this.selectServerFromCatalog(serverLabel);
    await this.verifyServerOnCanvas(serverLabel);
  }

  async clickServerNode(serverName: string): Promise<void> {
    const serverNode = this.page.locator(`[data-id^="server-${serverName}"]`);
    await expect(serverNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await serverNode.click();
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async waitForServerDetailsDrawer(): Promise<void> {
    const drawer = this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('div[class*="sheet"]'));
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async clickDeleteServerButton(): Promise<void> {
    await this.waitForServerDetailsDrawer();

    const drawer = this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('div[class*="sheet"]'))
      .first();
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const allButtons = drawer.locator("button");
    const buttonCount = await allButtons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const svg = button.locator("svg").first();
      const isVisible = await svg.isVisible().catch(() => false);
      if (isVisible) {
        const svgContent = await svg.innerHTML().catch(() => "");
        if (
          svgContent.includes("M16.875 3.75") ||
          svgContent.includes("M3.75V16.25") ||
          (svgContent.includes("V3.125") && svgContent.includes("V16.25"))
        ) {
          await button.click();
          await this.page.waitForTimeout(DELAY_2_SEC);
          return;
        }
      }
    }

    throw new Error("Delete button not found");
  }

  async confirmDeleteServer(): Promise<void> {
    const confirmButton = this.page
      .locator("button")
      .filter({ hasText: /^Ok$/i })
      .first();

    await expect(confirmButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await confirmButton.click();
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async verifyServerDeleted(serverName: string): Promise<void> {
    const serverNode = this.page.locator(`[data-id^="server-${serverName}"]`);
    await expect(serverNode).not.toBeVisible({ timeout: TIMEOUT_5_SEC * 2 });
  }

  async deleteServer(serverName: string): Promise<void> {
    await this.clickServerNode(serverName);
    await this.clickDeleteServerButton();
    await this.confirmDeleteServer();
    await this.verifyServerDeleted(serverName);
  }

  async clickAddAgentButton(): Promise<void> {
    const addAgentButton = this.page
      .locator("button")
      .filter({ hasText: /Add Agent/i })
      .first();

    await expect(addAgentButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await expect(addAgentButton).toBeEnabled();
    await addAgentButton.click();

    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async waitForAddAgentModal(): Promise<void> {
    const dialog = this.page
      .locator('[role="dialog"]')
      .filter({ hasText: /Add AI Agent/i })
      .first();
    await expect(dialog).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const modalTitle = dialog
      .locator("h2")
      .filter({ hasText: /Add AI Agent/i });
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async verifyAddAgentModalContent(): Promise<void> {
    await this.waitForAddAgentModal();

    const dialog = this.page.locator('[role="dialog"]').first();

    const description = dialog
      .locator("p")
      .filter({
        hasText: /Select your agent type and copy the configuration JSON/i,
      })
      .first();
    await expect(description).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const selectLabel = dialog
      .locator("label")
      .filter({ hasText: /Select Agent Type/i });
    await expect(selectLabel).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const selectTrigger = dialog.locator("button").filter({
      hasText: /Choose an agent type/i,
    });
    await expect(selectTrigger).toBeVisible({ timeout: TIMEOUT_5_SEC });
  }

  async clickMcpxNode(): Promise<void> {
    const mcpxNode = this.page.locator('[data-testid="rf__node-mcpx"]');
    await expect(mcpxNode).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await mcpxNode.click();
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async waitForMcpxDrawer(): Promise<void> {
    const drawer = this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i });
    await expect(drawer).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async closeMcpxDrawer(): Promise<void> {
    await this.waitForMcpxDrawer();

    const drawer = this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i })
      .first();

    // Try to find close button in header
    const headerCloseButton = drawer
      .locator('div[class*="SheetHeader"]')
      .locator("button")
      .first();

    const isVisible = await headerCloseButton.isVisible().catch(() => false);
    if (isVisible) {
      await headerCloseButton.click();
      await this.page.waitForTimeout(DELAY_2_SEC);
      return;
    }

    // Fallback: try any button with SVG
    const closeButton = drawer
      .locator("button")
      .filter({ has: drawer.locator("svg") })
      .first();

    await expect(closeButton).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await closeButton.click();
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async toggleServerInDrawer(serverName: string): Promise<void> {
    await this.waitForMcpxDrawer();

    const drawer = this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i })
      .first();

    await this.page.waitForTimeout(DELAY_2_SEC);

    // Find server name first, then get the card
    const serverNameElement = drawer
      .locator("h3")
      .filter({ hasText: new RegExp(serverName, "i") })
      .first();

    await expect(serverNameElement).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const serverCard = serverNameElement
      .locator(
        'xpath=ancestor::div[contains(@class, "border") and contains(@class, "bg-white")]',
      )
      .first();

    await expect(serverCard).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const toggleSwitch = serverCard.locator('button[role="switch"]').first();
    await expect(toggleSwitch).toBeVisible({ timeout: TIMEOUT_5_SEC });
    await toggleSwitch.click();
    await this.page.waitForTimeout(DELAY_2_SEC);
  }

  async saveMcpxDrawerChanges(): Promise<void> {
    await this.waitForMcpxDrawer();

    const drawer = this.page
      .locator('[role="dialog"]')
      .or(this.page.locator('div[class*="sheet"]'))
      .filter({ hasText: /MCPX/i })
      .first();

    const saveButton = drawer.locator("button").filter({ hasText: /^Save$/i });
    await expect(saveButton).toBeEnabled({ timeout: TIMEOUT_5_SEC });
    await saveButton.click();
    await this.page.waitForTimeout(DELAY_2_SEC);
  }
}
