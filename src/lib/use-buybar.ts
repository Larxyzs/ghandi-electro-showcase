import { useEffect, useState } from "react";

/** True while the product page's sticky phone buy bar is showing. */
export function useBuyBarLift() {
  const [lift, setLift] = useState(false);
  useEffect(() => {
    const sync = () => setLift(document.body.dataset.buybar === "1");
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-buybar"] });
    return () => obs.disconnect();
  }, []);
  return lift;
}
