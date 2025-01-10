"use client"

import { Details } from "@/utils/QueryManager";
import { QueryFilter, useQueryFilter } from "@/utils/QueryFilterProvider";

import {
  Card,
  CardContent,
} from "@/components/ui/card"

export type BarListProps = {
  id: string;
  data: Details;
  height?: number;
}

export default function BarListNew(props: BarListProps) {
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
        columnName: props.data.metadata.columnName,
        value: value,
      }
      // Set filter value
      setFilter({...currentFilter});
    }
  }

  const isFiltered = (value: string): boolean => {
    return Object.keys(filter).includes(props.id) && filter[props.id].value === value;
  }

  return (
    <Card>
      <CardContent className="px-4 py-0">
        <div className={`mt-2 mb-4 h-full overflow-y-auto min-h-72 max-h-72`}>
          <div className="flex flex-row items-center">
            <div className="flex text-sm font-bold grow p-1">{props.data.metadata.header}</div>
            <div className="flex text-sm font-bold grow pl-4 max-w-32 justify-center">{props.data.metadata.metric}</div>
          </div>
          {props.data.records.map((record, index) => (
            <div className={`flex flex-row pl-2 pr-2 py-1 rounded ${isFiltered(record.name) ? "bg-gray-400 text-gray-50" : "bg-white"}`} key={index}>
              <div className="grow" onClick={(_event) => updateFilter(record.name)}>
                <div className={isFiltered(record.name) ? "text-sm font-bold" : "text-sm"}>{record.name}</div>
              </div>
              <div className="flex flex-row max-w-32">
                <div className="flex text-sm font-bold grow max-w-16 justify-end">
                  {record.value}
                </div>
                <div className="w-[2px] h-full bg-gray-300 text-sm ml-2"></div>
                <div className="flex grow min-w-12 max-w-16 relative z-0">
                  <p className={`text-sm ${isFiltered(record.name) ? "bg-pink-500" : "bg-pink-200"}`} style={{width: `${record.percentage}%`}}>&nbsp;</p>
                  <div className="absolute inset-0 flex justify-start items-center z-10">
                    <p className={`text-sm ml-2 ${isFiltered(record.name) ? "text-gray-50" : "text-gray-500"}`}>{record.percentage && record.percentage.toFixed(0) || 0}%</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
