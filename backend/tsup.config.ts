import { defineConfig } from "tsup";
export default defineConfig({ noExternal: ["@mazate/contracts"], clean: true });
