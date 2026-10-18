# Sharp menu bar typography

## Why
The supplied screenshot shows our menu text blurred and heavier than the adjacent Stats CPU/GPU items. The native owner currently rasterizes using deprecated lockFocus then scales a 24pt image to 22pt, which resamples text.

## What Changes
Use resolution-independent drawing at the final 22pt size, a small regular name above medium-weight quota, and preserve urgency colors and independent account clicks.
