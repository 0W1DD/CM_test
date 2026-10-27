import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDownIcon, Clock, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [timeInput, setTimeInput] = useState(
    value ? format(value, "HH:mm") : ""
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedDate(undefined);
      setTimeInput("");
      onChange(undefined);
      setOpen(false);
      return;
    }

    // If we have a time input, combine it with the selected date
    if (timeInput) {
      const timeParts = timeInput.split(":").map(Number);
      const hours = timeParts[0];
      const minutes = timeParts[1];
      if (hours !== undefined && minutes !== undefined && !Number.isNaN(hours) && !Number.isNaN(minutes)) {
        const newDate = new Date(date);
        newDate.setHours(hours, minutes, 0, 0);
        setSelectedDate(newDate);
        onChange(newDate);
      } else {
        setSelectedDate(date);
        onChange(date);
      }
    } else {
      setSelectedDate(date);
      onChange(date);
    }

    setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeInput(newTime);

    if (selectedDate && newTime) {
      const timeParts = newTime.split(":").map(Number);
      const hours = timeParts[0];
      const minutes = timeParts[1];
      if (hours !== undefined && minutes !== undefined && !Number.isNaN(hours) && !Number.isNaN(minutes)) {
        const newDate = new Date(selectedDate);
        newDate.setHours(hours, minutes, 0, 0);
        onChange(newDate);
      }
    }
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    setTimeInput("");
    onChange(undefined);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="w-full justify-between font-normal h-10"
            >
              <span className="flex items-center">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "날짜 선택"}
              </span>
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              captionLayout="dropdown"
              // The year menu otherwise stops at this year, so a community
              // could not end next year or later.
              startMonth={new Date(2020, 0)}
              endMonth={new Date(2100, 11)}
              defaultMonth={selectedDate}
              onSelect={handleDateSelect}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
            />
          </PopoverContent>
        </Popover>
        {selectedDate && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-8 top-0 h-full px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="relative sm:w-40">
        <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="time"
          value={timeInput}
          onChange={handleTimeChange}
          disabled={disabled || !selectedDate}
          className="pl-9 h-10"
        />
      </div>
    </div>
  );
}
