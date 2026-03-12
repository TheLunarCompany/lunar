import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Edit3, X } from "lucide-react";

interface EditableBadgeProps {
  label?: React.ReactNode;
  value: string;
  onSave: (newValue: string) => void;
  onCancel?: () => void;
  badgeClassName?: string; // Tailwind classes to style the badge
  validate?: (nextValue: string) => string | null; // return error message or null if valid
}

export const EditableBadge: React.FC<EditableBadgeProps> = ({
  label,
  value,
  onSave,
  onCancel,
  badgeClassName = "",
  validate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  };

  const handleConfirm = () => {
    const maybeError = validate ? validate(draft) : null;
    if (maybeError) {
      setError(maybeError);
      return;
    }
    onSave(draft);
    setIsEditing(false);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDraft(value);
    setError(null);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleConfirm();
    else if (e.key === "Escape") handleCancel();
  };

  return (
    <div className="flex items-center gap-2">
      {label && (
        <div className="text-xl font-semibold px-4 py-2  text-gray-900">
          {label}
        </div>
      )}

      {isEditing ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-medium border bg-white text-gray-900 border-gray-300">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            className=" font-medium text-gray-900 px-0 py-0 h-6 border-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:outline-none"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "editable-badge-error" : undefined}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConfirm}
            className="p-1 h-6 w-6"
          >
            <Check className="w-3 h-3 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="p-1 h-6 w-6"
          >
            <X className="w-3 h-3 text-red-600" />
          </Button>
        </div>
      ) : (
        <>
          <div
            className={`inline-flex items-center px-4 py-2 rounded-lg text- font-medium border ${badgeClassName}`}
          >
            {value || "Unnamed"}
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
            aria-label="Edit"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        </>
      )}

      {error && (
        <div
          id="editable-badge-error"
          className="text-xs text-red-600 px-2 py-1 bg-red-50 border border-red-200 rounded"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default EditableBadge;
