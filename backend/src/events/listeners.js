const prisma = require("../prisma");
const eventBus = require("./eventBus");

eventBus.on("AUDIT", async ({ actorId, action, entity, entityId, metadata }) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        metadata
      }
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
});

module.exports = eventBus;
