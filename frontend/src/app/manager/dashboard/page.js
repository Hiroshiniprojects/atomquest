"use client";

import { useEffect, useState } from "react";
import { apiFetch, clearSession } from "@/lib/api";
import { requireRole } from "@/lib/authGuard";

function formatWindow(windowName) {
  const labels = {
    GOAL_SETTING: "Goal Setting",
    Q1_CHECKIN: "Q1 Check-in",
    Q2_CHECKIN: "Q2 Check-in",
    Q3_CHECKIN: "Q3 Check-in",
    Q4_CHECKIN: "Q4 / Annual Check-in",
    CYCLE_CLOSED: "Cycle Closed"
  };

  return labels[windowName] || "Goal Setting";
}

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const user = data?.user;

  async function loadDashboard() {
    const result = await apiFetch("/api/dashboard/manager");
    setData(result);
  }

 useEffect(() => {
  const currentUser = requireRole("MANAGER");
  if (!currentUser) return;

  async function init() {
    try {
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  init();
}, []);

  function logout() {
    clearSession();
    window.location.href = "/";
  }

  if (error && !data) {
    return <main className="min-h-screen bg-[#0f131e] p-8 text-[#ffb4ab]">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-[#0f131e] p-8 text-white">Loading manager dashboard...</main>;
  }

  const approvalQueue = data.approvalQueue || [];
  const teamProgress = data.teamProgress || [];

  return (
    <main className="min-h-screen bg-[#0f131e] text-[#dfe2f2]">
      <header className="border-b border-[#464554]/40 bg-[#1b1f2b] px-8 py-4 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">AtomQuest</h1>
          <p className="text-sm text-[#c7c4d7]">
            Manager Control Center | Window: {formatWindow(data.currentWindow)}
          </p>
        </div>

        <div className="text-right">
          <p>{user?.name}</p>
          <button onClick={logout} className="text-sm text-[#c0c1ff]">
            Logout
          </button>
        </div>
      </header>

      <section className="p-8 space-y-8">
        {(error || message) && (
          <div className={`rounded-xl border p-4 ${
            error
              ? "border-[#ffb4ab]/50 bg-[#93000a]/20 text-[#ffb4ab]"
              : "border-[#4cd7f6]/50 bg-[#03b5d3]/10 text-[#4cd7f6]"
          }`}>
            {error || message}
          </div>
        )}

        <div className={`rounded-xl border p-5 flex justify-between ${
          data.pendingApprovals > 0
            ? "border-[#ffb4ab]/40 bg-[#93000a]/20"
            : "border-[#4cd7f6]/40 bg-[#03b5d3]/10"
        }`}>
          <p className="font-bold">
            {data.pendingApprovals > 0
              ? `${data.pendingApprovals} pending approvals require your review.`
              : "No pending approvals right now."}
          </p>
          <span>{data.pendingApprovals > 0 ? "ACT NOW" : "CLEAR"}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Kpi title="Pending Approvals" value={data.pendingApprovals} />
          <Kpi title="Team Members" value={data.teamMembers} />
          <Kpi title="Avg Team Progress" value={`${data.avgTeamProgress}%`} />
          <Kpi title="Check-ins Completed" value={data.checkinsCompleted} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <section>
            <h2 className="mb-4 text-xl font-bold">Pending Approval Queue</h2>

            <div className="space-y-4">
              {approvalQueue.length === 0 ? (
                <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-5 text-[#c7c4d7]">
                  No submitted goals waiting for approval.
                </div>
              ) : (
                approvalQueue.map((goal) => (
                  <ApprovalCard
                    key={goal.id}
                    goal={goal}
                    onChanged={loadDashboard}
                    setError={setError}
                    setMessage={setMessage}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-bold">Team Progress</h2>

            <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6 space-y-5">
              {teamProgress.length === 0 ? (
                <p className="text-[#c7c4d7]">No team members assigned.</p>
              ) : (
                teamProgress.map((member) => (
                  <div key={member.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{member.name}</span>
                      <span>{member.progress}%</span>
                    </div>

                    <div className="h-3 rounded bg-[#313441]">
                      <div
                        className="h-3 rounded bg-[#4cd7f6]"
                        style={{ width: `${member.progress}%` }}
                      />
                    </div>

                    <p className="mt-1 text-xs text-[#c7c4d7]">
                      Goals: {member.goalCount}
                    </p>
                  </div>
                ))
              )}
            </div>
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

function ApprovalCard({ goal, onChanged, setError, setMessage }) {
  const [targetValue, setTargetValue] = useState(String(goal.targetValue));
  const [weightage, setWeightage] = useState(String(goal.weightage));
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function approve() {
    setError("");
    setMessage("");

    const numericTarget = Number(targetValue);
    const numericWeightage = Number(weightage);

    if (!Number.isFinite(numericTarget) || numericTarget < 0) {
      setError("Target must be a valid non-negative number.");
      return;
    }

    if (!Number.isInteger(numericWeightage) || numericWeightage < 10 || numericWeightage > 100) {
      setError("Weightage must be a whole number between 10 and 100.");
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch(`/api/goals/${goal.id}/approve`, {
        method: "PUT",
        body: JSON.stringify({
          targetValue: numericTarget,
          weightage: numericWeightage
        })
      });

      setMessage("Goal approved and locked.");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function returnGoal() {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      await apiFetch(`/api/goals/${goal.id}/return`, {
        method: "PUT",
        body: JSON.stringify({
          reason: reason.trim() || "Please revise alignment."
        })
      });

      setMessage("Goal returned to employee.");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-5">
      <p className="font-bold">{goal.employee?.name}</p>
      <p className="text-sm text-[#c7c4d7]">{goal.title}</p>
      <p className="mt-2 text-sm">Progress: {goal.progress}%</p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-[#c7c4d7]">Target</span>
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-3 py-2 outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-[#c7c4d7]">Weightage</span>
          <input
            type="number"
            value={weightage}
            onChange={(e) => setWeightage(e.target.value)}
            className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-3 py-2 outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm text-[#c7c4d7]">Return Reason</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason required only when returning"
          className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-3 py-2 outline-none"
        />
      </label>

      <div className="mt-4 flex gap-3">
        <button
          onClick={approve}
          disabled={isSaving}
          className="flex-1 rounded-lg bg-[#c0c1ff] py-2 font-bold text-[#1000a9] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Approve & Lock"}
        </button>

        <button
          onClick={returnGoal}
          disabled={isSaving}
          className="flex-1 rounded-lg border border-[#464554] py-2 disabled:opacity-50"
        >
          Return
        </button>
      </div>
    </div>
  );
}