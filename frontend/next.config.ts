import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagen de Docker mínima (ver frontend/Dockerfile): solo lo necesario para correr.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
