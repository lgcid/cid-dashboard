// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppError from "@/app/error";

describe("AppError", () => {
  it("shows a generic dashboard message instead of assuming a Google Sheets failure", () => {
    render(
      <AppError
        error={new Error('Section "social_services" has invalid metric labels.')}
        reset={vi.fn()}
      />
    );

    expect(screen.getByText("The dashboard could not be loaded.")).toBeTruthy();
    expect(
      screen.getByText(
        "There was a problem preparing the dashboard. Try again, and if it keeps happening, check the logs for the technical details."
      )
    ).toBeTruthy();
    expect(screen.queryByText(/DATA_SOURCE=google_sheets/i)).toBeNull();
  });
});
