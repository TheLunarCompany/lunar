import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EnvValue, MissingEnvVar } from "@/types";
import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AnimatePresence, motion } from "framer-motion";
import {
  LIST_ITEM_MOTION,
  TRANSITIONS,
  isLiteral,
} from "@mcpx/toolkit-ui/src/utils/env-vars-utils";
import { EnvVarRow } from "./EnvVarRow";
import { LiteralInput } from "./inputs";
import { EnvReferenceInput } from "./inputs/EnvReferenceInput";
import { useGetSecrets } from "@/data/secrets";
import {
  HEADER_PARAMS_EXTRACTION_REGEX,
  isValidHeaderTemplateString,
} from "@mcpx/shared-model";

type Segment =
  | { id: string; type: "literal"; value: string }
  | { id: string; type: "param"; value: string };

type HeaderEntry =
  | { kind: "envValue"; value: EnvValue }
  | { kind: "template"; segments: Segment[] };

export interface HeadersEditorProps {
  headers: Record<string, EnvValue>;
  onSave: (headers: Record<string, EnvValue>) => void;
  isSaving: boolean;
  hideTitle?: boolean;
  missingEnvVars?: MissingEnvVar[];
}

function hasTemplateParams(s: string): boolean {
  // New RegExp to avoid lastIndex drift if the shared regex has the `g` flag.
  return new RegExp(HEADER_PARAMS_EXTRACTION_REGEX.source).test(s);
}

function parseTemplate(template: string): Segment[] {
  // split() with a capturing group interleaves results: [literal, param, literal, param, ...]
  // so odd indices are param names, even indices are literals (can be empty strings "").
  return template
    .split(HEADER_PARAMS_EXTRACTION_REGEX)
    .map((part, i): Segment => {
      const id = crypto.randomUUID();
      return i % 2 === 1
        ? { id, type: "param", value: part }
        : { id, type: "literal", value: part };
    })
    .filter((seg) => seg.value.length > 0);
}

function assembleTemplate(segments: Segment[]): string {
  return segments
    .map((s) => (s.type === "param" ? `{{${s.value}}}` : s.value))
    .join("");
}

function initHeaderEntry(value: EnvValue): HeaderEntry {
  if (typeof value === "string" && hasTemplateParams(value)) {
    return { kind: "template", segments: parseTemplate(value) };
  }
  return { kind: "envValue", value };
}

function buildFinalValue(entry: HeaderEntry): EnvValue {
  if (entry.kind === "envValue") return entry.value;
  return assembleTemplate(entry.segments);
}

function toggleSegmentType(seg: Segment): Segment {
  return seg.type === "literal"
    ? { id: seg.id, type: "param", value: seg.value }
    : { id: seg.id, type: "literal", value: seg.value };
}

function makeSegment(type: "literal" | "param"): Segment {
  return { id: crypto.randomUUID(), type, value: "" };
}

function isParamSegmentMissing(
  missingEnvVars: MissingEnvVar[] | undefined,
  headerKey: string,
  seg: Segment,
): boolean {
  if (!missingEnvVars || seg.type !== "param" || !seg.value) return false;
  return missingEnvVars.some(
    (mv) =>
      mv.key === headerKey &&
      mv.type === "fromEnv" &&
      mv.fromEnvName === seg.value,
  );
}

function hasAnyMissingSegment(
  missingEnvVars: MissingEnvVar[] | undefined,
  headerKey: string,
  segments: Segment[],
): boolean {
  return segments.some((seg) =>
    isParamSegmentMissing(missingEnvVars, headerKey, seg),
  );
}

function TemplatePreview({
  segments,
}: {
  segments: Segment[];
}): React.JSX.Element {
  return (
    <span className="font-mono text-xs">
      {segments.map((seg) => (
        <span key={seg.id}>
          <span
            className={
              seg.type === "param" ? "text-foreground" : "text-muted-foreground"
            }
          >
            {seg.type === "param"
              ? `{{${seg.value.trim() || "?"}}}`
              : seg.value}
          </span>
        </span>
      ))}
    </span>
  );
}

