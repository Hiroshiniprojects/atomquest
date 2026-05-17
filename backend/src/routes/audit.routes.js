const express = require("express");
const prisma = require("../prisma");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.get("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
