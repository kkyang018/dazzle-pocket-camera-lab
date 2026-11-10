import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    expect(router.matchRoutes("/").at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("has a camera display page after choosing a photo", () => {
    expect(router.matchRoutes("/cameras").at(-1)?.routeId).toBe("/cameras");
  });
  it("has darkroom and result pages", () => {
    expect(router.matchRoutes("/darkroom").at(-1)?.routeId).toBe("/darkroom");
    expect(router.matchRoutes("/result").at(-1)?.routeId).toBe("/result");
  });
});
