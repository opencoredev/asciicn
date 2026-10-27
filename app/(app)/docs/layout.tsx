import { DocsSidebar } from "@/components/docs-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { source } from "@/lib/source";

/**
 * Three panes split by full-height 1px rules, like a tiled terminal: the
 * file tree, the page, and (on wide screens) the page's outline.
 */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <SidebarProvider className="3xl:max-w-[1800px] mx-auto min-h-min w-full flex-1 items-start [--sidebar-width:248px] [--top-spacing:0] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:[--top-spacing:calc(var(--spacing)*2)]">
        <DocsSidebar tree={source.pageTree} />
        <div className="h-full w-full min-w-0">{children}</div>
      </SidebarProvider>
    </div>
  );
}
