"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

type CalendarProps = {
  captionLayout?: "dropdown";
  className?: string;
  mode: "single";
  onSelect?: (date: Date | undefined) => void;
  selected?: Date;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function Calendar({
  className,
  onSelect,
  selected,
}: CalendarProps) {
  const [visibleDate, setVisibleDate] = useState(selected ?? new Date());

  const visibleMonth = visibleDate.getMonth();
  const visibleYear = visibleDate.getFullYear();
  const years = Array.from({ length: 17 }, (_, index) => visibleYear - 8 + index);
  const days = getMonthDays(visibleYear, visibleMonth);

  function setMonth(nextMonth: number) {
    setVisibleDate(new Date(visibleYear, nextMonth, 1));
  }

  function setYear(nextYear: number) {
    setVisibleDate(new Date(nextYear, visibleMonth, 1));
  }

  function goToMonth(offset: number) {
    setVisibleDate(new Date(visibleYear, visibleMonth + offset, 1));
  }

  return (
    <div className={cn("w-[286px] rounded-[8px] border border-[#E7E7E7] bg-white p-3", className)}>
      <div className="flex items-center gap-2">
        <button
          aria-label="Previous month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5F625E] transition-colors hover:bg-[#F1F2EE]"
          onClick={() => goToMonth(-1)}
          type="button"
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_76px] gap-2">
          <select
            aria-label="Month"
            className="h-8 min-w-0 rounded-[8px] border border-[#D9DAD4] bg-white px-2 text-[13px] font-medium text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
            onChange={(event) => setMonth(Number(event.target.value))}
            value={visibleMonth}
          >
            {monthNames.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
          <select
            aria-label="Year"
            className="h-8 rounded-[8px] border border-[#D9DAD4] bg-white px-2 text-[13px] font-medium text-[#171719] outline-none focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
            onChange={(event) => setYear(Number(event.target.value))}
            value={visibleYear}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          aria-label="Next month"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5F625E] transition-colors hover:bg-[#F1F2EE]"
          onClick={() => goToMonth(1)}
          type="button"
        >
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {weekdayLabels.map((day) => (
          <div className="flex h-7 items-center justify-center text-[11px] font-medium text-[#8E918B]" key={day}>
            {day}
          </div>
        ))}
        {days.map((date, index) =>
          date ? (
            <button
              className={cn(
                "flex h-8 items-center justify-center rounded-[8px] text-[13px] font-medium text-[#171719] transition-colors hover:bg-[#F1F2EE]",
                isSameDate(date, new Date()) && "border border-[#D9DAD4]",
                selected && isSameDate(date, selected) && "border-[#171719] bg-[#171719] text-white hover:bg-[#171719]",
              )}
              key={date.toISOString()}
              onClick={() => onSelect?.(date)}
              type="button"
            >
              {date.getDate()}
            </button>
          ) : (
            <span aria-hidden="true" className="h-8" key={`empty-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const dayOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: dayOffset }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1)),
  ];
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
