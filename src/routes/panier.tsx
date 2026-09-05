import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Minus, PackageSearch, Phone, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { useCart } from "@/lib/cart";
import { isValidMaPhone } from "@/lib/orders-types";
import { placeOrder } from "@/lib/orders.functions";
import { formatMAD } from "@/lib/company";
import { useI18n } from "@/lib/i18n";
import { useDynamicText } from "@/lib/dynamic-text";

export const Route = createFileRoute("/panier")({
  head: () => ({
    meta: [
      { title: "Panier | Ghandi Home Electro" },
      {
        name: "description",
        content: "Finalisez votre commande d'électroménager chez Ghandi Home Electro à Casablanca.",
      },
      { property: "og:title", content: "Panier | Ghandi Home Electro" },
      {
        property: "og:description",
        content: "Passez votre commande, nous vous rappelons rapidement.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PanierPage,
});

type FormState = {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  note: string;
};

const EMPTY_FORM: FormState = { full_name: "", phone: "", address: "", city: "", note: "" };

function PanierPage() {
  const { items, setQty, remove, total, clear } = useCart();
  const { t } = useI18n();
  const tr = useDynamicText();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.full_name.trim().length < 2) next.full_name = t("checkout.errName");
    if (!isValidMaPhone(form.phone)) {
      next.phone = t("checkout.errPhone");
    }
    if (form.address.trim().length < 3) next.address = t("checkout.errAddress");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (items.length === 0) {
      setServerError(t("cart.empty"));
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await placeOrder({
        data: {
          full_name: form.full_name,
          phone: form.phone,
          address: form.address,
          city: form.city,
          note: form.note,
          items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        },
      });
      setReference(result.reference);
      clear();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("INVALID_PHONE")) {
        setErrors((prev) => ({ ...prev, phone: t("checkout.errPhone") }));
      } else if (message.includes("EMPTY_CART")) {
        setServerError(t("cart.empty"));
      } else {
        setServerError(t("checkout.errGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <SiteLayout>
        <section className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{t("cart.sent")}</h1>
          <p className="mt-3 text-foreground/70">
            {t("cart.reference")}{" "}
            <span className="font-semibold text-brand">{reference}</span>.
          </p>
          <p className="mt-2 text-foreground/70">
            {t("cart.callback")}
          </p>
          <Link
            to="/produits"
            className="mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03]"
            style={{ background: "var(--gradient-brand)" }}
          >
            {t("cart.continue")}
          </Link>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <ShoppingCart className="h-6 w-6 text-brand" /> {t("cart.mine")}
        </h1>

        {items.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-12 text-center">
            <PackageSearch className="h-10 w-10 text-brand/40" />
            <p className="text-foreground/70">{t("cart.empty")}</p>
            <Link to="/produits" className="font-semibold text-brand hover:underline">
              {t("cart.discover")}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li
                  key={item.product_id}
                  className="flex gap-4 rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-brand-soft/50">
                    {item.image_url ? (
                      <img src={item.image_url} alt={tr(item.name)} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-brand/40">
                        <PackageSearch className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{tr(item.name)}</p>
                        {item.brand && (
                          <p className="text-xs font-semibold tracking-wide text-brand uppercase">
                            {item.brand}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(item.product_id)}
                        aria-label={t("cart.remove")}
                        className="shrink-0 text-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 rounded-full border border-border px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => setQty(item.product_id, item.qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/70 hover:bg-brand-soft"
                          aria-label={t("cart.dec")}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(item.product_id, item.qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/70 hover:bg-brand-soft"
                          aria-label={t("cart.inc")}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="font-bold text-brand">
                        {formatMAD((item.price * item.qty))}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>{t("cart.total")}</span>
                  <span className="text-brand">{formatMAD(total)}</span>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <h2 className="text-lg font-semibold">{t("checkout.details")}</h2>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    {t("checkout.name")}
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                    placeholder={t("checkout.namePlaceholder")}
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-xs text-destructive">{errors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    {t("checkout.phone")}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                    placeholder="06 12 34 56 78"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    {t("checkout.address")}
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                    placeholder={t("checkout.addressPlaceholder")}
                  />
                  {errors.address && (
                    <p className="mt-1 text-xs text-destructive">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">{t("checkout.city")}</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                    placeholder="Casablanca"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                    {t("checkout.note")}
                  </label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40"
                    placeholder={t("checkout.notePlaceholder")}
                  />
                </div>

                {serverError && <p className="text-sm text-destructive">{serverError}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {submitting ? t("checkout.submitting") : t("checkout.submit")}
                </button>

                <p className="flex items-center gap-1.5 text-xs text-foreground/50">
                  <Phone className="h-3.5 w-3.5" /> Nous vous appellerons pour confirmer votre commande.
                </p>
              </form>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
