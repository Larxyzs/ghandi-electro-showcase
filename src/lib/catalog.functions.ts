import { createServerFn } from "@tanstack/react-start";
import { fetchSiteData } from "./catalog.server";

export const getSiteData = createServerFn({ method: "GET" }).handler(async () => {
  return fetchSiteData();
});