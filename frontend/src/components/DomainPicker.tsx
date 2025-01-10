import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type DomainPickerProps = {
  domains: string[];
  currentDomain: string | undefined;
  setCurrentDomain: (value: string) => void;
}

export default function DomainPicker (props: DomainPickerProps) {
  return (
    <div className="mr-1">
      <Select value={props.currentDomain || "Loading..."} onValueChange={props.setCurrentDomain} disabled={props.domains.length === 0}>
        <SelectTrigger className="max-w-96 sm:min-w-36 md:min-w-64 lg:min-w-72 focus:ring-0 focus:ring-offset-0">
          <SelectValue placeholder="Select a domain"/>
        </SelectTrigger>
        <SelectContent>
          {props.domains && props.domains.map((domain: string, domainIndex: number) => (
            <SelectItem value={domain} key={domainIndex}>
              {domain}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
