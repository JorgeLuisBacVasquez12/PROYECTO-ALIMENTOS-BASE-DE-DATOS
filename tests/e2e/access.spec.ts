import { test, expect, type Page } from "@playwright/test";
import { ids } from "../helpers/database";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test("admin creates an assigned access, resets its password and revokes an open operator session", async ({
  browser,
}) => {
  const admin = await browser.newPage();
  const operator = await browser.newPage();
  const email = "new-operator@example.test";
  const initial = "Test-initial-password-123";
  const reset = "Test-reset-password-456";
  const personal = "Test-personal-password-789";
  await signIn(admin, "admin@example.test", "Test-login-password-123");
  await admin.getByRole("link", { name: "Empleados", exact: true }).click();
  await admin
    .getByRole("button", { name: "Nuevo empleado", exact: true })
    .click();
  const dialog = admin.getByRole("dialog");
  await dialog
    .getByLabel("Nombre", { exact: true })
    .fill("Operadora verificada");
  await dialog.getByLabel("Correo electrónico").fill(email);
  await dialog.getByLabel("Contraseña inicial").fill(initial);
  await dialog.getByLabel("Jornada de trabajo").selectOption(ids.campaign);
  await dialog
    .getByRole("combobox", { name: "Punto de entrega", exact: true })
    .selectOption(ids.pointA);
  await dialog
    .getByRole("button", { name: "Crear empleado", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const row = admin.getByRole("row").filter({ hasText: email });
  await expect(row.getByText("Punto A de prueba")).toBeVisible();
  await admin.screenshot({
    path: "test-results/equipo-desktop.png",
    fullPage: true,
  });

  await signIn(operator, email, initial);
  await expect(
    operator.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();
  await expect(operator.getByRole("link", { name: "Empleados" })).toHaveCount(
    0,
  );
  await operator.goto("/team");
  await expect(
    operator.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();
  await operator.getByLabel("DPI", { exact: true }).fill("9000000000005");
  await operator.getByRole("button", { name: "Consultar DPI" }).click();
  await expect(
    operator.getByRole("heading", { name: "Persona de prueba 5" }),
  ).toBeVisible();
  await operator.getByRole("button", { name: "Cerrar sesión" }).click();

  await row.getByRole("button", { name: "Contraseña", exact: true }).click();
  await dialog.getByLabel("Nueva contraseña").fill(reset);
  await dialog.getByLabel("Repite la contraseña").fill(reset);
  await dialog.getByRole("button", { name: "Restablecer contraseña" }).click();
  await expect(dialog).not.toBeVisible();
  await signIn(operator, email, initial);
  await expect(operator.getByRole("alert")).toContainText(
    "No se pudo iniciar sesión",
  );
  await signIn(operator, email, reset);
  await expect(
    operator.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();
  await operator.goto("/account");
  await operator.getByLabel("Nueva contraseña").fill(personal);
  await operator.getByLabel("Repite la contraseña").fill(personal);
  await operator.getByRole("button", { name: "Guardar" }).click();
  await expect(
    operator.getByText("Contraseña actualizada.", { exact: true }),
  ).toBeVisible();
  await operator.getByRole("button", { name: "Cerrar sesión" }).click();
  await signIn(operator, email, personal);
  await expect(
    operator.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();

  await admin.getByRole("link", { name: "Jornadas", exact: true }).click();
  await admin
    .getByRole("button", { name: "Ver jornada Jornada de prueba", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "Asignar empleados", exact: true })
    .click();
  await dialog
    .getByRole("combobox", { name: "Punto de entrega", exact: true })
    .selectOption(ids.pointB);
  await dialog.getByRole("checkbox", { name: /Operadora verificada/ }).check();
  await dialog
    .getByRole("button", { name: "Asignar 1 empleados", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await admin.getByRole("link", { name: "Empleados", exact: true }).click();
  await expect(row.getByText("Punto B de prueba")).toBeVisible();
  await expect(operator.getByText("Punto B de prueba").first()).toBeVisible({
    timeout: 15000,
  });

  await row.getByRole("button", { name: "Desactivar", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar cambio" }).click();
  await expect(row.getByText("Desactivado", { exact: true })).toBeVisible();
  await expect(
    operator.getByText(
      "No tienes acceso a esta acción. Contacta al administrador.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    operator.getByRole("button", { name: "Consultar DPI" }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: "Activar", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar cambio" }).click();
  await operator.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    operator.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();

  await admin.setViewportSize({ width: 390, height: 844 });
  expect(
    await admin.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await admin
    .getByRole("button", { name: "Nuevo empleado", exact: true })
    .click();
  await expect(dialog.getByLabel("Contraseña inicial")).toHaveValue("");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await admin.screenshot({
    path: "test-results/equipo-mobile.png",
    fullPage: false,
  });
  await admin.close();
  await operator.close();
});
