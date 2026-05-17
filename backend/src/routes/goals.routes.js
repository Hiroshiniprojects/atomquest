const express = require("express");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const eventBus = require("../events/eventBus");

const router = express.Router();

const VALID_UOM_TYPES = ["MIN", "MAX", "TIMELINE", "ZERO"];
const EDITABLE_STATUSES = ["DRAFT", "RETURNED"];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateGoalPayload(body) {
  const { title, description, thrustArea, uomType, targetValue, weightage } = body;

  if (
    isBlank(title) ||
    isBlank(description) ||
    isBlank(thrustArea) ||
    isBlank(uomType) ||
    isBlank(targetValue) ||
    isBlank(weightage)
  ) {
    return { message: "All goal fields are required" };
  }

  if (!VALID_UOM_TYPES.includes(uomType)) {
    return { message: "Invalid UOM type" };
  }

  const numericTarget = toNumber(targetValue);
  const numericWeightage = toNumber(weightage);

  if (numericTarget === null) {
    return { message: "Target value must be a valid number" };
  }

  if (numericWeightage === null) {
    return { message: "Weightage must be a valid number" };
  }

  if (numericTarget < 0) {
    return { message: "Target value cannot be negative" };
  }

  if (uomType !== "ZERO" && numericTarget === 0) {
    return { message: "Target value must be greater than 0 for this UOM type" };
  }

  if (numericWeightage < 10) {
    return { message: "Minimum weightage is 10%" };
  }

  if (numericWeightage > 100) {
    return { message: "Weightage cannot exceed 100%" };
  }

  if (!Number.isInteger(numericWeightage)) {
    return { message: "Weightage must be a whole number" };
  }

  return null;
}

async function getActiveCycle() {
  return prisma.cycle.findFirst({
    where: { active: true }
  });
}

async function getEmployeeCycleGoals(employeeId, cycleId) {
  return prisma.goal.findMany({
    where: {
      employeeId,
      cycleId
    }
  });
}

async function getEditableGoalsForEmployee(employeeId, cycleId) {
  return prisma.goal.findMany({
    where: {
      employeeId,
      cycleId,
      status: { in: EDITABLE_STATUSES }
    }
  });
}

router.get("/", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { employeeId: req.user.id },
      orderBy: { createdAt: "desc" }
    });

    res.json(goals);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const validationError = validateGoalPayload(req.body);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const { title, description, thrustArea, uomType } = req.body;
    const targetValue = toNumber(req.body.targetValue);
    const weightage = toNumber(req.body.weightage);

    const activeCycle = await getActiveCycle();

    if (!activeCycle) {
      return res.status(400).json({ message: "No active cycle found" });
    }

    if (!req.user.managerId) {
      return res.status(400).json({ message: "Employee is not assigned to a manager" });
    }

    const allCycleGoals = await getEmployeeCycleGoals(req.user.id, activeCycle.id);

    if (allCycleGoals.length >= 8) {
      return res.status(400).json({ message: "Maximum 8 goals allowed" });
    }

    const totalCycleWeightage = allCycleGoals.reduce(
      (sum, goal) => sum + goal.weightage,
      0
    );

    if (totalCycleWeightage + weightage > 100) {
      return res.status(400).json({
        message: `Total goal weightage cannot exceed 100%. Current total is ${totalCycleWeightage}%.`
      });
    }

    const goal = await prisma.goal.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        thrustArea: thrustArea.trim(),
        uomType,
        targetValue,
        weightage,
        employeeId: req.user.id,
        managerId: req.user.managerId,
        cycleId: activeCycle.id
      }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "GOAL_CREATED",
      entity: "Goal",
      entityId: goal.id,
      metadata: goal
    });

    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const validationError = validateGoalPayload(req.body);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id }
    });

    if (!goal || goal.employeeId !== req.user.id) {
      return res.status(404).json({ message: "Goal not found" });
    }

    if (!EDITABLE_STATUSES.includes(goal.status)) {
      return res.status(400).json({
        message: "Only draft or returned goals can be edited"
      });
    }

    const targetValue = toNumber(req.body.targetValue);
    const weightage = toNumber(req.body.weightage);

    const allCycleGoals = await getEmployeeCycleGoals(req.user.id, goal.cycleId);

    const otherGoalWeightage = allCycleGoals
      .filter((item) => item.id !== goal.id)
      .reduce((sum, item) => sum + item.weightage, 0);

    if (otherGoalWeightage + weightage > 100) {
      return res.status(400).json({
        message: `Total goal weightage cannot exceed 100%. Current total without this goal is ${otherGoalWeightage}%.`
      });
    }

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: {
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        thrustArea: req.body.thrustArea.trim(),
        uomType: req.body.uomType,
        targetValue,
        weightage
      }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "GOAL_UPDATED",
      entity: "Goal",
      entityId: goal.id,
      metadata: { before: goal, after: updated }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id }
    });

    if (!goal || goal.employeeId !== req.user.id) {
      return res.status(404).json({ message: "Goal not found" });
    }

    if (!EDITABLE_STATUSES.includes(goal.status)) {
      return res.status(400).json({
        message: "Only draft or returned goals can be deleted"
      });
    }

    await prisma.goal.delete({
      where: { id: goal.id }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "GOAL_DELETED",
      entity: "Goal",
      entityId: goal.id,
      metadata: goal
    });

    res.json({ message: "Goal deleted" });
  } catch (err) {
    next(err);
  }
});

