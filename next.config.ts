import type { NextConfig } from "next";

// When OH_MY_REFCARDZ_CONTENT_ROOT is set (E2E test runs), use a dedicated
// build directory so the test dev server's lock file does not collide with a
// developer's `npm run dev` running on the default content root.
const isTestRun =
  typeof process.env.OH_MY_REFCARDZ_CONTENT_ROOT === "string" &&
  process.env.OH_MY_REFCARDZ_CONTENT_ROOT.length > 0;

const nextConfig: NextConfig = {
  distDir: isTestRun ? ".next-test" : ".next",
};

export default nextConfig;
