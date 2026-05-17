"use client";

import { useState } from "react";
import { setSession } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("manager@atomquest.demo");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        throw new Error("Invalid login");
      }

      const data = await res.json();
      setSession(data.token, data.user);

      if (data.user.role === "EMPLOYEE") window.location.href = "/employee/dashboard";
      if (data.user.role === "MANAGER") window.location.href = "/manager/dashboard";
      if (data.user.role === "ADMIN") window.location.href = "/admin/dashboard";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0f131e] text-[#dfe2f2] flex items-center justify-center px-6">
      <form onSubmit={handleLogin} className="w-full max-w-md rounded-xl border border-[#464554]/50 bg-[#1b1f2b] p-8">
        <h1 className="text-3xl font-bold">AtomQuest</h1>
        <p className="mt-2 text-sm text-[#c7c4d7]">Enterprise Performance Portal</p>

        <div className="mt-8 space-y-4">
          <input
            className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-4 py-3 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
          />

          <input
            className="w-full rounded-lg border border-[#464554] bg-[#0a0e19] px-4 py-3 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
          />

          {error && <p className="text-sm text-[#ffb4ab]">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-[#c0c1ff] px-4 py-3 font-bold text-[#1000a9]"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        <div className="mt-6 text-xs text-[#c7c4d7] space-y-1">
          <p>employee@atomquest.demo / Password123</p>
          <p>manager@atomquest.demo / Password123</p>
          <p>admin@atomquest.demo / Password123</p>
        </div>
      </form>
    </main>
  );
}
