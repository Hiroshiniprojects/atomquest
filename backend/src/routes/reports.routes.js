const express = require("express");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

function csvEscape(value) {
  if (value == null) return "";
  return `"${String(value).replaceAll('"', '""')}"`;
}

router.get("/achievement", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const goals = await prisma.goal.findMany({
      include: { employee: true, cycle: true },
      orderBy: { createdAt: "desc" }
    });

    const header = [
      "Employee",
      "Email",
      "Department",
      "Cycle",
      "Goal",
      "Thrust Area",
      "UOM Type",
      "Target",
      "Actual",
      "Weightage",
      "Progress",
      "Status"
    ];

    const rows = goals.map((goal) => [
      goal.employee.name,
      goal.employee.email,
      goal.employee.department,
      goal.cycle.name,
      goal.title,
      goal.thrustArea,
      goal.uomType,
      goal.targetValue,
      goal.actualValue || "",
      goal.weightage,
      goal.progress,
      goal.status
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=achievement-report.csv");
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
