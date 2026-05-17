const express = require("express");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const eventBus = require("../events/eventBus");

const router = express.Router();

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const cycles = await prisma.cycle.findMany({
      orderBy: { createdAt: "desc" }
    });

    res.json(cycles);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/activate", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    await prisma.cycle.updateMany({
      data: { active: false }
    });

    const cycle = await prisma.cycle.update({
      where: { id: req.params.id },
      data: { active: true }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "CYCLE_ACTIVATED",
      entity: "Cycle",
      entityId: cycle.id,
      metadata: cycle
    });

    res.json(cycle);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
