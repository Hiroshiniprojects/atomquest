const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

require("./events/listeners");

const authRoutes = require("./routes/auth.routes");
const goalRoutes = require("./routes/goals.routes");
const checkinRoutes = require("./routes/checkins.routes");
const userRoutes = require("./routes/users.routes");
const auditRoutes = require("./routes/audit.routes");
const cycleRoutes = require("./routes/cycles.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const reportRoutes = require("./routes/reports.routes");
const errorHandler = require("./middleware/error");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "AtomQuest API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/cycles", cycleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

app.use(errorHandler);

module.exports = app;
