import { test, expect } from "@playwright/test";

test("login eye preserves the password, supports keyboard use and never submits the form", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let logins = 0;
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/token")) logins++;
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("admin@example.test");
  const password = page.getByLabel("Contraseña", { exact: true });
  await password.fill("Test-login-password-123");
  await expect(password).toHaveAttribute("type", "password");
  const show = page.getByRole("button", {
    name: "Mostrar contraseña",
    exact: true,
  });
  await expect(show).toHaveAttribute("aria-pressed", "false");
  await show.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Test-login-password-123");
  const hide = page.getByRole("button", {
    name: "Ocultar contraseña",
    exact: true,
  });
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await hide.focus();
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "password");
  expect(logins).toBe(0);
  await page.screenshot({ path: "test-results/login-eye-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(show).toBeVisible();
  await page.screenshot({ path: "test-results/login-eye-mobile.png" });
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();
  expect(logins).toBe(1);
  expect(pageErrors).toEqual([]);
});
