import { expect, test } from "@playwright/test";

test("the beta entry leads to a usable sign-in form", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("dronesms.betaWelcome.authAttemptStarted", "true");
  });
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Pilot Login" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("registration and recovery routes render without a configured backend", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Operator Registration" }),
  ).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();

  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();

  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Reset link unavailable" }),
  ).toBeVisible();
});

test("unknown routes recover to the public entry point", async ({ page }) => {
  await page.goto("/route-that-does-not-exist");
  await expect(
    page.getByRole("heading", { name: /welcome to dronesms|pilot login/i }),
  ).toBeVisible();
});
