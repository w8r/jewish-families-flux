import { defineConfig } from "vite";

export default defineConfig({
  // Set the root directory of your project
  root: "./",
  base: "/jewish-families-flux/",

  // Set the output directory for your built files
  build: {
    target: "esnext",
    outDir: "dist",
  },

  // Set up your server options
  server: {
    port: 3000,
  },
});
