import { initialize, mswLoader } from "msw-storybook-addon";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import "@xyflow/react/dist/style.css";
import { TooltipProvider } from "@/components/ui/tooltip";

initialize({
  onUnhandledRequest: "bypass",
});

const storybookQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  loaders: [mswLoader],
  decorators: [
    (Story) => (
      <QueryClientProvider client={storybookQueryClient}>
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    msw: {
      handlers: [
        http.post("*/auth/mcpx", () => HttpResponse.json({}, { status: 200 })),
        http.delete("*/auth/mcpx", () =>
          HttpResponse.json({}, { status: 200 }),
        ),
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
