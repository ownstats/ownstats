import { HTMLAttributes } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { colord } from "colord";
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Country } from "@/utils/QueryManager";
import { QueryFilter, useQueryFilter } from "@/utils/QueryFilterProvider";
import { codeToCountryMapping } from "@/utils/Helpers";

const MAP_FILE = "/world.geojson";

export default function WorldMap({
  id,
  data,
  className,
  ...props
}: {
  id: string;
  data: Country[];
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const { filter, setFilter } = useQueryFilter();
  const sum = data?.reduce((acc, curr) => acc + curr.value, 0);

  const updateFilter = (value: string) => {
    // Create copy
    const currentFilter: QueryFilter = Object.assign(filter, {});
    // Check if filter for this group is already present
    if (Object.keys(currentFilter).includes(id)) {
      console.log(`Remove ${id}`);
      // If so, remove it
      delete currentFilter[id];
      // Set filter value
      setFilter({...currentFilter});
    } else {
      console.log(`Add ${id}`);
      // If not, set filter value
      currentFilter[id] = {
        columnName: "edge_country",
        value: value,
      }
      // Set filter value
      setFilter({...currentFilter});
    }
  }

  const getOpacity = (code: string) => {
    return code === 'aq' ? 0 : 1;
  };

  const getFillColor = (code: string) => {
    if (code === 'aq') return;

    const countryData = data?.find(({ country }) => country === code);

    // If no data, return white
    if (!countryData) {
      return "#ffffff";
    }

    const percentage = countryData.value / sum;

    // If percentage is 1, then the country is the only one in the list, so we color it sky-500
    // Base color is sky-200
    return percentage === 1 ? "#0ea5e9" : colord("#bae6fd").darken(1.5 * percentage).toHex();
  };

  return (
    <Card>
      <CardContent className="p-2">
        <div
          {...props}
          data-tip=""
          data-for="world-map-tooltip"
          className="overflow-hidden relative"
        >
          <ComposableMap projection="geoMercator">
            <ZoomableGroup zoom={0.8} minZoom={0.8} center={[0, 45]} filterZoomEvent={() => false}>
              <Geographies geography={`${MAP_FILE}`}>
                {({ geographies }) => {
                  return geographies.map((geo) => {
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getFillColor(geo.id)}
                        stroke={"#CCCCCC"}
                        opacity={getOpacity(geo.id)}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', fill: "#f3f4f6" },
                          pressed: { outline: 'none' },
                        }}
                        onClick={() => {
                          updateFilter(codeToCountryMapping[geo.id]);
                        }}
                        //onMouseOver={() => alert(codeToCountryMapping[geo.id] || geo.properties.name)}
                        // onMouseOut={() => setTooltipPopup(null)}
                      />
                    );
                  });
                }}
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>
      </CardContent>
    </Card>
  );
}
