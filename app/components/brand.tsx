export function GiftIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M4 10h16v10H4zM2.8 6.5h18.4V10H2.8zM12 6.5V20" />
      <path d="M11.8 6.3C9.8 6.3 7.2 5.5 7.2 3.7c0-1 .8-1.7 1.8-1.5 1.7.3 2.6 2.3 2.8 4.1ZM12.2 6.3c2 0 4.6-.8 4.6-2.6 0-1-.8-1.7-1.8-1.5-1.7.3-2.6 2.3-2.8 4.1Z" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-mark">
        <GiftIcon className="size-6" />
      </span>
      <span className="brand-words">
        <span className="brand-name">Family Wishlist</span>
        <span className="brand-byline">For your favourite people</span>
      </span>
    </span>
  );
}
