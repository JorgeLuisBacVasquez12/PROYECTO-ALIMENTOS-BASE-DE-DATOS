import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { ids } from "../helpers/database";
import { testToken } from "../helpers/tokens";
async function login(page: Page, id: string) {
  await page.route("**/auth/v1/**", async (route) => {
    const user = {
      id,
      aud: "authenticated",
      role: "authenticated",
      email: "prueba@example.test",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    await route.fulfill({
      json: route.request().url().includes("/token")
        ? {
            access_token: testToken(id),
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: "test-refresh",
            user,
          }
        : { user },
    });
  });
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("prueba@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("prueba-solo-en-tests");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", {
      name:
        id === ids.admin ? "Jornadas de entrega" : "Consulta de beneficiarios",
    }),
  ).toBeVisible();
}
async function lookup(page: Page, dpi: string) {
  await page.getByLabel("DPI", { exact: true }).fill(dpi);
  await page
    .getByRole("button", { name: "Consultar DPI", exact: true })
    .click();
}
async function prepareDelivery(page: Page) {
  await page
    .getByRole("button", { name: "Marcar como entregado", exact: true })
    .click();
  await page.getByLabel("Verifiqué el DPI y el nombre de la persona.").check();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("two points confirm the same DPI and only one receives authorization", async ({
  browser,
}) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  await Promise.all([login(a, ids.a), login(b, ids.b)]);
  for (const page of [a, b]) {
    await lookup(page, "9000000000004");
    await expect(
      page.getByText("Todo listo para la entrega", { exact: true }),
    ).toBeVisible();
    await prepareDelivery(page);
  }
  await Promise.all([
    a.getByRole("button", { name: "Confirmar y registrar" }).click(),
    b.getByRole("button", { name: "Confirmar y registrar" }).click(),
  ]);
  await expect
    .poll(async () =>
      [
        await a
          .getByText("Entrega registrada con éxito", { exact: true })
          .count(),
        await b
          .getByText("Entrega registrada con éxito", { exact: true })
          .count(),
      ].reduce((x, y) => x + y),
    )
    .toBe(1);
  await expect
    .poll(async () =>
      [
        await a.getByText("Esta persona ya recibió", { exact: true }).count(),
        await b.getByText("Esta persona ya recibió", { exact: true }).count(),
      ].reduce((x, y) => x + y),
    )
    .toBe(1);
  await a.close();
  await b.close();
});

