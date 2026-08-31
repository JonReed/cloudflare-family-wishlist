# Product design

## The feeling

Family Wishlist should feel like opening a parcel on the kitchen table: warm, useful, slightly
imperfect and unmistakably personal. It is a family tool, not a team dashboard or an online shop.

The interface uses paper, kraft tape, cotton string, gift tags and editorial still-life imagery as
quiet design cues. These materials should support the task rather than turn every control into a
novelty.

## Information architecture

The signed-in home has five stable regions:

1. **Identity:** the Family Wishlist mark, the current member and sign out.
2. **Orientation:** a short visual introduction that explains shared editing and private claims.
3. **Family selector:** one gift tag per member.
4. **Active wishlist:** one person's complete list at a time.
5. **Project footer:** source repository, licence, issue reporting, self-hosting and version.

Only one wishlist is rendered as the active working area. This prevents a family with many members
or long lists from becoming one enormous dashboard. The selected list is represented by a `list`
query parameter so it remains linkable and survives form actions.

The product model remains deliberately small: one member, one list. Birthdays, Christmas and other
occasions do not create separate list types. A wish can stay useful throughout the year.

Future household administration should be a separate, infrequently visited area. Member admission,
deployment setup and Access policy are operational concerns and should not make the everyday list
feel like an admin console.

## Core journeys

### Adding or improving an idea

Any admitted member can choose a person, add a wish or expand “Edit this wish”. Forms are disclosed
where they are needed rather than occupying the page by default. Titles, useful buying notes, an
optional link, an approximate price and a human description of priority are enough.

### Quietly buying a gift

On someone else's list, “I’ll get this” is a direct, reversible action. A claimant can mark the gift
bought or release it. Claims by another person are informative rather than actionable.

On the recipient's own list, claim data must not merely be hidden with CSS: it must be absent from
the server response. The small “Psst…” note explains the result without teaching the implementation.

### Finding the right person

Member navigation uses rectangular gift tags with a clear active state. Tags may wrap into additional
rows and must work with long display names. They are navigation, not filter chips.

## Visual language

### Type

- Display: Iowan Old Style with Palatino and Georgia fallbacks. Use it for the mark and important
  human headings.
- Interface: Avenir Next with Trebuchet and system fallbacks. Do not download third-party fonts; this
  keeps setup private, fast and self-contained.
- Small uppercase copy is reserved for labels and orientation, never paragraphs.

### Colour

- Canvas: warm wrapping-paper cream.
- Paper: quiet off-white.
- Ink: soft charcoal rather than pure black.
- Evergreen: the primary action and identity colour.
- Kraft: tape, edging and physical detail.
- Brick red: high-priority and destructive emphasis.
- Sage: ordinary priority and calm status.

Colours must retain sufficient contrast without resorting to saturated software-product blues.

### Shape and depth

- Corners are square or very slightly softened—never full capsules.
- Paper sheets may use grounded offset shadows, faint fibres and small rotations.
- Tape and string are occasional accents, not borders around every section.
- Wishlist items are rows separated by rules. They are not nested cards.
- Buttons are rectangular and tactile. Links remain recognisable as links.

### Imagery

The hero uses [`public/images/parcel-table.webp`](../public/images/parcel-table.webp), a purpose-built
editorial still life with year-round wrapping materials and negative space for the heading. It is a
decorative CSS background, so it does not add redundant alternative text.

New imagery should be natural, asymmetrical and materially believable. Avoid readable text, logos,
Christmas-only motifs, glossy catalogue lighting and perfect 3D-rendered parcels. Optimise assets to
WebP before committing them.

## Avoiding generic generated UI

Do not drift towards the common visual shorthand of generated SaaS pages:

- no purple or aurora gradients;
- no glowing blurred background orbs;
- no glass panels or backdrop-blur decoration;
- no centred marketing hero followed by three identical feature cards;
- no rows of pills or rounded filter chips;
- no nested rounded cards for every piece of content;
- no generic “streamline”, “unlock” or “revolutionise” copy;
- no fabricated testimonials, metrics or decorative analytics;
- no icon next to every heading simply to fill space.

Asymmetry must still be intentional, and tactile detail must never reduce legibility or keyboard use.

## Content voice

Copy is plain, warm British English. Prefer “wish”, “gift”, “family” and “quietly claim” to platform
language such as resource, workspace, role or permission. Empty states should be reassuring and
specific. Avoid forced whimsy: one human phrase is enough.

## Accessibility and interaction

- Use semantic headings, regions, lists, navigation and ordinary HTML forms.
- Maintain visible keyboard focus on every interactive element.
- Keep controls at least 44 CSS pixels high where they are primary touch targets.
- Do not rely on colour alone for priority, selection or claim state.
- Respect reduced-motion preferences.
- Preserve progressive enhancement: core list and claim actions must work without client JavaScript.
- Check both a 390-pixel mobile viewport and a 1280-pixel desktop viewport before release.

The design should continue to meet WCAG AA. Automated checks are a floor; long names, long wish
titles, expanded forms, empty lists and multiple family members all need visual review.
