import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin/auth";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { getDashboardV3 } from "@/lib/admin/v3/data";
import { shortDate } from "@/lib/admin/v3/weeks";
import { Topbar } from "@/components/admin/AdminUi";
import HotWeek from "./sections/HotWeek";
import Glance from "./sections/Glance";
import Acquire from "./sections/Acquire";
import Activate from "./sections/Activate";
import Retain from "./sections/Retain";
import Engage from "./sections/Engage";
import Ops from "./sections/Ops";
import Definitions from "./sections/Definitions";
import "./dashboard.css";

export const dynamic = "force-dynamic";

// Page « Stats » du dashboard v3 (revue 2026-09-12 : 417 lignes découpées en
// sections, une par bloc numéroté, sous ./sections/). Chaque section reçoit
// la tranche de `data` qu'elle lit ; assembleV3 reste la seule source.
export default async function DashboardPage() {
  const owner = await getOwnerContext();
  if (!owner || !isAdminOwner(owner)) notFound();

  const { data } = await getDashboardV3();
  const { overview: o, acquisition: acq, activation: act, retention: ret, engage, ops } = data;
  const dataDate = shortDate(o.dataDate);

  return (
    <div className="mijote-dash">
      <Topbar current="stats" dataDate={dataDate} />
      <div className="page">
        <HotWeek o={o} />
        <Glance o={o} />
        <Acquire acq={acq} engage={engage} />
        <Activate act={act} />
        <Retain ret={ret} />
        <Engage engage={engage} />
        <Ops o={o} ops={ops} />
        <Definitions />
      </div>
    </div>
  );
}
