import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "./admin_.import";

export const Route = createFileRoute("/admin_/import_/inbox/$batchId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lot de l'extension | Ghandi Home Electro" },
      { name: "description", content: "Produits reçus depuis l'extension Chrome." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Lot de l'extension | Ghandi Home Electro" },
      { property: "og:description", content: "Espace privé d'import." },
    ],
  }),
  component: InboxBatchPage,
});

function InboxBatchPage() {
  const { batchId } = Route.useParams();
  return <ImportPage key={batchId} inboxId={batchId} />;
}
