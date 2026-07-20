/** @type {import('next').NextConfig} */

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isGitHubPages ? "/prompt-forge" : "";

const nextConfig = {
  output: "export",
  trailingSlash: true,

  images: {
    unoptimized: true,
  },

  ...(basePath && {
    basePath,
  }),
};

export default nextConfig;
