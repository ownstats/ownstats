"use client"

import { useState } from "react";
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange as DR } from "react-day-picker"
import QueryManager, { DateRange } from "@/utils/QueryManager";
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DatePickerProps = {
  currentDateRange: DateRange;
  queryManager: QueryManager;
  setCurrentDateRange: (value: DateRange) => void;
}

export default function DatePicker (props: DatePickerProps) {
  const [date, setDate] = useState<DR | undefined>({
    from: props.currentDateRange.startDate,
    to: props.currentDateRange.endDate,
  });

  return (
    <div className={cn("grid gap-2")}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto flex-col space-y-2 p-2" align="start">
          <Select
            onValueChange={(value) => {
              const dateRange = props.queryManager.getDateRangeByKey(value);
              props.setCurrentDateRange(dateRange);

              setDate({
                from: dateRange.startDate,
                to: dateRange.endDate,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent position="popper">
              {props.queryManager.getDateRanges().map((dateRange) => (
                <SelectItem key={dateRange.key} value={dateRange.key}>
                  {dateRange.name}
                </SelectItem>  
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-md border">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={(range: DR | undefined) => {
                if (range && range.from) {
                  // Create or update global custom data range
                  props.queryManager.setCustomDateRange(range.from, range.to);
                  // Update current date range
                  props.setCurrentDateRange(props.queryManager.getDateRanges().filter((dateRange) => dateRange.key === "custom")[0]);
                }

                setDate(range);
              }}
              numberOfMonths={1}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
