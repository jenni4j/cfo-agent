import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // pdfjs-dist (via pdf-parse) loads its worker through a runtime dynamic
  // import that @vercel/nft can't trace, so the file is omitted from the
  // Lambda ("Cannot find module .../pdf.worker.mjs"). Force-include the build
  // dir for the upload route that extracts PDF text.
  outputFileTracingIncludes: {
    "/api/documents": ["./node_modules/pdfjs-dist/legacy/build/**"],
  },
};

export default nextConfig;
