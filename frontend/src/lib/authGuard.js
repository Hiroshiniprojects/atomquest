import { clearSession, getUser } from "./api";

export function requireRole(role) {
  const user = getUser();

  if (!user) {
    window.location.href = "/";
    return null;
  }

  if (user.role !== role) {
    clearSession();
    window.location.href = "/";
    return null;
  }

  return user;
}