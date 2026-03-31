"use client";

import { useMemo, useState } from "react";
import { DatePicker as MuiDatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { PickersDay } from "@mui/x-date-pickers/PickersDay";
import {
  PickersCalendarHeader,
  type PickersCalendarHeaderProps,
} from "@mui/x-date-pickers/PickersCalendarHeader";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { enGB } from "date-fns/locale/en-GB";
import { enUS } from "date-fns/locale/en-US";
import { CalendarDays } from "lucide-react";
import type { DateLocale } from "@/features/settings/date-locale";
import { cn } from "@/lib/utils";

type AppDatePickerProps = {
  ariaLabel: string;
  dateLocale?: DateLocale;
  disabled?: boolean;
  fullWidth?: boolean;
  highlightControl?: boolean;
  highlightedDateIsos?: string[];
  onChangeIso: (nextIso: string) => void;
  showClearAction?: boolean;
  valueIso: string;
};

type PickerDaySlotProps = React.ComponentProps<typeof PickersDay>;
type CalendarButtonSlotProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  ownerState?: unknown;
  sx?: unknown;
};
type PickerIconSlotProps = React.SVGProps<SVGSVGElement> & {
  ownerState?: unknown;
  sx?: unknown;
};

function parseIsoDate(valueIso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueIso)) {
    return null;
  }

  const [yearPart, monthPart, dayPart] = valueIso.split("-");
  const year = Number.parseInt(yearPart ?? "", 10);
  const month = Number.parseInt(monthPart ?? "", 10);
  const day = Number.parseInt(dayPart ?? "", 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatLocalIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function getMonthKeyFromDate(value: Date): string {
  return toMonthKey(value.getFullYear(), value.getMonth());
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function extractNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => extractNodeText(child)).join("");
  }

  if (node && typeof node === "object" && "props" in node) {
    return extractNodeText((node as { props?: { children?: React.ReactNode } }).props?.children ?? "");
  }

  return "";
}

function PickerCalendarIcon(props: PickerIconSlotProps) {
  const { ownerState, sx, ...iconProps } = props;
  void ownerState;
  void sx;
  return <CalendarDays {...iconProps} />;
}

