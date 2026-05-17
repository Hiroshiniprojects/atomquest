"use client";

import { useEffect, useState } from "react";
import { apiFetch, clearSession } from "@/lib/api";
import { requireRole } from "@/lib/authGuard";
import { validateGoalForm } from "@/lib/goalValidation";

const emptyGoal = {
  title: "",
  description: "",
  thrustArea: "Technical",
  uomType: "MIN",
  targetValue: "",
  weightage: ""
};

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

function formatMilestoneStatus(milestone) {
  if (milestone.status === "NOT_OPEN") return "Not open yet";
  if (milestone.status === "UPCOMING") return "Upcoming";
  if (milestone.status === "WAITING_FOR_GOAL_APPROVAL") return "Waiting for approved goals";

  return `${milestone.status.replaceAll("_", " ")} (${milestone.completed}/${milestone.total})`;
}

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [goalForm, setGoalForm] = useState(emptyGoal);
  const [checkinGoal, setCheckinGoal] = useState(null);
  const [checkinForm, setCheckinForm] = useState({
    quarter: "",
    actualValue: "",
    status: "ON_TRACK",
    employeeNote: ""
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const user = data?.user;

  async function loadDashboard() {
    const result = await apiFetch("/api/dashboard/employee");
    setData(result);
  }

  useEffect(() => {
  const currentUser = requireRole("EMPLOYEE");
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

  const editableGoals = data?.goals?.filter((goal) =>
    ["DRAFT", "RETURNED"].includes(goal.status)
  ) || [];

  const draftWeightageTotal = editableGoals.reduce(
    (sum, goal) => sum + goal.weightage,
    0
  );

  const totalWeightage = data?.totalWeightage || 0;
  const canCreateGoal = data?.goalSettingOpen && totalWeightage < 100;
  const canSubmitGoals = data?.goalSettingOpen && editableGoals.length > 0 && totalWeightage === 100;

  function logout() {
    clearSession();
    window.location.href = "/";
  }

  async function createGoal(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!data.goalSettingOpen) {
      setError("Goal creation window is not open.");
      return;
    }

    if (totalWeightage >= 100) {
      setError("Goal sheet already totals 100%. Delete or revise returned draft goals before adding more.");
      return;
    }

    const validationError = validateGoalForm(goalForm);

    if (validationError) {
      setError(validationError);
      return;
    }

    const nextTotal = totalWeightage + Number(goalForm.weightage);

    if (nextTotal > 100) {
      setError(`Total goal weightage cannot exceed 100%. Current total is ${totalWeightage}%.`);
      return;
    }

    try {
      await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          ...goalForm,
          targetValue: Number(goalForm.targetValue),
          weightage: Number(goalForm.weightage)
        })
      });

      setGoalForm(emptyGoal);
      setMessage("Goal created successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitGoals() {
    setError("");
    setMessage("");

    if (!data.goalSettingOpen) {
      setError("Goal submission window is not open.");
      return;
    }

    if (editableGoals.length === 0) {
      setError("No draft or returned goals available to submit.");
      return;
    }

   if (totalWeightage !== 100) {
  setError(`Total goal sheet weightage must be 100%. Current total is ${totalWeightage}%.`);
  return;
}

    try {
      const result = await apiFetch("/api/goals/submit", {
        method: "POST"
      });

      setMessage(result.message);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteGoal(goal) {
    setError("");
    setMessage("");

    const ok = window.confirm(`Delete draft goal "${goal.title}"?`);
    if (!ok) return;

    try {
      await apiFetch(`/api/goals/${goal.id}`, {
        method: "DELETE"
      });

      setMessage("Draft goal deleted.");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  function openCheckin(goal) {
    setError("");
    setMessage("");

    if (!data.checkinOpen || !data.currentQuarter) {
      setError("Check-in window is not open.");
      return;
    }

    setCheckinGoal(goal);
    setCheckinForm({
      quarter: data.currentQuarter,
      actualValue: goal.actualValue ?? "",
      status: "ON_TRACK",
      employeeNote: ""
    });
  }

  async function submitCheckin(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!checkinGoal) return;

    if (!data.checkinOpen || !data.currentQuarter) {
      setError("Check-in window is not open.");
      return;
    }

    if (checkinForm.actualValue === "") {
      setError("Actual achievement is required.");
      return;
    }

    try {
      await apiFetch("/api/checkins", {
        method: "POST",
        body: JSON.stringify({
          goalId: checkinGoal.id,
          quarter: data.currentQuarter,
          actualValue: Number(checkinForm.actualValue),
          status: checkinForm.status,
          employeeNote: checkinForm.employeeNote
        })
      });

      setMessage("Check-in submitted successfully.");
      setCheckinGoal(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) {
    return <main className="min-h-screen bg-[#0f131e] p-8 text-[#ffb4ab]">{error}</main>;
  }

  if (!data) {
    return <main className="min-h-screen bg-[#0f131e] p-8 text-white">Loading employee dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0f131e] text-[#dfe2f2]">
      <header className="border-b border-[#464554]/40 bg-[#1b1f2b] px-8 py-4 flex justify-between">
        <div>
          <h1 className="text-3xl font-bold">AtomQuest</h1>
          <p className="text-sm text-[#c7c4d7]">Employee Performance Workspace</p>
        </div>
        <div className="text-right">
          <p>{user?.name}</p>
          <button onClick={logout} className="text-sm text-[#c0c1ff]">Logout</button>
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

        <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Welcome back, {data.user.name}</h2>
            <p className="mt-2 text-[#c7c4d7]">
              Current cycle: {data.cycle?.name || "Active Performance Cycle"} | Window: {formatWindow(data.currentWindow)}
            </p>
            <p className="mt-2 text-sm text-[#c7c4d7]">
              Total sheet weightage: {totalWeightage}/100%
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="mb-2 text-sm text-[#c7c4d7]">
              Draft/returned weightage: {draftWeightageTotal}/100%
            </p>

            <button
              onClick={submitGoals}
              disabled={!canSubmitGoals}
              className={`rounded-lg px-5 py-3 font-bold ${
                canSubmitGoals
                  ? "bg-[#c0c1ff] text-[#1000a9]"
                  : "bg-[#313441] text-[#908fa0] cursor-not-allowed"
              }`}
            >
              {editableGoals.length === 0 ? "No Draft Goals" : "Submit Goals"}
            </button>

            {editableGoals.length === 0 && (
              <p className="mt-2 max-w-xs text-xs text-[#c7c4d7]">
                Goals already submitted or locked. Edit is available only for draft or returned goals.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Kpi title="Total Goals" value={`${data.totalGoals}/${data.maxGoals}`} />
          <Kpi title="Completion" value={`${data.completionPercentage}%`} />
          <Kpi title="Pending Tasks" value={data.pendingTasks} />
          <Kpi title="Achievement Score" value={`${data.achievementScore}%`} />
        </div>

        <form onSubmit={createGoal} className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold">Create New Goal</h2>
            {!canCreateGoal && (
              <p className="text-sm text-[#c7c4d7]">
                Goal sheet already totals 100% or goal-setting window is closed.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Title" value={goalForm.title} onChange={(value) => setGoalForm({ ...goalForm, title: value })} />
            <Input label="Description" value={goalForm.description} onChange={(value) => setGoalForm({ ...goalForm, description: value })} />
            <Select label="Thrust Area" value={goalForm.thrustArea} onChange={(value) => setGoalForm({ ...goalForm, thrustArea: value })} options={["Technical", "Strategic", "Leadership", "Community", "Analytics", "Customer Impact"]} />
            <Select label="UOM Type" value={goalForm.uomType} onChange={(value) => setGoalForm({ ...goalForm, uomType: value })} options={["MIN", "MAX", "TIMELINE", "ZERO"]} />
            <Input label="Target Value" type="number" value={goalForm.targetValue} onChange={(value) => setGoalForm({ ...goalForm, targetValue: value })} />
            <Input label="Weightage" type="number" value={goalForm.weightage} onChange={(value) => setGoalForm({ ...goalForm, weightage: value })} />
          </div>

          <button
            disabled={!canCreateGoal}
            className={`mt-5 rounded-lg px-5 py-3 font-bold ${
              canCreateGoal
                ? "bg-[#4cd7f6] text-[#003640]"
                : "bg-[#313441] text-[#908fa0] cursor-not-allowed"
            }`}
          >
            Add Goal
          </button>
        </form>

        {checkinGoal && (
          <div className="rounded-xl border border-[#4cd7f6]/40 bg-[#1b1f2b] p-6">
            <h2 className="text-xl font-bold">Submit Check-in</h2>
            <p className="mt-1 text-sm text-[#c7c4d7]">{checkinGoal.title}</p>

            <form onSubmit={submitCheckin} className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input label="Quarter" value={data.currentQuarter || ""} onChange={() => {}} />
              <Input label="Actual Achievement" type="number" value={checkinForm.actualValue} onChange={(value) => setCheckinForm({ ...checkinForm, actualValue: value })} />
              <Select label="Status" value={checkinForm.status} onChange={(value) => setCheckinForm({ ...checkinForm, status: value })} options={["NOT_STARTED", "ON_TRACK", "COMPLETED", "AT_RISK"]} />
              <Input label="Employee Note" value={checkinForm.employeeNote} onChange={(value) => setCheckinForm({ ...checkinForm, employeeNote: value })} />

              <div className="flex gap-3 md:col-span-3">
                <button className="rounded-lg bg-[#4cd7f6] px-5 py-3 font-bold text-[#003640]">
                  Submit Check-in
                </button>
                <button type="button" onClick={() => setCheckinGoal(null)} className="rounded-lg border border-[#464554] px-5 py-3">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <section className="xl:col-span-2 rounded-xl border border-[#464554]/40 bg-[#1b1f2b]">
            <div className="border-b border-[#464554]/30 p-5 flex justify-between">
              <h2 className="text-xl font-bold">Primary Performance Objectives</h2>
              <span className="text-sm text-[#c0c1ff]">View History</span>
            </div>

            <div className="divide-y divide-[#464554]/20">
              {data.goals.length === 0 ? (
                <div className="p-5 text-[#c7c4d7]">No goals yet. Create your first goal above.</div>
              ) : (
                data.goals.map((goal) => (
                  <div key={goal.id} className="grid grid-cols-1 gap-4 p-5 md:grid-cols-6 md:items-center">
                    <div className="md:col-span-2">
                      <p className="font-bold">{goal.title}</p>
                      <p className="text-sm text-[#c7c4d7]">{goal.description}</p>
                    </div>

                    <p className="text-sm text-[#c7c4d7]">{goal.thrustArea}</p>
                    <p>{goal.weightage}%</p>

                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>{goal.progress}%</span>
                      </div>
                      <div className="h-2 rounded bg-[#313441]">
                        <div className="h-2 rounded bg-[#4cd7f6]" style={{ width: `${goal.progress}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Status status={goal.status} />

                      {["DRAFT", "RETURNED"].includes(goal.status) && (
                        <button onClick={() => deleteGoal(goal)} className="rounded border border-[#ffb4ab] px-3 py-1 text-xs text-[#ffb4ab]">
                          Delete
                        </button>
                      )}

                      {goal.status === "LOCKED" && (
                        !data.checkinOpen ? (
                          <span className="rounded border border-[#464554] px-3 py-1 text-xs text-[#c7c4d7]">
                            Check-in not open
                          </span>
                        ) : goal.currentQuarterCheckedIn ? (
                          <span className="rounded border border-[#10b981] px-3 py-1 text-xs text-[#10b981]">
                            Checked-in
                          </span>
                        ) : (
                          <button onClick={() => openCheckin(goal)} className="rounded border border-[#4cd7f6] px-3 py-1 text-xs text-[#4cd7f6]">
                            Check-in
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6">
              <h2 className="text-xl font-bold">Progress Trajectory</h2>
              {data.progressTrajectory.map((metric) => (
                <Metric key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>

            <div className="rounded-xl border border-[#464554]/40 bg-[#1b1f2b] p-6">
              <h2 className="text-xl font-bold mb-5">Quarterly Milestones</h2>
              {data.milestones.map((m) => (
                <div key={m.label} className="mb-4">
                  <p className="font-bold">{m.label}</p>
                  <p className="text-sm text-[#c7c4d7]">{formatMilestoneStatus(m)}</p>
                </div>
              ))}
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

function Status({ status }) {
  return (
    <span className="rounded bg-[#4cd7f6]/10 px-2 py-1 text-xs text-[#4cd7f6]">
      {status}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div className="mt-5">
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded bg-[#313441]">
        <div className="h-2 rounded bg-[#c0c1ff]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[#c7c4d7]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!onChange}
        className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-3 py-2 outline-none"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[#c7c4d7]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-3 py-2 outline-none"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}