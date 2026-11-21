import Header from "@/components/ui/header";

type MarketingLayoutProps = {
  children?: React.ReactNode;
  hasToken?: boolean;
};

export default function MarketingLayout({ children, hasToken = false }: MarketingLayoutProps) {
  return (
    <div
      className="relative flex min-h-dvh w-full flex-col text-foreground pb-10">
      <Header hasToken={hasToken} />
      <main
        className="flex w-full min-w-0 flex-1 flex-col z-2">
        {children}
      </main>
    </div>
  );
}