export function DatePicker({
  ariaLabel,
  dateLocale = "en-GB",
  disabled = false,
  fullWidth = false,
  highlightControl = false,
  highlightedDateIsos = [],
  onChangeIso,
  showClearAction = true,
  valueIso,
}: AppDatePickerProps) {
  const value = useMemo(() => parseIsoDate(valueIso), [valueIso]);
  const [navigatedYear, setNavigatedYear] = useState<number | null>(null);
  const displayYear = navigatedYear ?? value?.getFullYear() ?? new Date().getFullYear();

  const highlightedDateSet = useMemo(() => new Set(highlightedDateIsos), [highlightedDateIsos]);
  const highlightedMonthSet = useMemo(
    () => new Set(highlightedDateIsos.map((dateIso) => dateIso.slice(0, 7))),
    [highlightedDateIsos],
  );
  const highlightedYearSet = useMemo(
    () => new Set(highlightedDateIsos.map((dateIso) => Number.parseInt(dateIso.slice(0, 4), 10))),
    [highlightedDateIsos],
  );
  const hasHighlightedDates = highlightedDateSet.size > 0;
  const monthLabelToIndex = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat(dateLocale, {
      month: "short",
      timeZone: "UTC",
    });
    const labels = new Map<string, number>();
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthLabel = monthFormatter
        .format(new Date(Date.UTC(2000, monthIndex, 1)))
        .toLowerCase()
        .replace(".", "")
        .trim();
      labels.set(monthLabel, monthIndex);
    }
    return labels;
  }, [dateLocale]);

  const DaySlot = useMemo(() => {
    const highlightedDays = highlightedDateSet;
    return function DaySlotComponent(dayProps: PickerDaySlotProps) {
      const iso = formatLocalIsoDate(dayProps.day);
      const isHighlighted = !dayProps.selected && highlightedDays.has(iso);

      return (
        <PickersDay
          {...dayProps}
          className={cn(
            dayProps.className,
            isHighlighted
              ? "!border-amber-500 !bg-amber-100 !text-amber-950 !font-semibold hover:!bg-amber-200 focus:!bg-amber-200"
              : "",
          )}
        />
      );
    };
  }, [highlightedDateSet]);

  const MonthButtonSlot = useMemo(() => {
    const highlightedMonths = highlightedMonthSet;
    const activeYear = displayYear;
    const monthMap = monthLabelToIndex;
    return function MonthButtonSlotComponent(props: CalendarButtonSlotProps) {
      const { ownerState, sx, className, children, ...buttonProps } = props;
      void ownerState;
      void sx;
      const monthLabel = extractNodeText(children).toLowerCase().replace(".", "").trim();
      const monthIndex = monthMap.get(monthLabel);
      const isSelected = className?.includes("MuiMonthCalendar-selected");
      const isHighlighted =
        !isSelected &&
        monthIndex !== undefined &&
        highlightedMonths.has(toMonthKey(activeYear, monthIndex));
      return (
        <button
          {...buttonProps}
          className={cn(
            "m-0.5 h-9 min-w-[4.25rem] rounded-md border px-2 text-sm transition-colors",
            className,
            isHighlighted ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200" : "",
          )}
        >
          {children}
        </button>
      );
    };
  }, [displayYear, highlightedMonthSet, monthLabelToIndex]);

  const YearButtonSlot = useMemo(() => {
    const highlightedYears = highlightedYearSet;
    return function YearButtonSlotComponent(props: CalendarButtonSlotProps) {
      const { ownerState, sx, className, children, ...buttonProps } = props;
      void ownerState;
      void sx;
      const year = Number.parseInt(extractNodeText(children).trim(), 10);
      const isSelected = className?.includes("MuiYearCalendar-selected");
      const isHighlighted = !isSelected && Number.isFinite(year) && highlightedYears.has(year);
      return (
        <button
          {...buttonProps}
          className={cn(
            "m-0.5 h-9 min-w-[4.25rem] rounded-md border px-2 text-sm transition-colors",
            className,
            isHighlighted ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200" : "",
          )}
        >
          {children}
        </button>
      );
    };
  }, [highlightedYearSet]);

  const CalendarHeaderSlot = useMemo(() => {
    const highlightedMonths = highlightedMonthSet;
    const shouldHighlight = highlightControl;
    return function CalendarHeaderSlotComponent(props: PickersCalendarHeaderProps) {
      const currentMonth = props.currentMonth as Date;
      const currentMonthHasMatch = highlightedMonths.has(getMonthKeyFromDate(currentMonth));
      const previousMonthHasMatch = highlightedMonths.has(getMonthKeyFromDate(addMonths(currentMonth, -1)));
      const nextMonthHasMatch = highlightedMonths.has(getMonthKeyFromDate(addMonths(currentMonth, 1)));
      const headerHighlightSx = shouldHighlight && hasHighlightedDates
        ? {
            paddingLeft: "0.5rem",
            paddingRight: "0.75rem",
            "& .MuiPickersCalendarHeader-labelContainer": {
              borderRadius: "9999px",
              border: "1px solid rgb(245 158 11)",
              backgroundColor: "rgb(254 243 199)",
              marginInlineStart: "0",
              paddingInlineStart: "0.75rem",
              paddingInlineEnd: "0.625rem",
              paddingBlock: "0.125rem",
            },
            "& .MuiPickersCalendarHeader-label": {
              marginLeft: "0.25rem",
              color: "rgb(120 53 15)",
              fontWeight: currentMonthHasMatch ? 700 : 600,
            },
            "& .MuiPickersArrowSwitcher-previousIconButton": previousMonthHasMatch
              ? {
                  border: "1px solid rgb(245 158 11)",
                  backgroundColor: "rgb(254 243 199)",
                  color: "rgb(124 45 18)",
                }
              : {},
            "& .MuiPickersArrowSwitcher-nextIconButton": nextMonthHasMatch
              ? {
                  border: "1px solid rgb(245 158 11)",
                  backgroundColor: "rgb(254 243 199)",
                  color: "rgb(124 45 18)",
                }
              : {},
            "& .MuiPickersArrowSwitcher-previousIconButton:hover": previousMonthHasMatch
              ? {
                  backgroundColor: "rgb(254 215 170)",
                }
              : {},
            "& .MuiPickersArrowSwitcher-nextIconButton:hover": nextMonthHasMatch
              ? {
                  backgroundColor: "rgb(254 215 170)",
                }
              : {},
          }
        : undefined;

      return (
        <PickersCalendarHeader
          {...props}
          slotProps={{
            ...props.slotProps,
            switchViewButton: {
              ...(props.slotProps?.switchViewButton as object | undefined),
              className: cn(
                (props.slotProps?.switchViewButton as { className?: string } | undefined)?.className,
                shouldHighlight && currentMonthHasMatch
                  ? "text-amber-950"
                  : "",
              ),
            },
          }}
          sx={headerHighlightSx ?? props.sx}
        />
      );
    };
  }, [hasHighlightedDates, highlightControl, highlightedMonthSet]);

  return (
    <LocalizationProvider
      dateAdapter={AdapterDateFns}
      adapterLocale={dateLocale === "en-US" ? enUS : enGB}
    >
      <MuiDatePicker
        value={value}
        views={["year", "month", "day"]}
        onChange={(nextValue) => {
          if (!nextValue) {
            onChangeIso("");
            return;
          }
          setNavigatedYear(nextValue.getFullYear());
          onChangeIso(formatLocalIsoDate(nextValue));
        }}
        onMonthChange={(nextMonth) => {
          setNavigatedYear(nextMonth.getFullYear());
        }}
        onYearChange={(nextYear) => {
          setNavigatedYear(nextYear.getFullYear());
        }}
        disabled={disabled}
        format={dateLocale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy"}
        closeOnSelect
        slots={{
          day: DaySlot,
          calendarHeader: CalendarHeaderSlot as never,
          monthButton: MonthButtonSlot as never,
          yearButton: YearButtonSlot as never,
          openPickerIcon: PickerCalendarIcon,
        }}
        slotProps={{
          actionBar: showClearAction
            ? {
                actions: ["clear"],
              }
            : {
                actions: [],
              },
          popper: {
            sx: {
              "& .MuiPaper-root": {
                border: highlightControl
                  ? "1px solid rgb(217 119 6)"
                  : "1px solid var(--border)",
                backgroundColor: "var(--popover)",
                color: "var(--popover-foreground)",
                borderRadius: "0.625rem",
                fontFamily: "inherit",
                boxShadow:
                  highlightControl
                    ? "0 12px 30px -12px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(217, 119, 6, 0.25)"
                    : "0 12px 30px -12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.04)",
                opacity: 1,
              },
              "& .MuiTypography-root": {
                fontFamily: "inherit",
              },
              "& .MuiIconButton-root": {
                color: "var(--foreground)",
              },
              "& .MuiPickersCalendarHeader-label": {
                color: "var(--foreground)",
              },
              "& .MuiDayCalendar-weekDayLabel": {
                color: "var(--muted-foreground)",
                fontWeight: 500,
              },
              "& .MuiPickersDay-root": {
                color: "var(--foreground)",
                borderRadius: "0.5rem",
              },
              "& .MuiPickersDay-root:not(.Mui-selected)": {
                backgroundColor: "transparent",
              },
              "& .MuiPickersDay-root:not(.Mui-selected):hover": {
                backgroundColor: "var(--accent)",
              },
              "& .MuiPickersDay-root.Mui-selected": {
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              },
              "& .MuiPickersDay-root.Mui-selected:hover": {
                backgroundColor: "color-mix(in oklab, var(--primary) 88%, black)",
              },
              "& .MuiPickersDay-root.Mui-disabled": {
                color: "color-mix(in oklab, var(--muted-foreground) 75%, transparent)",
              },
              "& .MuiPickersMonth-monthButton, & .MuiPickersYear-yearButton": {
                color: "var(--foreground)",
                borderColor: "var(--border)",
              },
              "& .MuiPickersMonth-monthButton.Mui-selected, & .MuiPickersYear-yearButton.Mui-selected": {
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
                borderColor: "var(--primary)",
              },
            },
          },
          textField: {
            inputProps: {
              "aria-label": ariaLabel,
            },
            size: "small",
            className: cn(
              highlightControl ? "rounded-lg bg-amber-50 ring-1 ring-amber-400/80" : "",
            ),
            sx: {
              width: fullWidth ? "100%" : "9.5rem",
              "& .MuiInputBase-root, & .MuiPickersInputBase-root": {
                height: "2rem",
                minHeight: "2rem",
                borderRadius: "0.625rem",
                backgroundColor: highlightControl ? "rgb(254 243 199)" : "var(--card)",
                color: highlightControl ? "rgb(120 53 15)" : "var(--foreground)",
                "& .MuiSvgIcon-root, & svg": {
                  fontSize: "1rem",
                  color: "var(--muted-foreground)",
                  stroke: "currentColor",
                },
              },
              "& .MuiPickersInputBase-sectionsContainer": {
                height: "100%",
                paddingTop: 0,
                paddingBottom: 0,
                alignItems: "center",
              },
              "& .MuiPickersSectionList-root, & .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersInputBase-separator":
                {
                  color: highlightControl ? "rgb(120 53 15)" : "var(--foreground)",
                  WebkitTextFillColor: highlightControl ? "rgb(120 53 15)" : "var(--foreground)",
                },
              "& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline": {
                borderColor: highlightControl ? "rgb(245 158 11)" : "var(--border)",
              },
              "& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline, & .MuiPickersInputBase-root:hover .MuiPickersOutlinedInput-notchedOutline":
                {
                borderColor: highlightControl ? "rgb(217 119 6)" : "var(--ring)",
              },
              "& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline, & .MuiPickersInputBase-root.Mui-focused .MuiPickersOutlinedInput-notchedOutline":
                {
                borderColor: highlightControl ? "rgb(217 119 6)" : undefined,
                borderWidth: highlightControl ? "1px" : undefined,
              },
              "& .MuiInputBase-input": {
                color: "var(--foreground)",
                WebkitTextFillColor: "var(--foreground)",
                fontSize: "0.875rem",
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: "10px",
                paddingRight: "10px",
                lineHeight: "1.25rem",
              },
              "& .MuiInputBase-root .MuiIconButton-root, & .MuiPickersInputBase-root .MuiIconButton-root": {
                color: highlightControl ? "rgb(120 53 15)" : "var(--muted-foreground)",
              },
              "& .MuiInputBase-root .MuiIconButton-root:hover, & .MuiPickersInputBase-root .MuiIconButton-root:hover":
                {
                  backgroundColor: highlightControl ? "rgb(254 215 170 / 0.45)" : "var(--accent)",
                },
            },
          },
        }}
      />
    </LocalizationProvider>
  );
}
