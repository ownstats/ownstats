import { useAuth } from "../hooks/useAuth";
import ApiCall from "../utils/ApiCall";
import { useEffect, useState } from "react";
import { TrashIcon, PlusIcon, CodeIcon, EllipsisVerticalIcon, Check, Copy } from "lucide-react";
import ownstatsConfig from "../ownstats.config.json";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import DomainContextMenu from "@/components/DomainContextMenu";
import { useDialog } from "@/hooks/useDialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Domain {
  domainName: string;
  createdTimestamp: string;
  domainKey: string;
}

export default function DomainsNew() {
  // State
  const [domains, setDomains] = useState<Domain[]>([]);
  const [deletableDomain, setDeletableDomain] = useState<string>();
  const [addableDomain, setAddableDomain] = useState<string>("");
  const [codeSnippetDomainKey, setCodeSnippetDomainKey] = useState<string>("");
  const [_deleteDomainOpen, setDeleteDomainOpen] = useState<boolean>(false);
  const [_addOpen, setAddOpen] = useState<boolean>(false);
  // Add new state for tracking if link was copied
  const [copied, setCopied] = useState(false);

   // Use auth
  const { getIdToken } = useAuth();

  const deleteDomainDialog = useDialog();
  const addDomainDialog = useDialog();
  const codeSnippetDialog = useDialog();

  const getDomains = async (): Promise<void> => {
    // Get id token
    const idToken = await getIdToken();

    // Send API call
    const domains: Domain[] = await ApiCall("/domains", "GET", idToken!.toString());

    // Set state
    setDomains(domains.sort((a, b) => new Date(a.createdTimestamp).getTime() - new Date(b.createdTimestamp).getTime()));
  }

  const deleteDomain = async () => {
    if (deletableDomain) {
      // Get id token
      const idToken = await getIdToken();

      // Send API call
      await ApiCall("/domains", "DELETE", idToken!.toString(), {
        domainName: deletableDomain,
      });
    }

    // Close modal
    setDeleteDomainOpen(false);

    // Remove deletable domain
    setDeletableDomain(undefined);

    // Reload
    window.location.reload();
  }

  const addDomain = async () => {
    if (addableDomain.length > 0) {
      // Get id token
      const idToken = await getIdToken();

      // Send API call
      await ApiCall("/domains", "POST", idToken!.toString(), {
        domainName: addableDomain,
      });
    }

    // Close modal
    setAddOpen(false);

    // Remove deletable domain
    setAddableDomain("");

    // Reload
    window.location.reload();
  }

  const getCodeSnippet = (domainKey: string): string => {
    return `<script src="https://${ownstatsConfig.cdn.domainName}/go.js" data-domainkey="${domainKey}" async></script>`
  }

  const copyToClipboard = (selectorId: string): void => {
    // Get copy text
    const copyText = document.getElementById(selectorId);
    // Copy to clipboard
    navigator.clipboard.writeText(copyText?.innerText ?? "");
    // Set copied to true
    setCopied(true);
    // Reset copied state after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    getDomains();
  }, [])
  useEffect(() => {
    console.log(deleteDomainDialog.props.open);
  }, [deleteDomainDialog.props.open])

  useEffect(() => {
    console.log(deletableDomain);
  }, [deletableDomain])

  return (
    <>
    <Dialog {...codeSnippetDialog.props}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Code snippet</DialogTitle>
          <DialogDescription className="flex flex-col gap-2 pt-2">
            Use the code snippet below to add the OwnStats tracking code to your website.
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full items-center space-x-2">
          <code className="text-sm sm:text-base inline-flex text-left items-center space-x-2 bg-gray-500 text-slate-200 rounded-md p-2 pl-2">
            <span className="text-sm" id="snippet-code">
              {getCodeSnippet(codeSnippetDomainKey)}
            </span>
          </code>
          <Button 
            type="submit" 
            variant="secondary"
            size="lg" 
            className={cn(
              "px-3 bg-gray-200 hover:bg-gray-300",
              copied && "bg-green-500 hover:bg-green-600"
            )}
            onClick={() => copyToClipboard('snippet-code')}
          >
            <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
            {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        
      </DialogContent>
    </Dialog>
    <Dialog {...addDomainDialog.props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new domain to OwnStats</DialogTitle>
          <DialogDescription className="flex flex-col gap-2 pt-2">
            This will add the domain to your OwnStats account. You can then use the code snippet context menu item to show the OwnStats tracking code for your website.
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Input type="text" placeholder="Domain name" value={addableDomain} onChange={(e) => setAddableDomain(e.target.value)}/>
          <Button type="submit" onClick={() => addDomain()}>Add domain</Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog {...deleteDomainDialog.props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you absolutely sure to delete this domain?</DialogTitle>
          <DialogDescription className="flex flex-col gap-2 pt-2">
            <p>This action cannot be undone, and the domain <strong>{deletableDomain}</strong> will be removed from your OwnStats account. This means you can no longer track this domain.</p>
            <p>You can add it again later, but the domain key will be different.</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">
              Close
              </Button>
            </DialogClose>
          <Button type="submit" onClick={() => deleteDomain()}>Delete domain</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Card>
      <CardContent className="flex flex-col min-h-96">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-700 ml-2 mt-4 mb-2">Domains</h1>
          <Button variant="default" className="ml-auto" onClick={() => addDomainDialog.trigger()}>
            <PlusIcon className="w-6 h-6"/>Add domain
          </Button>
        </div>
        {domains.length === 0 && (
          <div className="flex flex-col justify-center items-center gap-2 h-96">
            <LoadingSpinner />
            <div>Loading...</div>
          </div>
        )}
        {domains.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="">Domain Name</TableHead>
                <TableHead>Created at</TableHead>
                <TableHead>Domain Key</TableHead>
                <TableHead className="text-right w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => (
                <TableRow key={domain.domainKey} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{domain.domainName}</TableCell>
                  <TableCell>{domain.createdTimestamp.replace("T", " ").replace("Z", " UTC")}</TableCell>
                  <TableCell>{domain.domainKey}</TableCell>
                  <TableCell className="text-right" onContextMenu={event => event.preventDefault()}>
                    <DomainContextMenu items={[
                      { label: "Get code snippet", onSelect: () => { setCodeSnippetDomainKey(domain.domainKey); codeSnippetDialog.trigger(); }, icon: <CodeIcon className="w-4 h-4" /> },
                      { label: "Delete domain", onSelect: () => { setDeletableDomain(domain.domainName); deleteDomainDialog.trigger(); }, icon: <TrashIcon className="w-4 h-4" /> },
                    ]}>
                      <EllipsisVerticalIcon className="w-4 h-4"/>
                    </DomainContextMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
    </>
  );
}
