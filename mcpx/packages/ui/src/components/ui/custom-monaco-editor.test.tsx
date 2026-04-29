import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomMonacoEditor } from "./custom-monaco-editor";

const monacoEditorMock = vi.fn<(props: unknown) => void>();

vi.mock("@monaco-editor/react", () => ({
  default: (props: unknown) => {
    monacoEditorMock(props);
    return <div data-testid="monaco-editor" />;
  },
}));

describe("CustomMonacoEditor", () => {
  it("allows wheel events to bubble to an outer scroll container", () => {
    render(<CustomMonacoEditor value="{}" onChange={vi.fn()} />);

    expect(monacoEditorMock).toHaveBeenCalled();

    const props = monacoEditorMock.mock.calls[0]?.[0] as unknown as {
      options?: {
        scrollbar?: {
          alwaysConsumeMouseWheel?: boolean;
          handleMouseWheel?: boolean;
        };
      };
    };

    expect(props.options?.scrollbar?.handleMouseWheel).toBe(true);
    expect(props.options?.scrollbar?.alwaysConsumeMouseWheel).toBe(false);
  });
});
