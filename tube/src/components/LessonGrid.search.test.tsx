import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { SearchResults } from "@next-editor/infra";

// The real search hook, LessonGrid and SearchResults, with only the request
// mocked: the query cache's placeholder and retry behaviour is what these
// pin, which a mocked hook hides.
const api = vi.hoisted(() => ({ search: vi.fn<(q: string) => Promise<SearchResults>>() }));
vi.mock("../../../infra/client/search/searchApi", () => ({ search: api.search }));
vi.mock("@next-editor/infra", async () => {
  const { useSearch } = await import("../../../infra/client/search/useSearch");
  return { useSearch, avatarProxyUrl: (url: string) => url };
});
vi.mock("../hooks/useLessons", () => ({
  useLessonsInfinite: () => ({
    data: { pages: [{ lessons: [{ slug: "intro", title: "Gallery intro" }], nextPage: null }] },
    error: null,
    isPending: false,
    isError: false,
    fetchNextPage: vi.fn<() => void>(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    refetch: vi.fn<() => void>(),
  }),
}));
vi.mock("../hooks/useWarmLessonRoute", () => ({ useWarmLessonRoute: () => {} }));
vi.mock("./LessonCard", () => ({
  default: ({ lesson }: { lesson: { title: string } }) => <h3>{lesson.title}</h3>,
}));
vi.mock("../lib/firstRowThumbnails", () => ({
  observeFirstRowThumbnails: () => {},
  settleWithoutFirstRow: () => {},
  whenFirstRowThumbnailsSettled: () => new Promise<void>(() => {}),
}));

const { default: LessonGrid } = await import("./LessonGrid");

function found(...titles: string[]): SearchResults {
  return {
    authors: [],
    lessons: titles.map((title) => ({ slug: title.toLowerCase(), title })),
  } as unknown as SearchResults;
}

/** A search answer the test resolves or rejects when it wants. */
function deferred() {
  let resolve!: (value: SearchResults) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<SearchResults>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderGrid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(<LessonGrid />, { wrapper });
}

const field = () => screen.getByRole("textbox", { name: "Search authors and lessons" });
function submit(value: string) {
  fireEvent.change(field(), { target: { value } });
  fireEvent.submit(screen.getByRole("search"));
}
const busyRegionOf = (text: string) => screen.getByText(text).closest("[aria-busy]");

beforeEach(() => {
  api.search.mockReset();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LessonGrid search with the real query cache", () => {
  it("sends nothing while typing and one request per Enter", async () => {
    api.search.mockResolvedValue(found("Closures"));
    renderGrid();

    for (const value of ["r", "ru", "rus", "rust"])
      fireEvent.change(field(), { target: { value } });
    expect(api.search).not.toHaveBeenCalled();

    fireEvent.submit(screen.getByRole("search"));
    expect(await screen.findByRole("heading", { name: "Closures" })).toBeInTheDocument();
    expect(api.search.mock.calls).toEqual([["rust", 0]]);
    expect(screen.getByRole("status")).toHaveTextContent("Results for “rust”: 1 lesson");
  });

  it("keeps the gallery, dimmed and inert, until the first search answers", async () => {
    const answer = deferred();
    api.search.mockReturnValue(answer.promise);
    renderGrid();

    submit("rust");
    await waitFor(() => expect(busyRegionOf("Gallery intro")).toHaveAttribute("aria-busy", "true"));
    expect(busyRegionOf("Gallery intro")).toHaveAttribute("inert");
    expect(screen.getByRole("status")).toHaveTextContent("Searching…");

    answer.resolve(found("Closures"));
    expect(await screen.findByRole("heading", { name: "Closures" })).toBeInTheDocument();
    expect(screen.queryByText("Gallery intro")).not.toBeInTheDocument();
  });

  it("keeps the last results, dimmed, while a newer search loads", async () => {
    const second = deferred();
    api.search.mockResolvedValueOnce(found("Closures")).mockReturnValueOnce(second.promise);
    renderGrid();
    submit("rust");
    await screen.findByRole("heading", { name: "Closures" });

    submit("traits");
    await waitFor(() => expect(busyRegionOf("Closures")).toHaveAttribute("aria-busy", "true"));

    second.resolve(found("Traits"));
    expect(await screen.findByRole("heading", { name: "Traits" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Closures" })).not.toBeInTheDocument();
  });

  it("after Escape, keeps the gallery up for a new search instead of blanking or old results", async () => {
    const second = deferred();
    api.search.mockResolvedValueOnce(found("Closures")).mockReturnValueOnce(second.promise);
    renderGrid();
    submit("rust");
    await screen.findByRole("heading", { name: "Closures" });

    fireEvent.keyDown(field(), { key: "Escape" });
    expect(await screen.findByText("Gallery intro")).toBeInTheDocument();

    submit("traits");
    await waitFor(() => expect(api.search).toHaveBeenCalledWith("traits", 0));
    expect(screen.getByText("Gallery intro")).toBeInTheDocument();
    expect(busyRegionOf("Gallery intro")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading", { name: "Closures" })).not.toBeInTheDocument();

    second.resolve(found("Traits"));
    expect(await screen.findByRole("heading", { name: "Traits" })).toBeInTheDocument();
  });

  it("shows a failed first search once, without refetching in a loop, and Enter retries it", async () => {
    api.search.mockRejectedValue(new Error("down"));
    renderGrid();

    submit("rust");
    expect(await screen.findByRole("alert")).toHaveTextContent("Search failed");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.search).toHaveBeenCalledTimes(1);

    api.search.mockResolvedValue(found("Closures"));
    fireEvent.submit(screen.getByRole("search"));
    expect(await screen.findByRole("heading", { name: "Closures" })).toBeInTheDocument();
    expect(api.search).toHaveBeenCalledTimes(2);
  });

  it("brings each new answer in as a new set of cards, so kept cards never jump", async () => {
    api.search
      .mockResolvedValueOnce(found("Closures", "Traits"))
      .mockResolvedValueOnce(found("Traits"));
    renderGrid();
    submit("rust");
    const traits = await screen.findByRole("heading", { name: "Traits" });

    submit("traits");
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Closures" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Traits" })).not.toBe(traits);
  });

  it("does not bring older results back while a failed search is retried", async () => {
    const retry = deferred();
    api.search
      .mockResolvedValueOnce(found("Closures"))
      .mockRejectedValueOnce(new Error("down"))
      .mockReturnValueOnce(retry.promise);
    renderGrid();
    submit("rust");
    await screen.findByRole("heading", { name: "Closures" });
    submit("lifetime");
    expect(await screen.findByRole("alert")).toHaveTextContent("Search failed");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api.search).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("heading", { name: "Closures" })).not.toBeInTheDocument();
    // The button left with the failure; focus is back in the field.
    expect(field()).toHaveFocus();

    retry.resolve(found("Lifetimes"));
    expect(await screen.findByRole("heading", { name: "Lifetimes" })).toBeInTheDocument();
  });
});