test("admin imports flexible columns, assigns two employees, verifies delivery, queries and individual closure", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1024 });
  await login(page, ids.admin);
  await page
    .getByRole("button", { name: "Nueva jornada", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Nombre de la jornada")
    .fill("Entrega de pollo · Octubre");
  await dialog.getByLabel("Alimento o beneficio").fill("Pollo");
  await dialog
    .getByRole("button", { name: "Crear jornada", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Asignar empleados", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Crear punto de entrega", exact: true })
    .click();
  const pointDialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", {
      name: "Nuevo punto de entrega",
      exact: true,
    }),
  });
  await pointDialog
    .getByLabel("Nombre del punto")
    .fill("Salón comunal · Sector Norte");
  await pointDialog
    .getByRole("button", { name: "Crear punto", exact: true })
    .click();
  await expect(pointDialog).not.toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Punto de entrega", exact: true }),
  ).not.toHaveValue("");
  await dialog.getByRole("checkbox", { name: /Operadora A de prueba/ }).check();
  await dialog.getByRole("checkbox", { name: /Operador B de prueba/ }).check();
  await dialog
    .getByRole("button", { name: "Asignar 2 empleados", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Habilitar jornada", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Cargar Excel", exact: true }).click();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hoja desconocida");
  sheet.addRow(["Zona", "Apellido", "CUI", "Nombre", "Años"]);
  sheet.addRow(["Norte", "Pérez", "0000000000999", "María José", 64]);
  sheet.addRow(["Centro", "López", "0000000000998", "Juan", 28]);
  await page.locator("input[type=file]").setInputFiles({
    name: "prueba.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await page
    .getByRole("combobox", { name: "Columna del DPI", exact: true })
    .selectOption("2");
  await page.getByLabel("4. Nombre", { exact: true }).check();
  await page.getByLabel("2. Apellido", { exact: true }).check();
  await page.getByLabel("Columna de sector (opcional)").selectOption("0");
  await page.getByLabel("Columna de edad (opcional)").selectOption("4");
  await page.getByRole("button", { name: "Revisar importación" }).click();
  await expect(
    page.getByText("María José Pérez", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importar 2 personas" }).click();
  await expect(
    page.getByRole("heading", { name: "Padrón importado" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Volver a la jornada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Habilitar jornada", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Habilitar jornada", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const card = page.getByRole("button", {
    name: "Ver jornada Entrega de pollo · Octubre",
    exact: true,
  });
  await expect(card.getByText("En curso", { exact: true })).toBeVisible();
  // A second benefit reuses the roster, without carrying over any delivery.
  await page
    .getByRole("button", { name: "Nueva jornada", exact: true })
    .click();
  await dialog
    .getByLabel("Nombre de la jornada")
    .fill("Entrega de chocolate · Octubre");
  await dialog.getByLabel("Alimento o beneficio").fill("Chocolate");
  await dialog
    .getByLabel("Padrón de beneficiarios")
    .selectOption({ label: "Reutilizar padrón: Entrega de pollo · Octubre" });
  await dialog
    .getByRole("button", { name: "Crear jornada", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await card.click();
  await noOverflow(page);
  await page.screenshot({
    path: "test-results/jornadas-desktop.png",
    fullPage: true,
  });
  const operator = await browser.newPage();
  await login(operator, ids.a);
  await expect(
    operator.getByRole("link", { name: "Empleados", exact: true }),
  ).toHaveCount(0);
  await operator
    .getByRole("combobox", { name: "Jornada", exact: true })
    .selectOption({ label: "Entrega de pollo · Octubre" });
  await lookup(operator, "0000000000999");
  await expect(
    operator.getByRole("heading", { name: "María José Pérez" }),
  ).toBeVisible();
  await prepareDelivery(operator);
  await operator.screenshot({ path: "test-results/confirmacion-desktop.png" });
  await operator.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(
    operator.getByText("Entrega registrada con éxito", { exact: true }),
  ).toBeVisible();
  await operator
    .getByRole("button", { name: "Cerrar jornada", exact: true })
    .click();
  await operator
    .getByRole("dialog")
    .getByRole("button", { name: "Finalizar mi jornada", exact: true })
    .click();
  await expect(
    operator.getByRole("heading", { name: "Tu jornada ha finalizado" }),
  ).toBeVisible();
  await expect(operator.getByLabel("DPI", { exact: true })).toHaveCount(0);
  await page
    .getByRole("link", { name: "Consultas e historial", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Sector", exact: true })
    .selectOption("Norte");
  await page
    .getByRole("button", { name: "Edad, empleado y fechas", exact: true })
    .click();
  await page.getByLabel("Edad desde").fill("60");
  await page.getByLabel("Edad hasta").fill("70");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "María José Pérez" }),
  ).toContainText("64 años");
  await expect(
    page.getByRole("row").filter({ hasText: "Juan López" }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Excel" }).click();
  expect((await download).suggestedFilename()).toBe("entregas.xlsx");
  await page.screenshot({
    path: "test-results/consultas-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Entrega", exact: true })
    .selectOption("pending");
  await page.getByRole("button", { name: "Consultar", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Juan López" }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "María José Pérez" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Historial de movimientos" }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Entrega registrada" })
      .filter({ hasText: "María José Pérez" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Turno cerrado" })
      .filter({ hasText: "Operadora A de prueba" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/historial-desktop.png",
    fullPage: true,
  });
  const other = await browser.newPage();
  await login(other, ids.b);
  await other
    .getByRole("combobox", { name: "Jornada", exact: true })
    .selectOption({ label: "Entrega de pollo · Octubre" });
  await lookup(other, "0000000000999");
  await expect(
    other.getByText("Esta persona ya recibió", { exact: true }),
  ).toBeVisible();
  await other.setViewportSize({ width: 390, height: 844 });
  await lookup(other, "1111111111111");
  await expect(
    other.getByText("No encontramos este DPI", { exact: true }),
  ).toBeVisible();
  await noOverflow(other);
  await other.screenshot({
    path: "test-results/registro-mobile.png",
    fullPage: true,
  });
  await other.context().setOffline(true);
  await expect(
    other.getByRole("button", { name: "Consultar DPI" }),
  ).toBeDisabled();
  await other.context().setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await page.screenshot({
    path: "test-results/historial-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await operator.close();
  await other.close();
});
