## MODIFIED Requirements

### Requirement: Readable menu bar typography
Each macOS account item SHALL render its nickname on a smaller regular upper row and quota percentages on a larger medium-weight lower row, without a decorative token prefix before the percentage. Native drawing SHALL use the final logical size without resizing a pre-rasterized text image, retaining sharp glyphs at standard and Retina backing scales. Meaningful unknown, paused, stale and error state indicators SHALL remain distinct. Font styling SHALL be applied at the native rendering owner, retaining independently clickable account items, normal foreground adaptation and red urgent nicknames.

#### Scenario: Two-row quota item
- **WHEN** an account has remaining quota values of 49% and 72%
- **THEN** its compact nickname appears above larger medium-weight 49%/72% values without a leading decorative icon, and the entire item retains its account-specific click target.

#### Scenario: Native backing scale
- **WHEN** an item draws at standard or Retina scale in a light or dark appearance
- **THEN** text draws directly at that backing scale in its final 22-point canvas, with only urgent nicknames colored red and no scaled bitmap text.
