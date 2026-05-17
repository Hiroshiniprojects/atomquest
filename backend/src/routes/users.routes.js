const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const eventBus = require("../events/eventBus");

const router = express.Router();

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        managerId: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password || "Password123", 10);

    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        passwordHash,
        role: req.body.role,
        department: req.body.department,
        managerId: req.body.managerId || null
      }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role }
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

router.put("/:id/role", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role }
    });

    eventBus.emit("AUDIT", {
      actorId: req.user.id,
      action: "USER_ROLE_CHANGED",
      entity: "User",
      entityId: updated.id,
      metadata: { role: updated.role }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
