import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatMarkdown } from "@/app/wizard/components/ChatMarkdown";

describe("ChatMarkdown", () => {
  it("should render bold text without literal asterisks", () => {
    // Arrange
    const { container } = render(
      <ChatMarkdown content={"**My recommendation:** Use Supabase."} />
    );

    // Act
    const strong = screen.getByText("My recommendation:");

    // Assert
    expect(strong.tagName).toBe("STRONG");
    expect(container.textContent).not.toContain("**");
  });

  it("should render bullet lists as list items", () => {
    // Arrange
    render(<ChatMarkdown content={"- First point\n- Second point"} />);

    // Act
    const items = screen.getAllByRole("listitem");

    // Assert
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("First point");
  });
});
