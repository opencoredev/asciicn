"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Icon } from "@/components/icon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isPackageManager,
  PACKAGE_MANAGERS,
  usePackageManager,
} from "@/hooks/use-package-manager";
import type { PackageManager } from "@/hooks/use-package-manager";
import { cn } from "@/lib/utils";

const RUNNERS = {
  bun: "bunx --bun",
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "yarn dlx",
} as const satisfies Record<PackageManager, string>;

/** `shadcn add` for one or more item URLs, with package-manager tabs. */
export const InstallCommand = ({
  urls,
  className,
}: {
  urls: readonly string[];
  className?: string;
}) => {
  const [packageManager, setPackageManager] = usePackageManager();
  const command = `${RUNNERS[packageManager]} shadcn@latest add ${urls.join(" ")}`;

  return (
    <div
      className={cn(
        "bg-code text-code-foreground relative overflow-hidden rounded-sm border text-sm",
        className
      )}
    >
      <Tabs
        className="gap-0"
        value={packageManager}
        onValueChange={(value) => {
          if (isPackageManager(value)) {
            setPackageManager(value);
          }
        }}
      >
        <TabsList className="h-9 w-full justify-start gap-0 rounded-none border-b bg-transparent p-0 pr-10">
          {PACKAGE_MANAGERS.map((pm) => (
            <TabsTrigger
              key={pm}
              value={pm}
              className="text-muted-foreground hover:text-foreground data-[state=active]:text-foreground relative h-full flex-none rounded-none border-0 border-r px-3 font-mono text-xs transition-colors duration-150 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-(--ascii-ink) dark:data-[state=active]:border-0 dark:data-[state=active]:border-r dark:data-[state=active]:bg-transparent"
            >
              {pm}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="no-scrollbar overflow-x-auto px-4 py-3 pr-12">
        <code className="font-mono text-[13px] whitespace-nowrap">
          <span aria-hidden className="text-ink mr-[1ch] select-none">
            $
          </span>
          {command}
        </code>
      </div>
      <CopyButton
        value={command}
        event="install_command_copied"
        eventProperties={{
          component_name: urls
            .map(
              (url) =>
                url
                  .split("/")
                  .pop()
                  ?.replace(/\.json$/, "") ?? url
            )
            .join(","),
          package_manager: packageManager,
          section: "install_block",
        }}
        className="top-1 right-1"
      />
    </div>
  );
};

/** The "Manual" disclosure under an install command. */
export const ManualSteps = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger className="group/manual text-muted-foreground hover:text-foreground -mx-2 inline-flex h-8 items-center gap-1.5 rounded-xs px-2 font-mono text-xs transition-colors duration-150">
        Manual installation
        <Icon
          icon={ArrowDown01Icon}
          // The glyph sits inside empty viewBox; pull it into the padding.
          className="-mr-[3.5px] size-4 transition-transform duration-200 ease-(--ease-out) group-data-[state=open]/manual:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 motion-reduce:animate-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
