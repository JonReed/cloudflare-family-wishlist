type PageContentsLink = { href: string; label: string };

export function PageContents({
  label,
  links
}: {
  label: string;
  links: readonly PageContentsLink[];
}) {
  return (
    <nav className="page-contents" aria-label={label}>
      <p>On this page</p>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>
              <span>{link.label}</span>
              <span aria-hidden="true">↓</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
