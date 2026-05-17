"use client";
import { requireRole } from "@/lib/authGuard";
import { useEffect, useState } from "react";
import { apiFetch, getUser, clearSession } from "@/lib/api";

function buildInsight(data) {
  if (!data.departmentHeatmap.length) {
    return "No departmental goal data is available yet.";
  }

  const ranked = [...data.departmentHeatmap].sort((a, b) => b.q2 - a.q2);
  const best = ranked[0];
  const weakest = ranked[ranked.length - 1];

  if (data.activeEscalations > 0) {
    return `${weakest.department} requires attention based on current completion trends and ${data.activeEscalations} active escalation${data.activeEscalations > 1 ? "s" : ""}.`;
  }

  return `${best.department} is currently leading completion trends, while ${weakest.department} should be monitored for upcoming check-ins.`;
}
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const user = getUser();

  useEffect(() => {
     const allowedUser = requireRole("ADMIN");
     if (!allowedUser) return;
    apiFetch("/api/dashboard/admin")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  function logout() {
    clearSession();
    window.location.href = "/";
  }

  async function downloadReport() {
    const csv = await apiFetch("/api/reports/achievement");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "achievement-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <main className="min-h-screen bg-[#0f131e] p-8 text-[#ffb4ab]">{error}</main>;
  if (!data) return <main className="min-h-screen bg-[#0f131e] p-8 text-white">Loading admin dashboard...</main>;

  return (
    <main className="min-h-screen bg-[#0f131e] text-[#dfe2f2]">
      <header className="border-b border-[#464554]/40 bg-[#1b1f2b] px-8 py-4 flex justify-between">
        <div>
          <h1 className="text-3xl font-bold">AtomQuest</h1>
          <p className="text-sm text-[#c7c4d7]">Organization Performance Analytics</p>
        </div>
        <div className="text-right">
          <p>{user?.name}</p>
          <button onClick={logout} className="text-sm text-[#c0c1ff]">Logout</button>
        </div>
      </header>

      <section className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Kpi title="Total Workforce" value={data.totalWorkforce} />
          <Kpi title="Participation Rate" value={`${data.participationRate}%`} />
          <Kpi title="Approval Rating" value={`${data.approvalRating}%`} />
          <Kpi title="Active Escalations" value={data.activeEscalations} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <section className="xl:col-span-2 rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6">
            <h2 className="mb-5 text-xl font-bold">Departmental Completion Heatmap</h2>
            <div className="space-y-4">
              {data.departmentHeatmap.map((row) => (
                <div key={row.department} className="grid grid-cols-5 gap-3 items-center">
                  <p className="font-bold">{row.department}</p>
                  <Heat value={row.q1} />
                  <Heat value={row.q2} />
                  <Heat value={row.q3} />
                  <Heat value={row.q4} />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#ffb4ab]/30 bg-[#1b1f2b] p-6">
            <h2 className="mb-5 text-xl font-bold">Critical System Alerts</h2>
            <div className="space-y-4">
             {data.criticalAlerts.length === 0 ? (
  <p className="text-sm text-[#c7c4d7]">No active escalations.</p>
) : (
  data.criticalAlerts.map((alert) => (
    <div key={alert.id} className="border-l-4 border-[#ffb4ab] bg-[#93000a]/20 p-4">
      <p className="font-bold text-[#ffb4ab]">{alert.severity}</p>
      <p className="text-sm text-[#c7c4d7]">{alert.reason}</p>
    </div>
  ))
)}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <section className="xl:col-span-2 rounded-xl border border-[#464554]/40 bg-[#1b1f2b]">
            <div className="border-b border-[#464554]/30 p-5 flex justify-between">
              <h2 className="text-xl font-bold">Real-time Audit Trail</h2>
              <button onClick={downloadReport} className="text-[#c0c1ff]">Export CSV</button>
            </div>

            <div className="divide-y divide-[#464554]/20">
              {data.auditTrail.length === 0 ? (
  <div className="p-4 text-sm text-[#c7c4d7]">
    No audit events yet.
  </div>
) : (
  data.auditTrail.map((log) => (
    <div key={log.id} className="grid grid-cols-4 gap-4 p-4 text-sm">
      <p className="text-[#c7c4d7]">{new Date(log.createdAt).toLocaleString()}</p>
      <p className="text-[#4cd7f6]">{log.action}</p>
      <p>{log.entity}</p>
      <p>{log.actor?.name}</p>
    </div>
  ))
)}
            </div>
          </section>

          <section className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6">
  <h2 className="text-xl font-bold">Atom Intelligence</h2>
  <p className="mt-4 text-[#c7c4d7]">
    {buildInsight(data)}
  </p>
</section>
        </div>
      </section>
    </main>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-5">
      <p className="text-sm text-[#c7c4d7]">{title}</p>
      <p className="mt-3 text-4xl font-bold">{value}</p>
    </div>
  );
}

function Heat({ value }) {
  const color =
    value == null ? "bg-[#313441]" :
    value >= 85 ? "bg-[#10b981]" :
    value >= 60 ? "bg-[#f59e0b]" :
    "bg-[#f43f5e]";

  return (
    <div className={`rounded-lg p-4 text-center font-bold text-white ${color}`}>
      {value == null ? "TBD" : `${value}%`}
    </div>
  );
}
