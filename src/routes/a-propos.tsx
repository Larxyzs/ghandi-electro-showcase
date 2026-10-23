import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/a-propos")({
  beforeLoad: () => {
    throw redirect({ to: "/qui-sommes-nous", statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "Qui sommes-nous | Ghandi Home Electro" },
      { name: "description", content: "Page déplacée vers Qui sommes-nous." },
      { property: "og:title", content: "Qui sommes-nous | Ghandi Home Electro" },
      { property: "og:description", content: "Page déplacée vers Qui sommes-nous." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
