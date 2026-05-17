const express = require("express");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

function average(numbers) {
  const validNumbers = numbers.filter((number) => Number.isFinite(number));

  if (!validNumbers.length) return 0;

  return Math.round(
    validNumbers.reduce((a, b) => a + b, 0) / validNumbers.length
  );
}

function weightedProgress(goals) {
  if (!goals.length) return 0;

  const score = goals.reduce(
    (sum, goal) => sum + ((goal.progress || 0) * goal.weightage) / 100,
    0
  );

  return Math.round(score);
}

function percent(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

function getCurrentWindow() {
  const overrideWindow = process.env.ACTIVE_WINDOW;

  const windows = {
    GOAL_SETTING: {
      phase: "GOAL_SETTING",
      activeQuarter: null,
      checkinOpen: false,
      goalSettingOpen: true
    },
    Q1_CHECKIN: {
      phase: "Q1_CHECKIN",
      activeQuarter: "Q1",
      checkinOpen: true,
      goalSettingOpen: false
    },
    Q2_CHECKIN: {
      phase: "Q2_CHECKIN",
      activeQuarter: "Q2",
      checkinOpen: true,
      goalSettingOpen: false
    },
    Q3_CHECKIN: {
      phase: "Q3_CHECKIN",
      activeQuarter: "Q3",
      checkinOpen: true,
      goalSettingOpen: false
    },
    Q4_CHECKIN: {
      phase: "Q4_CHECKIN",
      activeQuarter: "Q4",
      checkinOpen: true,
      goalSettingOpen: false
    },
    CYCLE_CLOSED: {
      phase: "CYCLE_CLOSED",
      activeQuarter: null,
      checkinOpen: false,
      goalSettingOpen: false
    }
  };

  if (overrideWindow && windows[overrideWindow]) {
    return windows[overrideWindow];
  }

  const month = new Date().getMonth() + 1;

  if (month === 5 || month === 6) return windows.GOAL_SETTING;
  if (month >= 7 && month <= 9) return windows.Q1_CHECKIN;
  if (month >= 10 && month <= 12) return windows.Q2_CHECKIN;
  if (month === 1 || month === 2) return windows.Q3_CHECKIN;
  if (month === 3 || month === 4) return windows.Q4_CHECKIN;

  return windows.CYCLE_CLOSED;
}

router.get("/employee", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const activeCycle = await prisma.cycle.findFirst({
      where: { active: true }
    });

    const goals = await prisma.goal.findMany({
      where: {
        employeeId: req.user.id,
        ...(activeCycle ? { cycleId: activeCycle.id } : {})
      },
      orderBy: { createdAt: "desc" }
    });

    const checkins = await prisma.checkin.findMany({
      where: {
        employeeId: req.user.id,
        goalId: { in: goals.map((goal) => goal.id) }
      }
    });

    const currentWindow = getCurrentWindow();
    const currentQuarter = currentWindow.activeQuarter;

    const lockedGoals = goals.filter((goal) => goal.status === "LOCKED");

    const submittedOrLockedGoals = goals.filter((goal) =>
      ["SUBMITTED", "LOCKED", "APPROVED"].includes(goal.status)
    );

    const checkedInGoalIds = new Set(
      currentQuarter
        ? checkins
            .filter((checkin) => checkin.quarter === currentQuarter)
            .map((checkin) => checkin.goalId)
        : []
    );

    const totalWeightage = goals.reduce((sum, goal) => sum + goal.weightage, 0);
    const completionPercentage = weightedProgress(goals);

    const goalsWithCheckins = goals.map((goal) => ({
      ...goal,
      currentQuarter,
      checkinOpen: currentWindow.checkinOpen,
      currentQuarterCheckedIn: checkedInGoalIds.has(goal.id)
    }));

    const quarters = ["Q1", "Q2", "Q3", "Q4"];

    const milestones = quarters.map((quarter) => {
      const checkedGoalIdsForQuarter = new Set(
        checkins
          .filter((checkin) => checkin.quarter === quarter)
          .map((checkin) => checkin.goalId)
      );

      const completed = checkedGoalIdsForQuarter.size;
      const total = lockedGoals.length;

      return {
        label: `${quarter} Check-in`,
        status:
          !currentWindow.checkinOpen
            ? "NOT_OPEN"
            : quarter !== currentWindow.activeQuarter
              ? "UPCOMING"
              : total === 0
                ? "WAITING_FOR_GOAL_APPROVAL"
                : completed >= total
                  ? "COMPLETED"
                  : completed > 0
                    ? "IN_PROGRESS"
                    : "PENDING",
        completed,
        total,
        isActive: quarter === currentWindow.activeQuarter
      };
    });

    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department
      },
      cycle: activeCycle,
      currentWindow: currentWindow.phase,
      currentQuarter,
      checkinOpen: currentWindow.checkinOpen,
      goalSettingOpen: currentWindow.goalSettingOpen,
      totalGoals: goals.length,
      maxGoals: 8,
      totalWeightage,
      completionPercentage,
      pendingTasks: goals.filter((goal) =>
        ["DRAFT", "RETURNED"].includes(goal.status)
      ).length,
      achievementScore: completionPercentage,
      progressTrajectory: [
        { label: "Weighted Achievement", value: completionPercentage },
        { label: "Goal Sheet Coverage", value: Math.min(100, totalWeightage) },
        { label: "Approval Coverage", value: percent(submittedOrLockedGoals.length, goals.length) },
        { label: "Check-in Coverage", value: percent(checkedInGoalIds.size, lockedGoals.length) }
      ],
      goals: goalsWithCheckins,
      milestones
    });
  } catch (err) {
    next(err);
  }
});
router.get("/manager", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
  try {
    const currentWindow = getCurrentWindow();
    const activeQuarter = currentWindow.activeQuarter;

    const team = await prisma.user.findMany({
      where: { managerId: req.user.id }
    });

    const teamIds = team.map((member) => member.id);

    const goals = await prisma.goal.findMany({
      where: { employeeId: { in: teamIds } },
      include: { employee: true },
      orderBy: { createdAt: "desc" }
    });

    const checkins = await prisma.checkin.findMany({
      where: { employeeId: { in: teamIds } }
    });

    const checkedInEmployeeIds = new Set(
      activeQuarter
        ? checkins
            .filter((checkin) => checkin.quarter === activeQuarter)
            .map((checkin) => checkin.employeeId)
        : []
    );

    const teamProgress = team.map((member) => {
      const memberGoals = goals.filter((goal) => goal.employeeId === member.id);

      return {
        id: member.id,
        name: member.name,
        progress: weightedProgress(memberGoals),
        goalCount: memberGoals.length
      };
    });

   res.json({
  user: {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    department: req.user.department
  },
  currentWindow: currentWindow.phase,
  currentQuarter: activeQuarter,
  checkinOpen: currentWindow.checkinOpen,
  pendingApprovals: goals.filter((g) => g.status === "SUBMITTED").length,
  teamMembers: team.length,
  avgTeamProgress: average(teamProgress.map((member) => member.progress)),
  checkinsCompleted: currentWindow.checkinOpen
    ? `${checkedInEmployeeIds.size}/${team.length}`
    : "Not open",
  approvalQueue: goals.filter((g) => g.status === "SUBMITTED"),
  teamProgress,
  recentActivity: goals.slice(0, 5).map((goal) => ({
    member: goal.employee.name,
    action: `Updated goal: ${goal.title}`,
    status: goal.status,
    timestamp: goal.updatedAt
  }))
});
  } catch (err) {
    next(err);
  }
});
router.get("/admin", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany();

    const goals = await prisma.goal.findMany({
      include: {
        employee: true
      }
    });

    const audits = await prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    const escalations = await prisma.escalation.findMany();

    const submittedOrLocked = goals.filter((g) =>
      ["SUBMITTED", "LOCKED", "APPROVED"].includes(g.status)
    ).length;

    const departments = [
      ...new Set(
        goals
          .map((goal) => goal.employee?.department)
          .filter(Boolean)
      )
    ];

    const departmentHeatmap = departments.map((department) => {
      const departmentGoals = goals.filter(
        (goal) => goal.employee?.department === department
      );

      const avgProgress = average(departmentGoals.map((goal) => goal.progress));

      return {
        department,
        q1: Math.min(100, avgProgress + 8),
        q2: avgProgress,
        q3: Math.max(0, avgProgress - 12),
        q4: null
      };
    });

    res.json({
      totalWorkforce: users.length,
      participationRate: goals.length
        ? Math.round((submittedOrLocked / goals.length) * 100)
        : 0,
      approvalRating: goals.length
        ? Math.round((goals.filter((g) => g.status === "LOCKED").length / goals.length) * 100)
        : 0,
      activeEscalations: escalations.filter((e) => e.status === "OPEN").length,
      departmentHeatmap,
      criticalAlerts: escalations,
      auditTrail: audits
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;