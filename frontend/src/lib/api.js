const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("atomquest_token");
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("atomquest_user");
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token, user) {
  localStorage.setItem("atomquest_token", token);
  localStorage.setItem("atomquest_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("atomquest_token");
  localStorage.removeItem("atomquest_user");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(options.headers || {})
    }
  });

  const contentType = res.headers.get("content-type");

  if (!res.ok) {
    const error = contentType?.includes("application/json")
      ? await res.json()
      : { message: "Request failed" };

    throw new Error(error.message || "Request failed");
  }

  if (contentType?.includes("text/csv")) {
    return res.text();
  }

  return res.json();
}
