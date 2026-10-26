import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" para o programa abrir os arquivos direto do disco (file://), sem servidor.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
