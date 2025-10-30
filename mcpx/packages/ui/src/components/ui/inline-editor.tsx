import React, { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { Textarea } from "./textarea";


interface InlineEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  onChange?: (newValue: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  autoWrap?: boolean; // New prop for auto-wrapping at 50 characters
}

export const InlineEditor: React.FC<InlineEditorProps> = ({
  value,
  onSave,
  onChange,
  placeholder = "",
  multiline = false,
  className = "",
  style = {},
  disabled = false,
  autoWrap = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Function to wrap text at 50 characters
  const wrapTextAt50Chars = (text: string): string => {
    if (!autoWrap || text.length <= 50) return text;
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + word).length <= 50) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than 50 chars, force break
          lines.push(word.substring(0, 50));
          currentLine = word.substring(50);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  };

  // Update temp value when prop value changes
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      const element = multiline ? textareaRef.current : inputRef.current;
      if (element) {
        element.focus();
      }
    }
  }, [isEditing, multiline]);

  const startEditing = () => {
    if (disabled) return;
    setIsEditing(true);
    // Keep the same text format for consistent positioning
    setTempValue(value);
  };

  const saveEdit = () => {
    if (tempValue.trim() !== value.trim()) {
      const finalValue = autoWrap ? wrapTextAt50Chars(tempValue.trim()) : tempValue.trim();
      onSave(finalValue);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    // Keep the same text format for consistent positioning
    setTempValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline && !autoWrap) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Enter" && (multiline || autoWrap) && e.ctrlKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
    // For autoWrap mode, Enter creates new line (default behavior)
  };

  if (isEditing) {
    if (multiline || autoWrap) {
      return (
      <Textarea
        ref={textareaRef}
        value={tempValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setTempValue(newValue);
          onChange?.(newValue);
        }}
        onBlur={saveEdit}
        onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} resize-none`}
          style={{
            ...style,
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '4px',
            padding: '2px 4px',
            outline: 'none',
            boxShadow: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: autoWrap ? 'pre-wrap' : 'nowrap',
            wordBreak: autoWrap ? 'break-word' : 'normal'
          }}
          rows={autoWrap ? Math.max(2, (value.match(/\n/g) || []).length + 1) : 2}
        />
      );
    }

    return (
      <Input
        ref={inputRef}
        value={tempValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setTempValue(newValue);
          onChange?.(newValue);
        }}
        onBlur={saveEdit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        style={{
          ...style,
          backgroundColor: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '4px',
          padding: '2px 4px',
          outline: 'none',
          boxShadow: 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      />
    );
  }

  return (
    <div
      className={`group cursor-text transition-all duration-200 ${disabled ? 'cursor-default opacity-50' : ''}`}
      onClick={startEditing}
      style={{
        backgroundColor: 'transparent',
        border: '1px solid transparent',
        borderRadius: '4px',
        padding: '2px 4px',
        minHeight: '20px',
        display: 'block',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#F9FAFB';
          e.currentTarget.style.border = '1px solid #E5E7EB';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.border = '1px solid transparent';
        }
      }}
    >
      <div 
        className={`transition-colors duration-200 ${!disabled ? 'group-hover:text-blue-600' : ''}`} 
        style={{
          ...style,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: autoWrap ? 'pre-wrap' : 'nowrap',
          width: '100%',
          maxWidth: '400px',
          wordBreak: autoWrap ? 'break-word' : 'normal'
        }}
      >
        {autoWrap ? wrapTextAt50Chars(value || placeholder) : (value || placeholder)}
      </div>
    </div>
  );
};
