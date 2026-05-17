const express = require("express");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const eventBus = require("../events/eventBus");

const router = express.Router();

const VALID_QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const VALID_CHECKIN_STATUSES = ["NOT_STARTED", "ON_TRACK", "COMPLETED", "AT_RISK"];

function calculateProgress(uomType, targetValue, actualValue) {
  if (uomType === "MIN") {
    if (targetValue === 0) return 0;
    return Math.min(100, Math.round((actualValue / targetValue) * 100));
  }

  if (uomType === "MAX") {
    if (actualValue === 0) return 100;
    return Math.min(100, Math.round((targetValue / actualValue) * 100));
  }

  if (uomType === "ZERO") {
    return actualValue === 0 ? 100 : 0;
  }

  if (uomType === "TIMELINE") {
    return Math.min(100, Math.round(actualValue));
  }

  return 0;
}

function getCurrentWindow() {
  const overrideWindow = process.env.ACTIVE_WINDOW;

  const windows = {
    GOAL_SETTING: {
      activeQuarter: null,
      checkinOpen: false
    },
    Q1_CHECKIN: {
      activeQuarter: "Q1",
      checkinOpen: true
    },
    Q2_CHECKIN: {
      activeQuarter: "Q2",
      checkinOpen: true
    },
    Q3_CHECKIN: {
      activeQuarter: "Q3",
      checkinOpen: true
    },
    Q4_CHECKIN: {
      activeQuarter: "Q4",
      checkinOpen: true
    },
    CYCLE_CLOSED: {
      activeQuarter: null,
      checkinOpen: false
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

router.get("/", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const checkins = await prisma.checkin.findMany({
      where: { employeeId: req.user.id },
      include: { goal: true },
      orderBy: { createdAt: "desc" }
    });

    res.json(checkins);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const { goalId, quarter, actualValue, status, employeeNote } = req.body;

    if (!goalId || !quarter || actualValue === undefined || actualValue === null || !status) {
      return res.status(400).json({
        message: "Goal, quarter, actual value, and status are required"
      });
    }

    if (!VALID_QUARTERS.includes(quarter)) {
      return res.status(400).json({ message: "Invalid quarter" });
    }

    if (!VALID_CHECKIN_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid check-in status" });
    }

    const currentWindow = getCurrentWindow();

    if (!currentWindow.checkinOpen) {
      return res.status(400).json({
        message: "Check-in window is not open"
      });
    }

    if (quarter !== currentWindow.activeQuarter) {
      return res.status(400).json({
        message: `Only ${currentWindow.activeQuarter} check-in is currently open`
      });
    }

    const numericActualValue = Number(actualValue);

    if (!Number.isFinite(numericActualValue)) {
      return res.status(400).json({
        message: "Actual value must be a valid number"
      });
    }

    if (numericActualValue < 0) {
      return res.status(400).json({
        message: "Actual value cannot be negative"
      });
    }

    const goal = await prisma.goal.findUnique({
      where: { id: goalId }
    });

    if (!goal || goal.employeeId !== req.user.id) {
      return res.status(404).json({ message: "Goal not found" });
    }

    if (goal.status !== "LOCKED") {
      return res.status(400).json({
        message: "Only locked/approved goals can receive check-ins"
      });
    }

    const existingCheckin = await prisma.checkin.findFirst({
      where: {
        goalId,
        employeeId: req.user.id,
        quarter
      }
    });

    if (existingCheckin) {
      return res.status(400).json({
        message: "Check-in already submitted for this goal and quarter"
      });
    }

    const progress = calculateProgress(
      goal.uomType,
      goal.targetValue,
      numericActualValue
    );

    const checkin = await prisma.checkin.create({
      data: {
        goalId,
        quarter,
        actualValue: numericActualValue,
        status,
        employeeNote: employeeNote?.trim() || null,
        employeeId: req.user.id
      }
    });

    await prisma.goal.update({
      where: { id: goalId },
      data: {
        actualValue: numericActualValue,
        progress
      }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "CHECKIN_CREATED",
      entity: "Checkin",
      entityId: checkin.id,
      metadata: {
        checkin,
        calculatedProgress: progress
      }
    });

    res.status(201).json({
      ...checkin,
      calculatedProgress: progress
    });
  } catch (err) {
    next(err);
  }
});

router.get("/team", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
  try {
    const team = await prisma.user.findMany({
      where: { managerId: req.user.id },
      select: { id: true }
    });

    const teamIds = team.map((member) => member.id);

    const checkins = await prisma.checkin.findMany({
      where: { employeeId: { in: teamIds } },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        goal: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(checkins);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/comment", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
  try {
    const checkin = await prisma.checkin.findUnique({
      where: { id: req.params.id },
      include: { goal: true }
    });

    if (!checkin || checkin.goal.managerId !== req.user.id) {
      return res.status(404).json({ message: "Check-in not found" });
    }

    if (!req.body.managerComment || !req.body.managerComment.trim()) {
      return res.status(400).json({ message: "Manager comment is required" });
    }

    const updated = await prisma.checkin.update({
      where: { id: checkin.id },
      data: { managerComment: req.body.managerComment.trim() }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "MANAGER_CHECKIN_COMMENTED",
      entity: "Checkin",
      entityId: checkin.id,
      metadata: updated
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;