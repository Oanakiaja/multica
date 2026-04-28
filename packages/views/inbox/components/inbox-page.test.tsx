import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxItem } from "@multica/core/types";
import { InboxPage } from "./inbox-page";

const {
  mockItems,
  mockReplace,
  mockSearchParams,
  mockListInbox,
  mockMarkInboxRead,
} = vi.hoisted(() => ({
  mockItems: { current: [] as InboxItem[] },
  mockReplace: vi.fn(),
  mockSearchParams: { current: new URLSearchParams() },
  mockListInbox: vi.fn(),
  mockMarkInboxRead: vi.fn(),
}));

vi.mock("@multica/core/hooks", () => ({
  useWorkspaceId: () => "ws-test",
}));

vi.mock("@multica/core/api", () => ({
  api: {
    listInbox: mockListInbox,
    markInboxRead: mockMarkInboxRead,
    archiveInbox: vi.fn(),
    markAllInboxRead: vi.fn(),
    archiveAllInbox: vi.fn(),
    archiveAllReadInbox: vi.fn(),
    archiveCompletedInbox: vi.fn(),
  },
}));

vi.mock("@multica/core/paths", () => ({
  useWorkspacePaths: () => ({
    inbox: () => "/test/inbox",
    issueDetail: (id: string) => `/test/issues/${id}`,
  }),
}));

vi.mock("../../navigation", () => ({
  useNavigation: () => ({
    searchParams: mockSearchParams.current,
    replace: mockReplace,
  }),
}));

vi.mock("../../issues/components", () => ({
  StatusIcon: ({ className }: { className?: string }) => (
    <span data-testid="status-icon" className={className} />
  ),
  IssueDetail: ({ issueId, highlightCommentId, highlightCommentScrollBehavior }: any) => (
    <div
      data-testid="issue-detail"
      data-issue-id={issueId}
      data-highlight-comment-id={highlightCommentId}
      data-highlight-scroll-behavior={highlightCommentScrollBehavior}
    />
  ),
}));

vi.mock("@multica/ui/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("react-resizable-panels", () => ({
  Group: ({ children, className }: any) => (
    <div data-testid="panel-group" className={className}>
      {children}
    </div>
  ),
  Panel: ({ children, className }: any) => (
    <div data-testid="panel" className={className}>
      {children}
    </div>
  ),
  Separator: ({ children, className }: any) => (
    <div data-testid="panel-handle" className={className}>
      {children}
    </div>
  ),
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChanged: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

function makeInboxItem(index: number): InboxItem {
  return {
    id: `inbox-${index}`,
    workspace_id: "ws-test",
    recipient_type: "member",
    recipient_id: "user-1",
    actor_type: "agent",
    actor_id: "agent-1",
    type: "new_comment",
    severity: "info",
    issue_id: `issue-${index}`,
    title: `Inbox item ${index}`,
    body: null,
    issue_status: "todo",
    read: false,
    archived: false,
    created_at: `2026-04-28T12:0${9 - index}:00Z`,
    details: { comment_id: `comment-${index}` },
  };
}

function renderInboxPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InboxPage />
    </QueryClientProvider>,
  );
}

describe("InboxPage shortcuts", () => {
  beforeEach(() => {
    mockItems.current = Array.from({ length: 6 }, (_, i) => makeInboxItem(i + 1));
    mockReplace.mockReset();
    mockSearchParams.current = new URLSearchParams();
    mockListInbox.mockReset().mockImplementation(() => Promise.resolve(mockItems.current));
    mockMarkInboxRead.mockReset().mockImplementation((id: string) =>
      Promise.resolve(mockItems.current.find((item) => item.id === id)),
    );
  });

  it("uses Mod+number to switch to the matching inbox item", async () => {
    renderInboxPage();

    await screen.findByText("Inbox item 6");

    fireEvent.keyDown(document, { key: "6", metaKey: true });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/test/inbox?issue=issue-6");
    });
    expect(screen.getByTestId("issue-detail")).toHaveAttribute("data-issue-id", "issue-6");
    expect(screen.getByTestId("issue-detail")).toHaveAttribute(
      "data-highlight-scroll-behavior",
      "instant",
    );
  });

  it("supports Ctrl+number for non-mac keyboards", async () => {
    renderInboxPage();

    await screen.findByText("Inbox item 3");

    fireEvent.keyDown(document, { key: "3", ctrlKey: true });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/test/inbox?issue=issue-3");
    });
    expect(screen.getByTestId("issue-detail")).toHaveAttribute("data-issue-id", "issue-3");
  });

  it("does not switch inbox items while typing in editable fields", async () => {
    renderInboxPage();

    await screen.findByText("Inbox item 1");

    const input = document.createElement("input");
    document.body.appendChild(input);

    try {
      fireEvent.keyDown(input, { key: "1", metaKey: true });
    } finally {
      input.remove();
    }

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
