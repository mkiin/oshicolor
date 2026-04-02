// routeTree.gen.ts が ./router.tsx を相対パスで参照するため、
// src 直下に re-export ラッパーを残す。実体は core/router.tsx。
export { getRouter } from "@/core/router";
