import { act, fireEvent, render, screen } from "@testing-library/react";
import { FloatingPopupBanner } from "./floating-popup-banner";

describe("FloatingPopupBanner", () => {
  test("renders message and closes when x is clicked", () => {
    const onClose = jest.fn();

    render(
      <FloatingPopupBanner
        message="Something happened."
        onClose={onClose}
        open
      />,
    );

    expect(screen.getByText("Something happened.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss popup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("auto-dismisses after 8 seconds by default", () => {
    jest.useFakeTimers();

    try {
      const onClose = jest.fn();

      render(
        <FloatingPopupBanner
          message="Auto dismiss me."
          onClose={onClose}
          open
        />,
      );

      act(() => {
        jest.advanceTimersByTime(7_999);
      });
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("does not auto-dismiss when autoDismissMs is null", () => {
    jest.useFakeTimers();

    try {
      const onClose = jest.fn();

      render(
        <FloatingPopupBanner
          autoDismissMs={null}
          message="Persistent message."
          onClose={onClose}
          open
        />,
      );

      act(() => {
        jest.advanceTimersByTime(20_000);
      });
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test("resets auto-dismiss timer when message changes", () => {
    jest.useFakeTimers();

    try {
      const onClose = jest.fn();
      const { rerender } = render(
        <FloatingPopupBanner
          message="First message."
          onClose={onClose}
          open
        />,
      );

      act(() => {
        jest.advanceTimersByTime(7_000);
      });

      rerender(
        <FloatingPopupBanner
          message="Second message."
          onClose={onClose}
          open
        />,
      );

      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(7_000);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
