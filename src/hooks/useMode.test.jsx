/* eslint-env node */
import process from 'node:process';
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

describe("useMode", () => {
  beforeEach(() => localStorage.clear());

  it("switches online → local → online and persists", async () => {
    process.env.VITE_SUPABASE_URL = "http://localhost";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = "key";
    process.env.VITE_SUPABASE_ANON_KEY = "key";
    const { ModeProvider, useMode } = await import("./useMode.jsx");
    const wrapper = ({ children }) => <ModeProvider>{children}</ModeProvider>;
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe("online");
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("local");
    expect(localStorage.getItem("hw:mode")).toBe("local");
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("online");
    expect(localStorage.getItem("hw:mode")).toBe("online");
  });
});
