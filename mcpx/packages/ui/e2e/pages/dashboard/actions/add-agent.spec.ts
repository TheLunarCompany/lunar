import { test, expect } from "@playwright/test";
import { DashboardActions } from "./dashboard-actions";
import { setupMockedSystemState, mockSystemStates } from "../../../helpers";
import { DELAY_2_SEC, TIMEOUT_5_SEC } from "../../../constants/delays";

test.describe("Dashboard - Add Agent", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    await page.waitForTimeout(DELAY_2_SEC);
  });

  test("should open Add Agent modal when clicking Add Agent button", async ({
    page,
  }) => {
    const actions = new DashboardActions(page);

    await actions.clickAddAgentButton();
    await actions.waitForAddAgentModal();

    const dialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /Add AI Agent/i });
    await expect(dialog).toBeVisible({ timeout: TIMEOUT_5_SEC });

    const modalTitle = dialog
      .locator("h2")
      .filter({ hasText: /Add AI Agent/i });
    await expect(modalTitle).toBeVisible({ timeout: TIMEOUT_5_SEC });
  });

  test("should stay within a short viewport and scroll its content panes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    const actions = new DashboardActions(page);

    await actions.clickAddAgentButton();
    await actions.waitForAddAgentModal();

    const dialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /Add AI Agent/i })
      .first();
    const dialogBox = await dialog.boundingBox();

    expect(dialogBox).not.toBeNull();
    expect(dialogBox?.y).toBeGreaterThanOrEqual(0);
    expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(
      500,
    );

    const agentList = dialog
      .locator("button")
      .filter({ hasText: /^Cursor$/ })
      .first()
      .locator("xpath=../..");
    const activeTabPanel = dialog.locator(
      '[role="tabpanel"][data-state="active"]',
    );

    await expect
      .poll(() =>
        agentList.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        activeTabPanel.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      )
      .toBe(true);
  });

  test("should display Add Agent modal content", async ({ page }) => {
    const actions = new DashboardActions(page);

    await actions.clickAddAgentButton();
    await actions.verifyAddAgentModalContent();
  });

  test("should show agent type selector in modal", async ({ page }) => {
    const actions = new DashboardActions(page);

    await actions.clickAddAgentButton();
    await actions.waitForAddAgentModal();

    const dialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /Add AI Agent/i })
      .first();
    const selectTrigger = dialog.locator("button").filter({
      hasText: /Choose an agent type/i,
    });
    await expect(selectTrigger).toBeVisible({ timeout: TIMEOUT_5_SEC });
  });
});
