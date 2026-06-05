import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* Breadcrumb primitives — small wrapper components that compose into a
   semantic nav. API matches the shadcn-ui shape so call sites read the
   same as the docs the broker shared:

     <Breadcrumb>
       <BreadcrumbList>
         <BreadcrumbItem>
           <BreadcrumbLink href="/" className="...icon button styling...">
             <HouseIcon className="size-4" />
             <span className="sr-only">Home</span>
           </BreadcrumbLink>
         </BreadcrumbItem>
         <BreadcrumbSeparator />
         <BreadcrumbItem>
           <BreadcrumbLink href="/buyers">Buyers</BreadcrumbLink>
         </BreadcrumbItem>
         <BreadcrumbSeparator />
         <BreadcrumbItem>
           <BreadcrumbPage>Helena Rossi</BreadcrumbPage>
         </BreadcrumbItem>
       </BreadcrumbList>
     </Breadcrumb>

   For the "home as icon button" pattern, pass a `className` to
   BreadcrumbLink instead of shadcn's `render` prop — keeps the API minimal
   while still giving custom callers full control over the visual. */

export function Breadcrumb({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0", className)}>
      {children}
    </nav>
  );
}

export function BreadcrumbList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] text-[#5F625E]",
        className,
      )}
    >
      {children}
    </ol>
  );
}

export function BreadcrumbItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {children}
    </li>
  );
}

/* BreadcrumbLink — `next/link` wrapped with the muted-but-hoverable
   styling used throughout the app. Callers can override styling entirely
   via `className`, which is how the "home as icon button" pattern is
   expressed (pass the icon-button class string). */
export function BreadcrumbLink({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cn(
        "inline-flex items-center gap-1 text-[#5F625E] transition-colors hover:text-[#171719]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

/* The current page — non-interactive, slightly heavier weight + ink color
   so it reads as "you are here". */
export function BreadcrumbPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-current="page"
      className={cn("truncate font-medium text-[#171719]", className)}
    >
      {children}
    </span>
  );
}

export function BreadcrumbSeparator({ className }: { className?: string }) {
  return (
    <li aria-hidden="true" className={cn("inline-flex text-[#A9ABA5]", className)}>
      <ChevronRight className="h-3.5 w-3.5" />
    </li>
  );
}
