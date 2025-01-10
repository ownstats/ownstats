import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { ReportData } from "@/utils/QueryManager";
import BarList from "@/components/BarList";
import PageViewsVisitorsChart from "@/components/PageViewsVisitorsChart";
import WorldMap from "@/components/WorldMap";
import { LoadingSpinner } from "./ui/loading-spinner";

const valueFormatter = (number: number) => Intl.NumberFormat("us").format(number).toString();

const comparisonFormatter = (currentValue: number, comparisonValue: number) => {
  let operator = "";
  if (comparisonValue) {
    operator = currentValue > comparisonValue ? "+" : "";
    return `${operator}${Intl.NumberFormat("us").format(currentValue-comparisonValue).toString()}`;
  } else {
    operator = "+";
    return `${operator}${Intl.NumberFormat("us").format(currentValue).toString()}`;
  }
};

const formatSeconds = (time: number): string => {
  // Hours, minutes and seconds
  var hrs = ~~(time / 3600);
  var mins = ~~((time % 3600) / 60);
  var secs = ~~time % 60;

  // Output like "1:01" or "4:03:59" or "123:03:59"
  var ret = "";
  if (hrs > 0) {
      ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
  }
  ret += "" + String(mins).padStart(2, '0') + ":" + (secs < 10 ? "0" : "");
  ret += "" + secs;
  return ret;
}

// const getIndicator = (current: number, comparison: number): string => {
//   return current > comparison ? "moderateIncrease" : "moderateDecrease";
// }

type KPIsAndGraphProps = {
  data?: ReportData;
}

export default function KPIsAndGraph(props: KPIsAndGraphProps) {
  return (
    <>
    {!props.data && (
      <Card>
        <CardContent className="h-96">
          <div className="flex flex-col justify-center items-center gap-2 h-full">
            <LoadingSpinner />
            <div>Loading...</div>
          </div>
        </CardContent>
      </Card>
    )}
    {props.data && (
      <div>
        <Card className="py-0">
          <CardContent className="py-0 px-4">
          <div className="flex flex-row flex-wrap mt-4 gap-8 text-gray-700">
            <div className="flex flex-wrap items-baseline max-w-48 justify-between gap-x-4 gap-y-2 bg-white">
              <dt className="text-sm font-medium leading-4 text-gray-500">Pageviews</dt>
              <dd className="text-xs font-medium text-gray-700">{comparisonFormatter(props.data.aggregationComparison.currentPageviews, props.data.aggregationComparison.comparisonPageviews)}</dd>
              <dd className="w-full flex-none text-6xl font-semibold leading-10 tracking-tight text-gray-700">{valueFormatter(props.data.aggregationComparison.currentPageviews)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline max-w-48 justify-between gap-x-4 gap-y-2 bg-white">
              <dt className="text-sm font-medium leading-4 text-gray-500">Visitors</dt>
              <dd className="text-xs font-medium text-gray-700">{comparisonFormatter(props.data.aggregationComparison.currentVisitors, props.data.aggregationComparison.comparisonVisitors)}</dd>
              <dd className="w-full flex-none text-6xl font-semibold leading-10 tracking-tight text-gray-700">{valueFormatter(props.data.aggregationComparison.currentVisitors)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline max-w-48 justify-between gap-x-4 gap-y-2 bg-white">
              <dt className="text-sm font-medium leading-4 text-gray-500">Avg. visit time</dt>
              <dd className="text-xs font-medium text-gray-700">{comparisonFormatter(props.data.aggregationComparison.currentVisitDurationAvg, props.data.aggregationComparison.comparisonVisitDurationAvg)}s</dd>
              <dd className="w-full flex-none text-6xl font-semibold leading-10 tracking-tight text-gray-700">{formatSeconds(props.data.aggregationComparison.currentVisitDurationAvg)}</dd>
            </div>
          </div>

          <PageViewsVisitorsChart id="pageviewsAndVisitors" data={props.data} />
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-2 mt-2">
          <BarList id="pageviewsByPage" data={props.data.pageviewsByPage}/>
          <BarList id="pageviewsByReferrers" data={props.data.pageviewsByReferrers}/>
        </div>

        <div className="grid lg:grid-cols-3 gap-2 mt-2">
          <BarList id="visitorsByBrowsers" data={props.data.visitorsByBrowsers}/>
          <BarList id="visitorsByOS" data={props.data.visitorsByOS}/>
          <BarList id="visitorsByDeviceType" data={props.data.visitorsByDeviceType}/>
        </div>

        {/* <div className="grid lg:grid-cols-3 gap-2 mt-2">
          <div className="col-span-3 lg:col-span-2 flex flex-col">
            <WorldMap data={props.data.countries} id="visitorsByCountry"/>
          </div>
          <div className="col-span-3 lg:col-span-1 flex flex-col bg-red-400 relative overflow-y-auto max-h-96">
            <div className="text-lg">sdfsf</div>
            <div className="text-lg">sdfsf</div>
            <div className="text-lg">sdfsf</div>
            <div className="text-lg">sdfsf</div>
            <div className="text-lg">sdfsf</div>
            <div className="text-lg my-16">sdfsf</div>
            <div className="text-lg my-16">sdfsf</div>
            <div className="text-lg my-16">sdfsf</div>
          </div>
        </div> */}

        <div className="grid lg:grid-cols-3 gap-2 mt-2">
          <div className="col-span-3 lg:col-span-2 flex flex-col">
            <WorldMap data={props.data.countries} id="visitorsByCountry"/>
          </div>
          <div className="col-span-3 lg:col-span-1 flex flex-col">
            <BarList id="visitorsByCountry" data={props.data.visitorsByCountry}/>
          </div>
        </div>

        <div className="pb-4"></div>
      </div>
    )}
    </>
  );
}