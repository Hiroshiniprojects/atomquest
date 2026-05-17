
export function validateGoalForm(goal) {
  if (!goal.title.trim()) return "Goal title is required.";
  if (!goal.description.trim()) return "Goal description is required.";
  if (!goal.thrustArea.trim()) return "Thrust area is required.";
  if (!["MIN", "MAX", "TIMELINE", "ZERO"].includes(goal.uomType)) return "Invalid UOM type.";

  const target = Number(goal.targetValue);
  const weightage = Number(goal.weightage);

  if (!Number.isFinite(target)) return "Target must be a valid number.";
  if (!Number.isFinite(weightage)) return "Weightage must be a valid number.";
  if (target < 0) return "Target cannot be negative.";
  if (goal.uomType !== "ZERO" && target === 0) return "Target must be greater than 0.";
  if (!Number.isInteger(weightage)) return "Weightage must be a whole number.";
  if (weightage < 10) return "Minimum weightage is 10%.";
  if (weightage > 100) return "Weightage cannot exceed 100%.";

  return null;
}