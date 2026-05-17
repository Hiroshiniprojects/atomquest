require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/prisma");

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.checkin.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.cycle.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123", 10);

  const manager = await prisma.user.create({
    data: {
      name: "Vikram Kumar",
      email: "manager@atomquest.demo",
      passwordHash,
      role: "MANAGER",
      department: "Product"
    }
  });

  const employee = await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "employee@atomquest.demo",
      passwordHash,
      role: "EMPLOYEE",
      department: "Product",
      managerId: manager.id
    }
  });

  const employee2 = await prisma.user.create({
    data: {
      name: "Arjun Varma",
      email: "arjun@atomquest.demo",
      passwordHash,
      role: "EMPLOYEE",
      department: "Engineering",
      managerId: manager.id
    }
  });

  const employee3 = await prisma.user.create({
    data: {
      name: "Sneha Kapoor",
      email: "sneha@atomquest.demo",
      passwordHash,
      role: "EMPLOYEE",
      department: "Marketing",
      managerId: manager.id
    }
  });

  const admin = await prisma.user.create({
    data: {
      name: "Admin Root",
      email: "admin@atomquest.demo",
      passwordHash,
      role: "ADMIN",
      department: "HR"
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      name: "Q2 Performance Review",
      year: 2026,
      active: true
    }
  });

  await prisma.goal.createMany({
    data: [
      {
        title: "Accelerate API Performance",
        description: "Reduce latency by 15%",
        thrustArea: "Technical",
        uomType: "MIN",
        targetValue: 100,
        weightage: 40,
        progress: 85,
        status: "SUBMITTED",
        employeeId: employee.id,
        managerId: manager.id,
        cycleId: cycle.id
      },
      {
        title: "Q3 Architecture Roadmapping",
        description: "Drafting V2 services",
        thrustArea: "Strategic",
        uomType: "TIMELINE",
        targetValue: 100,
        weightage: 30,
        progress: 45,
        status: "SUBMITTED",
        employeeId: employee.id,
        managerId: manager.id,
        cycleId: cycle.id
      },
      {
        title: "Mentorship & Hiring",
        description: "Onboarding 2 engineers",
        thrustArea: "Leadership",
        uomType: "MIN",
        targetValue: 2,
        weightage: 20,
        progress: 60,
        status: "SUBMITTED",
        employeeId: employee.id,
        managerId: manager.id,
        cycleId: cycle.id
      },
      {
        title: "Open Source Contributions",
        description: "Maintain internal UI kit",
        thrustArea: "Community",
        uomType: "MIN",
        targetValue: 10,
        weightage: 10,
        progress: 100,
        status: "LOCKED",
        employeeId: employee.id,
        managerId: manager.id,
        cycleId: cycle.id
      },
      {
        title: "Cloud Migration Phase 2",
        description: "Migrate internal services",
        thrustArea: "Technical",
        uomType: "MIN",
        targetValue: 100,
        weightage: 50,
        progress: 72,
        status: "SUBMITTED",
        employeeId: employee2.id,
        managerId: manager.id,
        cycleId: cycle.id
      },
      {
        title: "Campaign Analytics",
        description: "Improve campaign reporting",
        thrustArea: "Analytics",
        uomType: "MIN",
        targetValue: 100,
        weightage: 50,
        progress: 95,
        status: "LOCKED",
        employeeId: employee3.id,
        managerId: manager.id,
        cycleId: cycle.id
      }
    ]
  });

  await prisma.escalation.createMany({
    data: [
      {
        employeeId: employee2.id,
        managerId: manager.id,
        reason: "Q2 check-in pending for more than 48 hours",
        severity: "HIGH"
      },
      {
        employeeId: employee3.id,
        managerId: manager.id,
        reason: "Manager approval delayed",
        severity: "MEDIUM"
      }
    ]
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_INITIALIZED",
      entity: "System",
      metadata: {
        message: "Initial AtomQuest demo data seeded"
      }
    }
  });

  console.log("Seed complete");
  console.log("Logins:");
  console.log("employee@atomquest.demo / Password123");
  console.log("manager@atomquest.demo / Password123");
  console.log("admin@atomquest.demo / Password123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
