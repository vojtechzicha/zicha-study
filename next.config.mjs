import { execSync } from "node:child_process"

function getCommitSha() {
  const envSha =
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT

  if (envSha) {
    return envSha
  }

  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return "development"
  }
}

function getBuildTime() {
  return process.env.NEXT_PUBLIC_BUILD_TIME ||
    process.env.BUILD_TIME ||
    new Date().toISOString()
}

function formatBuildTime(buildTime) {
  const date = new Date(buildTime)

  if (Number.isNaN(date.getTime())) {
    return buildTime
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(date)
}

const buildTime = getBuildTime()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: getCommitSha(),
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_BUILD_TIME_LABEL: formatBuildTime(buildTime),
  },
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