/** /learn with the grid, a lesson page to open, and Back, at `entries` (the last is current). */
function renderLearnAt(...entries: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Where() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <p data-testid="location">{location.pathname + location.search}</p>
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
        <button type="button" onClick={() => navigate("/learn/closures")}>
          Open lesson
        </button>
      </>
    );
  }
  return render(
    <MemoryRouter initialEntries={entries}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route
            path="/learn"
            element={
              <>
                <LessonGrid />
                <Where />
              </>
            }
          />
          <Route path="/learn/:slug" element={<Where />} />
          <Route path="/start" element={<Where />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId("location").textContent;
const back = () => fireEvent.click(screen.getByRole("button", { name: "Back" }));

describe("LessonGrid search in the URL", () => {
  it("puts the search in the URL, so Back from a result brings its results back", async () => {
    api.search.mockResolvedValue(found("Closures"));
    renderLearnAt("/learn");

    submit("rust");
    expect(await screen.findByRole("heading", { name: "Closures" })).toBeInTheDocument();
    expect(location()).toBe("/learn?q=rust");

    fireEvent.click(screen.getByRole("button", { name: "Open lesson" }));
    expect(location()).toBe("/learn/closures");
    back();

    expect(location()).toBe("/learn?q=rust");
    expect(await screen.findByRole("heading", { name: "Closures" })).toBeInTheDocument();
    expect(field()).toHaveValue("rust");
    // From the cache: coming back is not a new search.
    expect(api.search).toHaveBeenCalledOnce();
  });

  it("opens a search link with its results", async () => {
    api.search.mockResolvedValue(found("Closures"));
    renderLearnAt("/learn?q=rust");

    expect(field()).toHaveValue("rust");
    expect(await screen.findByRole("heading", { name: "Closures" })).toBeInTheDocument();
    expect(api.search).toHaveBeenCalledWith("rust", 0);
  });

  it("clears the search without leaving it for Back to reopen", async () => {
    api.search.mockResolvedValue(found("Closures"));
    renderLearnAt("/start", "/learn");

    submit("rust");
    await screen.findByRole("heading", { name: "Closures" });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(location()).toBe("/learn");
    expect(await screen.findByText("Gallery intro")).toBeInTheDocument();

    back();
    expect(location()).toBe("/learn");
    expect(screen.queryByRole("heading", { name: "Closures" })).not.toBeInTheDocument();
  });

  it("adds no history entry for Enter on the search already showing", async () => {
    api.search.mockResolvedValue(found("Closures"));
    renderLearnAt("/start", "/learn");

    submit("rust");
    await screen.findByRole("heading", { name: "Closures" });
    submit("rust");

    back();
    expect(location()).toBe("/learn");
  });
});
