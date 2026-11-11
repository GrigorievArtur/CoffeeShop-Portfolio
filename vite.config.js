import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/CoffeeShop-Portfolio/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: "index.html",
        order: "order.html",
      },
    },
  },
});
