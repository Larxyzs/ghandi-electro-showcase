import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  beforeLoad: () => {
    throw redirect({ to: "/besoin-aide/nous-contacter", statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "Nous contacter | Ghandi Home Electro" },
      { name: "description", content: "Page déplacée vers Nous contacter." },
      { property: "og:title", content: "Nous contacter | Ghandi Home Electro" },
      { property: "og:description", content: "Page déplacée vers Nous contacter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
