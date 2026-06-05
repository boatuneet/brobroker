import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

export type PageBreadcrumbCrumb = {
  label: string;
  /* Provide an href to make this crumb a link. Omit on the last crumb so
     it renders as a BreadcrumbPage (current page). */
  href?: string;
};

/* Composes the standard breadcrumb pattern used across deep screens:
   a plain "Home" text link to the dashboard, followed by an ordered
   set of crumbs the page provides. The last crumb is treated as the
   current page (BreadcrumbPage) when no href is given on it. */
export function PageBreadcrumb({ items }: { items: PageBreadcrumbCrumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <PageBreadcrumbFragment
              isLast={isLast}
              item={item}
              key={`${item.label}-${index}`}
            />
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function PageBreadcrumbFragment({
  isLast,
  item,
}: {
  isLast: boolean;
  item: PageBreadcrumbCrumb;
}) {
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        {item.href && !isLast ? (
          <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
        ) : (
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
    </>
  );
}
