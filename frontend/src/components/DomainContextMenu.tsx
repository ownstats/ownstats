import { PropsWithChildren } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuPortal,
} from "@/components/ui/context-menu"

interface DomainContextMenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
}

interface DomainContextMenuProps extends PropsWithChildren {
  items: DomainContextMenuItem[]
}

export default function DomainContextMenu({ children, items } : DomainContextMenuProps) {
  

  return (
    <ContextMenu>
      <ContextMenuTrigger className="ContextMenuTrigger">{children}</ContextMenuTrigger>
      <ContextMenuPortal>
        <ContextMenuContent alignOffset={-5} className="bg-white border-2 border-gray-200 text-gray-700 rounded-md shadow-lg z-50 p-2">
          {items && items.map((item, index) => (
            <ContextMenuItem key={index} onSelect={item.onSelect} className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenuPortal>
    </ContextMenu>
  )
}