router.post("/submit", requireAuth, requireRole("EMPLOYEE"), async (req, res, next) => {
  try {
    const activeCycle = await getActiveCycle();

    if (!activeCycle) {
      return res.status(400).json({ message: "No active cycle found" });
    }

    const editableGoals = await getEditableGoalsForEmployee(req.user.id, activeCycle.id);

    if (editableGoals.length === 0) {
      return res.status(400).json({
        message: "No draft or returned goals to submit"
      });
    }

    const allCycleGoals = await getEmployeeCycleGoals(req.user.id, activeCycle.id);

    const totalWeightage = allCycleGoals.reduce(
      (sum, goal) => sum + goal.weightage,
      0
    );

    if (totalWeightage !== 100) {
      return res.status(400).json({
        message: `Total goal sheet weightage must equal 100%. Current total is ${totalWeightage}%`
      });
    }

    const submitted = await prisma.goal.updateMany({
      where: {
        employeeId: req.user.id,
        cycleId: activeCycle.id,
        status: { in: EDITABLE_STATUSES }
      },
      data: { status: "SUBMITTED" }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "GOALS_SUBMITTED",
      entity: "Goal",
      metadata: {
        cycleId: activeCycle.id,
        count: submitted.count,
        totalWeightage
      }
    });

    res.json({
      message: "Goals submitted for approval",
      count: submitted.count
    });
  } catch (err) {
    next(err);
  }
});

router.get("/team", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { managerId: req.user.id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true
          }
        }
      },
      orderBy: [
        { status: "desc" },
        { updatedAt: "desc" }
      ]
    });

    res.json(goals);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/approve", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!goal || goal.managerId !== req.user.id) {
      return res.status(404).json({ message: "Goal not found" });
    }

    if (goal.status !== "SUBMITTED") {
      return res.status(400).json({
        message: "Only submitted goals can be approved"
      });
    }

    const targetValue =
      req.body.targetValue === undefined ? goal.targetValue : Number(req.body.targetValue);

    const weightage =
      req.body.weightage === undefined ? goal.weightage : Number(req.body.weightage);

    if (!Number.isFinite(targetValue) || targetValue < 0) {
      return res.status(400).json({ message: "Target value must be valid" });
    }

    if (!Number.isInteger(weightage) || weightage < 10 || weightage > 100) {
      return res.status(400).json({
        message: "Weightage must be a whole number between 10 and 100"
      });
    }

    const employeeCycleGoals = await getEmployeeCycleGoals(goal.employeeId, goal.cycleId);

    const totalWeightage =
      employeeCycleGoals
        .filter((item) => item.id !== goal.id)
        .reduce((sum, item) => sum + item.weightage, 0) + weightage;

    if (totalWeightage !== 100) {
      return res.status(400).json({
        message: `Employee goal sheet must remain 100%. Current total would be ${totalWeightage}%.`
      });
    }

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: {
        targetValue,
        weightage,
        status: "LOCKED"
      }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "GOAL_APPROVED_LOCKED",
      entity: "Goal",
      entityId: goal.id,
      metadata: { before: goal, after: updated }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/return", requireAuth, requireRole("MANAGER"), async (req, res, next) => {
  try {
    const goal = await prisma.goal.findUnique({
      where: { id: req.params.id }
    });

    if (!goal || goal.managerId !== req.user.id) {
      return res.status(404).json({ message: "Goal not found" });
    }

    if (goal.status !== "SUBMITTED") {
      return res.status(400).json({
        message: "Only submitted goals can be returned"
      });
    }

    const reason = req.body.reason?.trim() || "Needs rework";

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: { status: "RETURNED" }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "GOAL_RETURNED",
      entity: "Goal",
      entityId: goal.id,
      metadata: {
        before: goal,
        after: updated,
        reason
      }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;