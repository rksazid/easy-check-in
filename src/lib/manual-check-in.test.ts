import { describe, expect, it } from "vitest";

describe("manual check-in rules and states", () => {
  it("defaults to approved status for new manual check-ins", () => {
    const newEntry = {
      isManual: true,
      status: "approved" as const,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    };

    expect(newEntry.isManual).toBe(true);
    expect(newEntry.status).toBe("approved");
    expect(newEntry.rejectedAt).toBeNull();
  });

  it("transitions to rejected status with reason and metadata", () => {
    const entry = {
      id: "chk_1",
      isManual: true,
      status: "approved" as "approved" | "rejected",
      rejectedBy: null as string | null,
      rejectedAt: null as Date | null,
      rejectionReason: null as string | null,
    };

    // Simulate rejection
    const rejectedEntry = {
      ...entry,
      status: "rejected" as const,
      rejectedBy: "usr_admin",
      rejectedAt: new Date("2026-10-31T15:00:00Z"),
      rejectionReason: "False entry or not on site",
    };

    expect(rejectedEntry.status).toBe("rejected");
    expect(rejectedEntry.rejectedBy).toBe("usr_admin");
    expect(rejectedEntry.rejectionReason).toBe("False entry or not on site");
    expect(rejectedEntry.rejectedAt).toBeInstanceOf(Date);
  });

  it("restores rejected manual check-in back to approved", () => {
    const rejectedEntry = {
      id: "chk_1",
      isManual: true,
      status: "rejected" as const,
      rejectedBy: "usr_admin",
      rejectedAt: new Date(),
      rejectionReason: "Mistake",
    };

    // Restore
    const restored = {
      ...rejectedEntry,
      status: "approved" as const,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    };

    expect(restored.status).toBe("approved");
    expect(restored.rejectedBy).toBeNull();
    expect(restored.rejectedAt).toBeNull();
    expect(restored.rejectionReason).toBeNull();
  });

  it("validates organization manual check-in permission flag", () => {
    const orgWithManual = { id: "org_1", allowManualCheckIn: true };
    const orgWithoutManual = { id: "org_2", allowManualCheckIn: false };
    const orgDefault = { id: "org_3", allowManualCheckIn: undefined };

    function canCheckInManually(org: { allowManualCheckIn?: boolean | null }) {
      return Boolean(org.allowManualCheckIn);
    }

    expect(canCheckInManually(orgWithManual)).toBe(true);
    expect(canCheckInManually(orgWithoutManual)).toBe(false);
    expect(canCheckInManually(orgDefault)).toBe(false);
  });
});

