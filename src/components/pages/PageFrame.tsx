'use client';

type PageFrameProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export default function PageFrame({ title, action, children }: PageFrameProps) {
  return (
    <div className="mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
      <header className="mb-4 hidden items-center justify-between lg:flex">
        <h1 className="text-[24px] font-extrabold">{title}</h1>
        {action}
      </header>

      <header className="mb-4 flex items-center justify-between lg:hidden">
        <h1 className="text-[20px] font-extrabold">{title}</h1>
        {action}
      </header>

      {children}
    </div>
  );
}