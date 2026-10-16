export function WishTitle({ itemId, title }: { itemId: string; title: string }) {
  const headingId = `wish-title-${itemId}`;

  return (
    <div className="wish-title" data-wish-title>
      <h3 id={headingId}>{title}</h3>
      <details className="wish-title-toggle" hidden>
        <summary aria-controls={headingId}>
          <span className="wish-title-show">Show full title</span>
          <span className="wish-title-less">Show less</span>
        </summary>
      </details>
    </div>
  );
}
