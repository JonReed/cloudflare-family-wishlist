const strokes = {
  copy: 'M8 7h12v14H8z M5 17H3V3h12v1',
  picture: 'M3 4h18v16H3z M3 16l5-5 4 4 3-3 6 6 M16.5 8h.1',
  attention: 'M12 3 22 21H2z M12 9v5 M12 17h.1',
  'share-ios': 'M8 9H4v12h16V9h-4 M12 15V2.5 M8 6.5l4-4 4 4',
  'share-android':
    'M8 11l8-4.5 M8 13l8 4.5 M8.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z M21 5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z M21 19a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z',
  star: 'm11.5 2.5 3.1 6.2 7 .8-5 5 1.3 7-6.3-3.3-6.1 3.5.9-7-5-4.7 7-1.2z',
  tick: 'm4 12.5 5.1 5.2L20 6.3',
  'arrow-up-right': 'M5.5 18.5 18 6M7 6h11v11',
  chevron: 'm5.5 9 6.5 6.5L18.5 9',
  link: 'm9 15 6-6m-4.5-1.5 2.7-2.7a4.5 4.5 0 0 1 6.4 6.4l-2.7 2.7m-3.4 2.6-2.7 2.7a4.5 4.5 0 0 1-6.4-6.4l2.7-2.7'
} as const;

export function Icon({ name }: { name: keyof typeof strokes }) {
  return (
    <svg
      className="ui-icon"
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={strokes[name]} />
    </svg>
  );
}
