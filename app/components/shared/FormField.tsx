import type { ReactNode } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

interface BaseFormFieldProps {
  /**
   * Field label
   */
  label: string;
  /**
   * Field ID (also used as htmlFor in label)
   */
  id: string;
  /**
   * Whether the field is required
   * @default false
   */
  required?: boolean;
  /**
   * Error message to display
   */
  error?: string;
  /**
   * Help text to display below the field
   */
  helpText?: string;
}

interface InputFormFieldProps extends BaseFormFieldProps {
  type: "text" | "email" | "password" | "number";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface TextareaFormFieldProps extends BaseFormFieldProps {
  type: "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}

interface CustomFormFieldProps extends BaseFormFieldProps {
  type: "custom";
  children: ReactNode;
}

type FormFieldProps =
  | InputFormFieldProps
  | TextareaFormFieldProps
  | CustomFormFieldProps;

/**
 * Reusable form field component with label, error, and help text
 */
export function FormField(props: FormFieldProps) {
  const { label, id, required = false, error, helpText } = props;

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {props.type === "custom" ? (
        props.children
      ) : props.type === "textarea" ? (
        <Textarea
          id={id}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          disabled={props.disabled}
          rows={props.rows}
          className={error ? "border-destructive" : ""}
        />
      ) : (
        <Input
          id={id}
          type={props.type}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          disabled={props.disabled}
          required={required}
          className={error ? "border-destructive" : ""}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
