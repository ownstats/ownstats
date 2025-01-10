"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { PageviewsAndVisitors, ReportData } from "@/utils/QueryManager";
import { QueryFilter, useQueryFilter } from "@/utils/QueryFilterProvider";

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  pageviews: {
    label: "Pageviews",
    color: "#0ea5e9",
  },
  visitors: {
    label: "Visitors",
    color: "#ec4899",
  },
} satisfies ChartConfig

type KPIsAndGraphProps = {
  id: string;
  data?: ReportData;
}

const formatData = (data: PageviewsAndVisitors[]) => {
  return data.map((d) => ({
    "dateGranularity": d.dateGranularity,
    "Pageviews": d.pageviewsCnt,
    "Visitors": d.visitorsCnt,
  }))
}

export default function PageViewsVisitorsChart (props: KPIsAndGraphProps) {
  const { filter, setFilter } = useQueryFilter();

  const updateFilter = (value: string) => {
    // Create copy
    const currentFilter: QueryFilter = Object.assign(filter, {});
    // Check if filter for this group is already present
    if (Object.keys(currentFilter).includes(props.id)) {
      console.log(`Remove ${props.id}`);
      // If so, remove it
      delete currentFilter[props.id];
      // Set filter value
      setFilter({...currentFilter});
    } else {
      console.log(`Add ${props.id}`);
      // If not, set filter value
      currentFilter[props.id] = {
        columnName: "event_date",
        value: value,
      }
      // Set filter value
      setFilter({...currentFilter});
    }
  }

  return (
    <>
      {props.data && (
        <ChartContainer config={chartConfig} className="min-h-72 max-h-80 w-full my-4">
          <BarChart accessibilityLayer data={formatData(props.data.pageviewsAndVisitors)} onClick={(e) => updateFilter(e.activeLabel!)}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="dateGranularity"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              dataKey="Pageviews"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent indicator="dot" />}
            />
            <ChartLegend content={<ChartLegendContent verticalAlign="bottom"/>} />
            <Bar dataKey="Pageviews" fill="var(--color-pageviews)" radius={4} />
            <Bar dataKey="Visitors" fill="var(--color-visitors)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </>
  )
}
