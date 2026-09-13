import { TabBar } from "@/components/tab-bar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
      <TabBar />
    </div>
  );
}
