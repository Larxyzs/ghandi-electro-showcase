import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/components/ContentPage";
import { EditablePage } from "@/components/EditablePage";

export const Route = createFileRoute("/politique-de-confidentialite")({
  head: () => pageMeta("Politique de confidentialité | Ghandi Home Electro", "Politique de confidentialité du site Ghandi Home Electro."),
  component: () => <EditablePage pageKey="confidentialite" title="Politique de confidentialité" />,
});
