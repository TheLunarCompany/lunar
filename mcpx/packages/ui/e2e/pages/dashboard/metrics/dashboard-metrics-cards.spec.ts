import { test, expect, type Page } from "@playwright/test";
import {
  mockSystemStates,
  createSystemState,
  setupMockedSystemState,
} from "../../../helpers";
import {
  DELAY_2_SEC,
  TIMEOUT_5_SEC,
  DELAY_30_SEC,
} from "../../../constants/delays";

const getMetricCard = (page: Page, label: string) =>
  page
    .locator('[data-slot="metric-card"]')
    .filter({ hasText: new RegExp(label, "i") })
    .first();

const getMetricValue = (page: Page, label: string) =>
  getMetricCard(page, label).locator('[data-slot="metric-card-value"]');

test.describe("Dashboard Metrics Cards", () => {
  test("should display all metrics cards in zero state", async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricCard(page, "Connected MCP servers")).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });
    await expect(getMetricCard(page, "Active Agents")).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });
    await expect(getMetricCard(page, "Total Requests")).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });
    await expect(getMetricCard(page, "Last Activity")).toBeVisible({
      timeout: TIMEOUT_5_SEC,
    });
  });

  test("should show zero values in zero state", async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.zero);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Connected MCP servers")).toHaveText(
      "0",
      { timeout: TIMEOUT_5_SEC },
    );
    await expect(getMetricValue(page, "Active Agents")).toHaveText("0", {
      timeout: TIMEOUT_5_SEC,
    });
    await expect(getMetricValue(page, "Total Requests")).toHaveText("0", {
      timeout: TIMEOUT_5_SEC,
    });
    await expect(getMetricValue(page, "Last Activity")).toHaveText("N/A", {
      timeout: TIMEOUT_5_SEC,
    });
  });

  test("should show correct server count with one server", async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneServer);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Connected MCP servers")).toHaveText(
      "1",
      { timeout: TIMEOUT_5_SEC },
    );
  });

  test("should show correct server count with multiple servers", async ({
    page,
  }) => {
    await setupMockedSystemState(page, mockSystemStates.multipleServers);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Connected MCP servers")).toHaveText(
      "3",
      { timeout: TIMEOUT_5_SEC },
    );
  });

  test("should show correct agent count with one agent", async ({ page }) => {
    await setupMockedSystemState(page, mockSystemStates.oneAgent);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Active Agents")).toHaveText("0", {
      timeout: TIMEOUT_5_SEC,
    });
  });

  test("should show correct agent count with active agents", async ({
    page,
  }) => {
    const stateWithActiveAgents = createSystemState({
      agentCount: 2,
      agentConfig: { isActive: true },
    });

    await setupMockedSystemState(page, stateWithActiveAgents);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Active Agents")).toHaveText("2", {
      timeout: TIMEOUT_5_SEC,
    });
  });

  test("should show correct values with servers and agents", async ({
    page,
  }) => {
    await setupMockedSystemState(
      page,
      mockSystemStates.multipleServersMultipleAgents,
    );
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Connected MCP servers")).toHaveText(
      "3",
      { timeout: TIMEOUT_5_SEC },
    );
    await expect(getMetricValue(page, "Active Agents")).toHaveText("0", {
      timeout: TIMEOUT_5_SEC,
    });
  });

  test("should show total requests from system usage", async ({ page }) => {
    const stateWithUsage = createSystemState({
      serverCount: 2,
      serverConfig: { isActive: true },
    });

    stateWithUsage.usage = {
      callCount: 150,
      lastCalledAt: new Date(),
    };

    await setupMockedSystemState(page, stateWithUsage);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Total Requests")).toHaveText("150", {
      timeout: TIMEOUT_5_SEC,
    });
  });

  test("should show last activity timestamp when available", async ({
    page,
  }) => {
    const stateWithActivity = createSystemState({
      serverCount: 1,
      serverConfig: { isActive: true },
    });

    stateWithActivity.usage = {
      callCount: 50,
      lastCalledAt: new Date(),
    };

    await setupMockedSystemState(page, stateWithActivity);
    await page.waitForTimeout(DELAY_2_SEC);

    const valueText = await getMetricValue(page, "Last Activity").textContent();
    expect(valueText).not.toBe("N/A");
    expect(valueText?.length).toBeGreaterThan(0);
  });

  test("should align card values with actual server and agent counts", async ({
    page,
  }) => {
    const customState = createSystemState({
      serverCount: 5,
      agentCount: 3,
      serverConfig: { isActive: true },
      agentConfig: { isActive: true },
    });

    await setupMockedSystemState(page, customState);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Connected MCP servers")).toHaveText(
      "5",
      { timeout: TIMEOUT_5_SEC },
    );
    await expect(getMetricValue(page, "Active Agents")).toHaveText("3", {
      timeout: TIMEOUT_5_SEC,
    });

    expect(
      await page.locator('[data-id^="server-"]').count(),
    ).toBeGreaterThanOrEqual(5);
    expect(
      await page.locator('[data-id^="agent-"]').count(),
    ).toBeGreaterThanOrEqual(3);
  });

  test("should show correct counts for different server states", async ({
    page,
  }) => {
    await setupMockedSystemState(page, mockSystemStates.mixedServerStates());
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Connected MCP servers")).toHaveText(
      "1",
      { timeout: TIMEOUT_5_SEC },
    );
  });

  test("should show correct active agents count (only active ones)", async ({
    page,
  }) => {
    const stateWithMixedAgents = createSystemState({ agentCount: 3 });

    if (stateWithMixedAgents.connectedClientClusters.length >= 2) {
      const recentDate = new Date(Date.now() - DELAY_30_SEC);
      stateWithMixedAgents.connectedClientClusters[0].usage.lastCalledAt =
        recentDate;
      stateWithMixedAgents.connectedClientClusters[1].usage.lastCalledAt =
        recentDate;
    }

    await setupMockedSystemState(page, stateWithMixedAgents);
    await page.waitForTimeout(DELAY_2_SEC);

    await expect(getMetricValue(page, "Active Agents")).toHaveText("2", {
      timeout: TIMEOUT_5_SEC,
    });
  });
});
