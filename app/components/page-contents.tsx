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
      <p>Go straight to</p>
      <ol>
        {links.map((link, index) => (
          <li key={link.href}>
            <a href={link.href}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {link.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
