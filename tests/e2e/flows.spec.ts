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
    page.getByRole("heading", { name: "Consulta de beneficiarios" }),
  ).toBeVisible();
}
test("two points query the same DPI and only one is authorized when both confirm", async ({
  browser,
}) => {
  const a = await browser.newPage();
  const b = await browser.newPage();
  await Promise.all([login(a, ids.a), login(b, ids.b)]);
  for (const page of [a, b]) {
    await page.getByLabel("DPI", { exact: true }).fill("9000000000004");
    await page.getByRole("button", { name: "Consultar DPI" }).click();
    await expect(
      page.getByText("Disponible para entrega", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Registrar entrega", exact: true })
      .click();
    await page
      .getByLabel("Verifiqué el DPI y el nombre de la persona.")
      .check();
  }
  await Promise.all([
    a.getByRole("button", { name: "Confirmar y registrar" }).click(),
    b.getByRole("button", { name: "Confirmar y registrar" }).click(),
  ]);
  await expect
    .poll(async () =>
      [
        await a.getByText("Entrega registrada", { exact: true }).count(),
        await b.getByText("Entrega registrada", { exact: true }).count(),
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
test("admin imports an unknown column arrangement, assigns a point and activates the new campaign", async ({
  page,
}) => {
  await login(page, ids.admin);
  await page.getByRole("link", { name: "Jornadas", exact: true }).click();
  await page.getByRole("button", { name: "Nueva jornada" }).click();
  await page
    .getByLabel("Nombre de la jornada")
    .fill("Importación visual de prueba");
  await page.getByLabel("Beneficio o porción").fill("Porción de prueba");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar" })
    .click();
  const card = page
    .locator(".campaign-card")
    .filter({ hasText: "Importación visual de prueba" });
  await card.getByRole("button", { name: "Seleccionar…", exact: true }).click();
  await page.getByLabel("Persona del equipo").selectOption(ids.admin);
  await page
    .getByRole("combobox", { name: "Punto de entrega", exact: true })
    .selectOption(ids.pointA);
  await page.getByRole("button", { name: "Asignar personal" }).click();
  await expect(
    page.locator("tbody").getByText("Administración de prueba"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Importar padrón" }).click();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hoja desconocida");
  sheet.addRow(["Zona", "Apellido", "CUI", "Nombre"]);
  sheet.addRow(["Centro", "Pérez", "0000000000999", "María José"]);
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
  await page.getByRole("button", { name: "Revisar importación" }).click();
  await expect(
    page.getByText("María José Pérez", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importar 1 personas" }).click();
  await expect(
    page.getByRole("heading", { name: "Padrón importado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Jornadas", exact: true }).click();
  const fresh = page
    .locator(".campaign-card")
    .filter({ hasText: "Importación visual de prueba" });
  await fresh.getByRole("button", { name: "Activar jornada" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar" })
    .click();
  await expect(fresh.getByText("Activa", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Atención", exact: true }).click();
  await page.getByLabel("DPI", { exact: true }).fill("0000000000999");
  await page.getByRole("button", { name: "Consultar DPI" }).click();
  await expect(
    page.getByRole("heading", { name: "María José Pérez" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/consulta-desktop.png",
    fullPage: true,
  });
});
test("mobile layout, report export, unknown DPI and network state", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, ids.admin);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("DPI", { exact: true }).fill("1111111111111");
  await page.getByRole("button", { name: "Consultar DPI" }).click();
  await expect(
    page.getByText("No está en el padrón", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Abrir menú").click();
  await page.getByRole("link", { name: "Reportes", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Excel" }).click();
  expect((await downloaded).suggestedFilename()).toBe("entregas.xlsx");
  await page.screenshot({
    path: "test-results/reporte-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Abrir menú").click();
  await page.getByRole("link", { name: "Atención", exact: true }).click();
  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: "Consultar DPI" }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("main")
      .getByRole("status")
      .getByText("Sin conexión. No se pueden confirmar entregas."),
  ).toBeVisible();
  await context.setOffline(false);
});
