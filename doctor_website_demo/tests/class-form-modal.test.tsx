// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserted: unknown[] = [];

vi.mock("../src/supabaseClient", () => ({
  supabase: {
    from: () => ({
      insert(row: { name: string; address: string | null }) {
        inserted.push(row);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: "loc-new", ...row }, error: null }),
          }),
        };
      },
    }),
  },
}));

const { ClassFormModal } = await import("../src/components/ClassModals");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const instructors = [{ id: "teacher-1", first_name: "Fixture", last_name: "Instructor", email: "instructor@example.test" }];
const locations = [{ id: "loc-1", name: "Fixture Training Room", address: null }];
const initial = { locationId: "loc-1", startDate: "2027-01-10", endDate: "2027-01-10", startTime: "09:00", endTime: "12:00", maxStudents: 20 };

let container: HTMLDivElement;
let root: Root;
let onSubmit: ReturnType<typeof vi.fn>;
let onClose: ReturnType<typeof vi.fn>;
let onLocationCreated: ReturnType<typeof vi.fn>;

function render(mode: Parameters<typeof ClassFormModal>[0]["mode"]) {
  act(() => {
    root.render(
      <ClassFormModal
        mode={mode}
        instructors={instructors}
        locations={locations}
        onLocationCreated={onLocationCreated}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );
  });
}

function field<T extends HTMLInputElement | HTMLSelectElement>(id: string): T {
  const element = container.querySelector<T>(`#${id}`);
  if (!element) throw new Error(`no #${id}`);
  return element;
}

function type(id: string, value: string) {
  const element = field(id);
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  if (!match) throw new Error(`no "${label}" button`);
  return match;
}

async function click(label: string) {
  await act(async () => {
    button(label).click();
  });
}

function alertText() {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

beforeEach(() => {
  inserted.length = 0;
  onSubmit = vi.fn().mockResolvedValue(null);
  onClose = vi.fn();
  onLocationCreated = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("scheduling a class at a location typed into the form", () => {
  beforeEach(() => {
    render({ kind: "schedule" });
    act(() => field<HTMLInputElement>("teacher-teacher-1").click());
    type("class-start-date", "2027-01-10");
    type("class-end-date", "2027-01-10");
    type("class-location", "__new__");
  });

  it("saves the typed location and schedules the class there", async () => {
    type("new-location-name", "B07 Annex");
    type("new-location-address", "9 Example Road");

    await click("Schedule class");

    expect(inserted).toEqual([{ name: "B07 Annex", address: "9 Example Road" }]);
    expect(onLocationCreated).toHaveBeenCalledWith({ id: "loc-new", name: "B07 Annex", address: "9 Example Road" });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ locationId: "loc-new" }), ["teacher-1"]);
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses to schedule while the new location has no name", async () => {
    await click("Schedule class");

    expect(alertText()).toBe("Give the new location a name, or choose an existing one.");
    expect(inserted).toEqual([]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("rescheduling a class", () => {
  beforeEach(() => {
    render({ kind: "reschedule", heading: "2027-01-10", initial, booked: 1 });
  });

  it("moves the class to a typed location", async () => {
    type("class-location", "__new__");
    type("new-location-name", "B07 Annex");

    await click("Save new schedule");

    expect(onSubmit).toHaveBeenCalledWith({ ...initial, locationId: "loc-new" }, []);
    expect(onClose).toHaveBeenCalled();
  });

  it("says so when nothing changed instead of closing", async () => {
    await click("Save new schedule");

    expect(alertText()).toBe("Nothing changed. Change the location, dates, times or capacity, or close this dialog.");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
