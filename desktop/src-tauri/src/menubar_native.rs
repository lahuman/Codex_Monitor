// AppKit owns sharp text layout and semantic colors at the destination backing scale.
use crate::menubar::MenuColumn;
use objc2::{MainThreadMarker, MainThreadOnly, rc::Retained, runtime::Bool};
use objc2_app_kit::{
    NSAppearance, NSAppearanceCustomization, NSAttributedStringNSStringDrawing, NSColor, NSFont,
    NSImage, NSTextFieldCell,
};
use objc2_foundation::NSArray;
use objc2_foundation::{
    NSAttributedString, NSMutableAttributedString, NSPoint, NSRect, NSSize, NSString,
};

const HEIGHT: f64 = 22.0;
fn text(
    value: &str,
    font: &NSFont,
    color: &NSColor,
    mtm: MainThreadMarker,
) -> Retained<NSAttributedString> {
    // NSCell provides a typed, safe font-to-attributed-string boundary.
    let cell =
        NSTextFieldCell::initTextCell(NSTextFieldCell::alloc(mtm), &NSString::from_str(value));
    cell.setFont(Some(font));
    cell.setTextColor(Some(color));
    cell.attributedStringValue()
}
#[derive(Debug, PartialEq)]
enum QuotaTone {
    Green,
    Yellow,
    Orange,
    Red,
    Neutral,
}
fn quota_tone(value: Option<f64>) -> QuotaTone {
    match value {
        Some(v) if v.is_finite() && (0.0..=100.0).contains(&v) => {
            if v >= 50.0 {
                QuotaTone::Green
            } else if v >= 25.0 {
                QuotaTone::Yellow
            } else if v >= 10.0 {
                QuotaTone::Orange
            } else {
                QuotaTone::Red
            }
        }
        _ => QuotaTone::Neutral,
    }
}
fn quota_color(value: Option<f64>) -> Retained<NSColor> {
    let tone = quota_tone(value);
    let dark = NSString::from_str("NSAppearanceNameDarkAqua");
    let light = NSString::from_str("NSAppearanceNameAqua");
    let matched = NSAppearance::currentDrawingAppearance()
        .bestMatchFromAppearancesWithNames(&NSArray::from_retained_slice(&[dark.clone(), light]));
    if matched.as_deref() != Some(dark.as_ref()) {
        // Keep yellow/orange text legible against a light menu-bar background.
        let rgb = match tone {
            QuotaTone::Green => Some((0.13, 0.48, 0.22)),
            QuotaTone::Yellow => Some((0.58, 0.43, 0.0)),
            QuotaTone::Orange => Some((0.72, 0.32, 0.0)),
            QuotaTone::Red => Some((0.78, 0.16, 0.14)),
            QuotaTone::Neutral => None,
        };
        if let Some((r, g, b)) = rgb {
            return NSColor::colorWithSRGBRed_green_blue_alpha(r, g, b, 1.0);
        }
    }
    match tone {
        QuotaTone::Green => NSColor::systemGreenColor(),
        QuotaTone::Yellow => NSColor::systemYellowColor(),
        QuotaTone::Orange => NSColor::systemOrangeColor(),
        QuotaTone::Red => NSColor::systemRedColor(),
        QuotaTone::Neutral => NSColor::labelColor(),
    }
}

pub(crate) fn render(
    columns: &[MenuColumn],
    mtm: MainThreadMarker,
    urgent: bool,
) -> Retained<NSImage> {
    let label_font = NSFont::systemFontOfSize(7.0);
    let quota_font = NSFont::systemFontOfSize_weight(12.0, 0.23);
    let nickname_color = if urgent {
        NSColor::systemRedColor()
    } else {
        NSColor::labelColor()
    };
    let texts = columns
        .iter()
        .map(|column| {
            let top = text(&column.label, &label_font, &nickname_color, mtm);
            let bottom = NSMutableAttributedString::new();
            if column.quota.is_empty() {
                bottom.appendAttributedString(&text("—", &quota_font, &NSColor::labelColor(), mtm));
            }
            for (index, value) in column.quota.iter().enumerate() {
                if index > 0 {
                    bottom.appendAttributedString(&text(
                        "/",
                        &quota_font,
                        &NSColor::labelColor(),
                        mtm,
                    ));
                }
                let label = value.map_or_else(|| "—".into(), |v| format!("{v:.0}%"));
                bottom.appendAttributedString(&text(
                    &label,
                    &quota_font,
                    &quota_color(*value),
                    mtm,
                ));
            }
            bottom.appendAttributedString(&text(
                &column.marker,
                &quota_font,
                &NSColor::labelColor(),
                mtm,
            ));
            let width = top.size().width.max(bottom.size().width) + 10.0;
            (top, bottom, width)
        })
        .collect::<Vec<_>>();
    let width = texts.iter().map(|(_, _, w)| w).sum::<f64>();
    // AppKit invokes this retained drawing recipe at the destination backing scale.
    // Do not rasterize with lockFocus or resize text after drawing.
    let draw = block2::RcBlock::new(move |_: NSRect| {
        let mut x = 0.0;
        for (top, bottom, w) in &texts {
            top.drawAtPoint(NSPoint::new(x + (w - top.size().width) / 2.0, 13.0));
            bottom.drawAtPoint(NSPoint::new(x + (w - bottom.size().width) / 2.0, -0.5));
            x += w;
        }
        Bool::YES
    });
    let image =
        NSImage::imageWithSize_flipped_drawingHandler(NSSize::new(width, HEIGHT), false, &draw);
    image.setTemplate(false);
    image
}
pub fn update(
    tray: &tauri::tray::TrayIcon,
    columns: &[MenuColumn],
    urgent: bool,
) -> tauri::Result<()> {
    let columns = columns.to_vec();
    tray.with_inner_tray_icon(move |inner| {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let Some(item) = inner.ns_status_item() else {
            return;
        };
        let Some(button) = item.button(mtm) else {
            return;
        };
        if columns.is_empty() {
            item.setLength(-1.0);
            button.setImage(None);
            button.setTitle(&NSString::from_str("계정 없음"));
            return;
        }
        let rendered = std::cell::RefCell::new(None);
        button
            .effectiveAppearance()
            .performAsCurrentDrawingAppearance(&block2::RcBlock::new(|| {
                rendered.replace(Some(render(&columns, mtm, urgent)));
            }));
        let Some(image) = rendered.into_inner() else {
            return;
        };
        button.setTitle(&NSString::new());
        button.setImage(Some(&image));
        item.setLength(image.size().width + 12.0);
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn percentage_tones_use_exact_valid_numeric_boundaries() {
        for (value, expected) in [
            (100., QuotaTone::Green),
            (50., QuotaTone::Green),
            (49.999, QuotaTone::Yellow),
            (25., QuotaTone::Yellow),
            (24.999, QuotaTone::Orange),
            (10., QuotaTone::Orange),
            (9.999, QuotaTone::Red),
            (0., QuotaTone::Red),
            (-1., QuotaTone::Neutral),
            (101., QuotaTone::Neutral),
            (f64::NAN, QuotaTone::Neutral),
            (f64::INFINITY, QuotaTone::Neutral),
        ] {
            assert_eq!(quota_tone(Some(value)), expected);
        }
        assert_eq!(quota_tone(None), QuotaTone::Neutral);
    }
}