export const HeadersEditor = ({
  headers,
  onSave,
  isSaving,
  hideTitle,
  missingEnvVars,
}: HeadersEditorProps): React.JSX.Element => {
  const { data: secrets = [], isLoading: isSecretsLoading } = useGetSecrets();
  const [keyOrder] = useState<string[]>(() => Object.keys(headers));
  const [entries, setEntries] = useState<Record<string, HeaderEntry>>(() =>
    Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, initHeaderEntry(v)]),
    ),
  );
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});

  const [parsedLiteralIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    Object.values(entries).forEach((entry) => {
      if (entry.kind === "template") {
        entry.segments
          .filter((s) => s.type === "literal")
          .forEach((s) => ids.add(s.id));
      }
    });
    return ids;
  });

  const handleEnvValueChange = useCallback(
    (key: string, value: EnvValue): void => {
      setEntries((prev) => ({ ...prev, [key]: { kind: "envValue", value } }));
    },
    [],
  );

  const clearHeaderError = useCallback((key: string): void => {
    setHeaderErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSegmentValueChange = useCallback(
    (headerKey: string, segId: string, value: string): void => {
      clearHeaderError(headerKey);
      setEntries((prev) => {
        const entry = prev[headerKey];
        if (!entry || entry.kind !== "template") return prev;
        return {
          ...prev,
          [headerKey]: {
            kind: "template",
            segments: entry.segments.map((seg) =>
              seg.id === segId ? { ...seg, value } : seg,
            ),
          },
        };
      });
    },
    [clearHeaderError],
  );

  const handleSegmentTypeToggle = useCallback(
    (headerKey: string, segId: string): void => {
      clearHeaderError(headerKey);
      setEntries((prev) => {
        const entry = prev[headerKey];
        if (!entry || entry.kind !== "template") return prev;
        return {
          ...prev,
          [headerKey]: {
            kind: "template",
            segments: entry.segments.map((seg) =>
              seg.id === segId ? toggleSegmentType(seg) : seg,
            ),
          },
        };
      });
    },
    [clearHeaderError],
  );

  const handleRemoveSegment = useCallback(
    (headerKey: string, segId: string): void => {
      clearHeaderError(headerKey);
      setEntries((prev) => {
        const entry = prev[headerKey];
        if (!entry || entry.kind !== "template") return prev;
        return {
          ...prev,
          [headerKey]: {
            kind: "template",
            segments: entry.segments.filter((seg) => seg.id !== segId),
          },
        };
      });
    },
    [clearHeaderError],
  );

  const handleAddSegment = useCallback(
    (headerKey: string, type: "literal" | "param"): void => {
      const newSeg = makeSegment(type);
      setEntries((prev) => {
        const entry = prev[headerKey];
        if (!entry || entry.kind !== "template") return prev;
        return {
          ...prev,
          [headerKey]: {
            kind: "template",
            segments: [...entry.segments, newSeg],
          },
        };
      });
    },
    [],
  );

  const handleToggleExpand = useCallback((key: string): void => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSave = (): void => {
    const newErrors: Record<string, string> = {};
    const result = Object.fromEntries(
      keyOrder.map((key) => {
        const entry = entries[key];
        const value: EnvValue =
          entry !== undefined ? buildFinalValue(entry) : null;
        if (
          entry?.kind === "template" &&
          typeof value === "string" &&
          !isValidHeaderTemplateString(value)
        ) {
          newErrors[key] =
            `Invalid empty value. Add a value or remove parameter.`;
        }
        return [key, value];
      }),
    );
    if (Object.keys(newErrors).length > 0) {
      setHeaderErrors(newErrors);
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        Object.keys(newErrors).forEach((k) => next.add(k));
        return next;
      });
      return;
    }
    setHeaderErrors({});
    onSave(result);
  };

  return (
    <div className="mb-4">
      {!hideTitle && (
        <div className="text-sm font-semibold text-foreground mb-3">
          Headers
        </div>
      )}
      <TooltipProvider>
        <div className="max-h-[40vh] 2xl:max-h-[55vh] overflow-y-auto space-y-3">
          <AnimatePresence initial={false} mode="sync">
            {keyOrder.map((key) => {
              const entry = entries[key];
              if (!entry) return null;

              if (entry.kind === "envValue") {
                return (
                  <motion.div
                    key={key}
                    layout
                    initial={LIST_ITEM_MOTION.initial}
                    animate={LIST_ITEM_MOTION.animate}
                    exit={LIST_ITEM_MOTION.exit}
                    transition={LIST_ITEM_MOTION.transition}
                  >
                    <EnvVarRow
                      envKey={key}
                      value={entry.value}
                      requirement={{ kind: "optional", isSecret: false }}
                      missingInfo={missingEnvVars?.find((mv) => mv.key === key)}
                      onValueChange={handleEnvValueChange}
                      disabled={isSaving}
                      disableLiteralInput={isLiteral(entry.value)}
                      literalDisabledTooltip={
                        isLiteral(entry.value)
                          ? "Literal values can be edited only via json"
                          : undefined
                      }
                    />
                  </motion.div>
                );
              }

              const isExpanded = expandedKeys.has(key);

              return (
                <motion.div
                  key={key}
                  layout
                  initial={LIST_ITEM_MOTION.initial}
                  animate={LIST_ITEM_MOTION.animate}
                  exit={LIST_ITEM_MOTION.exit}
                  transition={LIST_ITEM_MOTION.transition}
                >
                  <div className="rounded-lg border border-border overflow-hidden bg-[#F3F5FA]">
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-lunar-purpleNew/10 px-1.5 py-0.5 rounded-[4px] w-fit">
                          <span className="text-xs text-lunar-purpleNew">
                            {key}
                          </span>
                        </div>
                        {hasAnyMissingSegment(
                          missingEnvVars,
                          key,
                          entry.segments,
                        ) && (
                          <TriangleAlert className="w-4 h-4 text-orange-500 shrink-0" />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => handleToggleExpand(key)}
                        disabled={isSaving}
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded ? "Collapse header" : "Expand header"
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    <motion.div
                      initial={false}
                      animate={{
                        height: isExpanded ? "auto" : 0,
                        opacity: isExpanded ? 1 : 0,
                      }}
                      transition={TRANSITIONS.expand}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        <TemplatePreview segments={entry.segments} />
                        {headerErrors[key] && (
                          <p className="text-xs text-red-500 mt-1">
                            {headerErrors[key]}
                          </p>
                        )}
                        {entry.segments.map((seg) => {
                          if (parsedLiteralIds.has(seg.id)) return null;
                          return (
                            <div key={seg.id} className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <RadioGroup
                                    name={`seg-mode-${seg.id}`}
                                    value={
                                      seg.type === "param"
                                        ? "fromEnv"
                                        : "literal"
                                    }
                                    onValueChange={(v) => {
                                      const nextType =
                                        v === "fromEnv" ? "param" : "literal";
                                      if (nextType !== seg.type) {
                                        handleSegmentTypeToggle(key, seg.id);
                                      }
                                    }}
                                    disabled={isSaving}
                                    className="flex flex-row gap-6"
                                  >
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <RadioGroupItem
                                        value="literal"
                                        id={`seg-literal-${seg.id}`}
                                      />
                                      <span className="text-sm text-foreground">
                                        Value
                                      </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <RadioGroupItem
                                        value="fromEnv"
                                        id={`seg-fromEnv-${seg.id}`}
                                      />
                                      <span className="text-sm text-foreground">
                                        Load from env
                                      </span>
                                    </label>
                                  </RadioGroup>
                                  {isParamSegmentMissing(
                                    missingEnvVars,
                                    key,
                                    seg,
                                  ) && (
                                    <TriangleAlert className="w-4 h-4 text-orange-500 shrink-0" />
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                  onClick={() =>
                                    handleRemoveSegment(key, seg.id)
                                  }
                                  disabled={isSaving}
                                  aria-label="Remove segment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                              {seg.type === "param" ? (
                                <div className="min-w-0">
                                  <EnvReferenceInput
                                    value={seg.value}
                                    onChange={(_mode, referenceName) =>
                                      handleSegmentValueChange(
                                        key,
                                        seg.id,
                                        referenceName,
                                      )
                                    }
                                    disabled={isSaving}
                                    secrets={secrets}
                                    isLoading={isSecretsLoading}
                                  />
                                  {isParamSegmentMissing(
                                    missingEnvVars,
                                    key,
                                    seg,
                                  ) && (
                                    <p className="text-amber-500 text-[10px] font-medium whitespace-nowrap">
                                      Missing Environment variable. Try another
                                      value or contact your admin.
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <LiteralInput
                                  value={seg.value}
                                  onChange={(value) =>
                                    handleSegmentValueChange(key, seg.id, value)
                                  }
                                  onLeaveEmpty={() => {}}
                                  isNull={false}
                                  disabled={isSaving}
                                  envKey={seg.id}
                                  isRequired={true}
                                  isSecret={false}
                                />
                              )}
                            </div>
                          );
                        })}

                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground h-7 px-2"
                            onClick={() => handleAddSegment(key, "literal")}
                            disabled={isSaving}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </TooltipProvider>
      <div className="mt-3 flex justify-end">
        <Button
          variant="default"
          size="sm"
          className="bg-lunar-purpleNew"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save & Connect"}
        </Button>
      </div>
    </div>
  );
};
