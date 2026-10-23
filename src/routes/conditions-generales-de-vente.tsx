import { createFileRoute } from "@tanstack/react-router";
import { pageMeta } from "@/components/ContentPage";
import { EditablePage } from "@/components/EditablePage";

export const Route = createFileRoute("/conditions-generales-de-vente")({
  head: () => pageMeta("Conditions générales de vente | Ghandi Home Electro", "Conditions générales de vente du site Ghandi Home Electro."),
  component: () => <EditablePage pageKey="cgv" title="Conditions générales de vente" />,
});
