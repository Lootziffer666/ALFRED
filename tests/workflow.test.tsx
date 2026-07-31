import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";

/**
 * Component-level test for the main workflow (PRD §12: "at least one
 * integration or component-level test covering the main workflow"). Runs
 * entirely in demo mode so it exercises the real UI and session-state logic
 * without any network access.
 */
describe("ALFRET main workflow (demo mode)", () => {
  it("walks from session setup through inventory, contract map, handoff, to audit", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(screen.getByRole("heading", { name: /Session setup/i })).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Demo mode/i));
    await user.click(screen.getByRole("button", { name: /Enter demo inventory/i }));

    expect(await screen.findByRole("heading", { name: /Repository inventory/i })).toBeInTheDocument();
    expect(screen.getAllByText(/octo\/widget-kit/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /View demo contract map/i }));

    expect(await screen.findByRole("heading", { name: /Contract map/i })).toBeInTheDocument();
    // All six finding statuses should be represented (PRD §8 demo requirement).
    expect(screen.getAllByText(/implemented/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/contradicted/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /Generate handoff/i }));

    expect(await screen.findByRole("heading", { name: /Agent handoff/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Continue to result audit/i }));

    expect(await screen.findByRole("heading", { name: /Result audit/i })).toBeInTheDocument();
    // The demo acceptance report ships with both a passed and a non-passed criterion.
    expect(screen.getAllByText(/passed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not proven/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Unsupported agent claims/i)).toBeInTheDocument();
  });

  it("disables the audit step until a handoff exists", () => {
    render(<Home />);
    const auditTab = screen.getByRole("button", { name: /Result audit/i });
    expect(auditTab).toBeDisabled();
  });
});
