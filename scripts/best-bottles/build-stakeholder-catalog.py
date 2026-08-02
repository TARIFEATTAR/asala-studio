from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[2]
FIGURES = ROOT / "tmp/best-bottles-reference-production/figures"
PILOT = (
    ROOT
    / "tmp/best-bottles-reference-production/cylinder-six-role-pilot-v1"
    / "0c942ddb6c2dbd7dfc9d09dc76c642922734b5d55acb5069308d85b63f23ee05"
    / "references"
)
OUTPUT_DIR = ROOT / "output/pdf"
OUTPUT_PATH = OUTPUT_DIR / "best-bottles-project-and-image-system-update-2026-07-16.pdf"

CAP_ON = PILOT / (
    "GBSpry3mlClBlk__identity-cap-on__"
    "30219a2e8a6034fb4b55bcbcbcd76d8ed0bd0c60f02cc5bd1071a5286759cb3a.png"
)
CAP_OFF = PILOT / (
    "GBSpry3mlClBlk__pdp-cap-off-sidecar__"
    "cb57723673c9389aab618be65980117137b6b77c8146e9b998e7abd325719ef5.png"
)


PAGE_W, PAGE_H = landscape(letter)
MARGIN = 36

BONE = HexColor("#F6F2EC")
INK = HexColor("#191815")
WARM = HexColor("#BD9868")
WARM_LIGHT = HexColor("#E8D9C6")
MUTED = HexColor("#665F56")
GREEN = HexColor("#2D7D3B")
GREEN_LIGHT = HexColor("#E9F3E9")
RED = HexColor("#CA3B2B")
RED_LIGHT = HexColor("#F8E8E5")
BLUE = HexColor("#2A9EC4")
RULE = HexColor("#D7CEC3")


def paragraph(
    c: canvas.Canvas,
    text: str,
    x: float,
    y_top: float,
    width: float,
    *,
    size: float = 11,
    leading: float | None = None,
    color=INK,
    font: str = "Helvetica",
    alignment: int = TA_LEFT,
    bold: bool = False,
):
    style = ParagraphStyle(
        name="catalog",
        fontName="Helvetica-Bold" if bold else font,
        fontSize=size,
        leading=leading or size * 1.28,
        textColor=color,
        alignment=alignment,
        spaceAfter=0,
    )
    p = Paragraph(text, style)
    _, height = p.wrap(width, PAGE_H)
    p.drawOn(c, x, y_top - height)
    return height


def rounded_box(c, x, y, w, h, *, fill, stroke=None, radius=12, line_width=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(line_width)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1 if stroke else 0)


def draw_footer(c, page_number: int, section: str):
    c.setStrokeColor(RULE)
    c.setLineWidth(0.6)
    c.line(MARGIN, 22, PAGE_W - MARGIN, 22)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGIN, 10, "Best Bottles x Madison Studio - Project and Image System Update")
    right = f"{section}  |  {page_number}"
    c.drawRightString(PAGE_W - MARGIN, 10, right)


def draw_section_label(c, text: str, x=MARGIN, y=PAGE_H - 36):
    c.setFillColor(WARM)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x, y, text.upper())


def draw_title(c, title: str, subtitle: str | None = None):
    draw_section_label(c, "Best Bottles project update")
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 25)
    c.drawString(MARGIN, PAGE_H - 66, title)
    if subtitle:
        paragraph(c, subtitle, MARGIN, PAGE_H - 82, PAGE_W - 2 * MARGIN, size=10.5, color=MUTED)


def draw_image_contain(c, path: Path, x: float, y: float, w: float, h: float):
    image = ImageReader(str(path))
    iw, ih = image.getSize()
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")


def bullet_list(c, items, x, y_top, width, *, size=9.5, gap=7, color=INK):
    y = y_top
    for item in items:
        c.setFillColor(WARM)
        c.circle(x + 3, y - 5, 2, fill=1, stroke=0)
        used = paragraph(c, item, x + 12, y, width - 12, size=size, color=color)
        y -= used + gap
    return y


def draw_metric(c, x, y, w, h, value, label, note=None):
    rounded_box(c, x, y, w, h, fill=white, stroke=RULE, radius=11)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 21)
    c.drawString(x + 14, y + h - 28, value)
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(WARM)
    c.drawString(x + 14, y + h - 44, label.upper())
    if note:
        paragraph(c, note, x + 14, y + h - 52, w - 28, size=7.6, color=MUTED)


def cover_page(c):
    c.setFillColor(BONE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(INK)
    c.rect(0, PAGE_H - 248, PAGE_W, 248, fill=1, stroke=0)

    c.setFillColor(WARM)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, PAGE_H - 42, "BEST BOTTLES x MADISON STUDIO")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 34)
    c.drawString(MARGIN, PAGE_H - 92, "Project & Image")
    c.drawString(MARGIN, PAGE_H - 130, "Production Update")
    paragraph(
        c,
        "A launch-readiness summary and a clear view of the controlled system being built "
        "to produce faithful, consistent imagery across the full product catalog.",
        MARGIN,
        PAGE_H - 154,
        470,
        size=12,
        leading=16,
        color=HexColor("#D8D0C6"),
    )
    c.setFillColor(WARM)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, PAGE_H - 220, "JULY 2026")

    rounded_box(c, 532, PAGE_H - 221, 215, 170, fill=Color(1, 1, 1, alpha=0.05), stroke=WARM, radius=18)
    paragraph(
        c,
        "<b>The objective is not simply to generate attractive images.</b><br/><br/>"
        "It is to build a dependable catalog system in which every product appears to have "
        "been photographed in the same premium studio while remaining faithful to the actual SKU.",
        552,
        PAGE_H - 77,
        175,
        size=11,
        leading=14,
        color=white,
    )

    draw_metric(c, 36, 154, 166, 95, "2,247", "Bottle SKUs", "Approved launch catalog target described in this update.")
    draw_metric(c, 218, 154, 166, 95, "2 lanes", "Physical states", "Independent cap-on and cap-off sidecar production.")
    draw_metric(c, 400, 154, 166, 95, "4,493", "Studio PSD files", "Original professional archive audited and reconciled.")
    draw_metric(c, 582, 154, 166, 95, "2080 x 2288", "Native master", "One shared Bone-canvas production standard.")

    paragraph(
        c,
        "Built foundation. Controlled image architecture. A practical route to launch.",
        MARGIN,
        120,
        PAGE_W - 2 * MARGIN,
        size=17,
        bold=True,
        alignment=TA_CENTER,
    )
    paragraph(
        c,
        "Prepared for Abbas - from Abdul Jalil / Jordan Richter, ASALA",
        MARGIN,
        89,
        PAGE_W - 2 * MARGIN,
        size=9,
        color=MUTED,
        alignment=TA_CENTER,
    )
    draw_footer(c, 1, "Executive overview")


def platform_page(c):
    c.setFillColor(BONE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_title(
        c,
        "The platform foundation is built",
        "The remaining website work is launch completion and verification — not construction.",
    )

    col_w = (PAGE_W - 2 * MARGIN - 24) / 2
    x1, x2 = MARGIN, MARGIN + col_w + 24
    card_y = 140
    card_h = 324
    heading_y = 438
    bullets_y = 408
    callout_y = 156
    callout_h = 66

    rounded_box(c, x1, card_y, col_w, card_h, fill=white, stroke=RULE, radius=14)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x1 + 18, heading_y, "BUILT & HEALTHY")
    bullet_list(
        c,
        [
            "<b>Headless storefront</b>, homepage, catalog, and product-detail framework",
            "<b>Sanity CMS</b>, search and discovery, cart, and Shopify checkout handoff",
            "<b>Grace AI</b>, built and tested, with fitment and guided product tools",
            "Quote and sample flows, PDF catalog tools, customer portal, and internal operations",
            "SEO and analytics foundations with automated content-accuracy checks",
            "Unsupported claims removed, including unverified manufacturing and origin language",
        ],
        x1 + 18,
        bullets_y,
        col_w - 36,
        size=9.1,
        gap=8,
    )
    rounded_box(c, x1 + 18, callout_y, col_w - 36, callout_h, fill=GREEN_LIGHT, radius=9)
    paragraph(
        c,
        "<b>Bottom line:</b> a substantial and valuable platform exists today. Launch readiness "
        "now depends on closing integrations, data alignment, testing, and transfer.",
        x1 + 30,
        callout_y + callout_h - 17,
        col_w - 60,
        size=8.7,
        leading=11.5,
        color=GREEN,
    )

    rounded_box(c, x2, card_y, col_w, card_h, fill=white, stroke=RULE, radius=14)
    c.setFillColor(RED)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x2 + 18, heading_y, "LAUNCH-CRITICAL CLOSURE")
    bullet_list(
        c,
        [
            "Verify product and inventory synchronization plus the full production checkout path",
            "Integrate tax-exempt automation after the <b>TaxJar vs. Avalara</b> decision",
            "Connect <b>FedEx weight-based shipping</b> after carrier-account access",
            "Run Grace's final alignment pass against the locked launch catalog",
            "Connect GA4, Meta Pixel, and production error monitoring",
            "Complete final testing, training, documentation, and ownership transfer",
        ],
        x2 + 18,
        bullets_y,
        col_w - 36,
        size=9.1,
        gap=8,
    )
    rounded_box(c, x2 + 18, callout_y, col_w - 36, callout_h, fill=RED_LIGHT, radius=9)
    paragraph(
        c,
        "<b>Formally deferred:</b> Paper Doll moves to a later phase. Expanded image production, "
        "voice capabilities, and portal enhancements remain valuable but do not replace open SOW items.",
        x2 + 30,
        callout_y + callout_h - 17,
        col_w - 60,
        size=8.7,
        leading=11.5,
        color=RED,
    )
    draw_footer(c, 2, "Website status")


def system_page(c):
    c.setFillColor(BONE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_title(
        c,
        "The hard part is repeatability, not one beautiful image",
        "A catalog system must preserve the exact physical product across thousands of jobs and two product states.",
    )

    rounded_box(c, 36, 88, 284, 377, fill=INK, radius=14)
    c.setFillColor(WARM)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(56, 438, "THE SCALE OF THE PROBLEM")
    paragraph(
        c,
        "A one-off AI bottle image can take minutes.",
        56,
        411,
        244,
        size=19,
        leading=23,
        bold=True,
        color=white,
    )
    paragraph(
        c,
        "The real requirement is roughly <b>4,500 faithful catalog images</b>: cap-on and cap-off "
        "states across 2,247 SKUs, with no invented cap, altered sprayer, missing dip tube, "
        "resized bottle, or inconsistent thumbnail placement.",
        56,
        334,
        244,
        size=10.3,
        leading=14,
        color=HexColor("#D8D0C6"),
    )
    c.setStrokeColor(WARM)
    c.setLineWidth(2)
    c.line(56, 248, 296, 248)
    paragraph(
        c,
        "<b>Earlier:</b> the model was asked to preserve identity, improve materials, set the "
        "canvas, position the cap, create the background, and cast the shadow in one step.",
        56,
        226,
        244,
        size=9.2,
        leading=12,
        color=white,
    )
    paragraph(
        c,
        "<b>Now:</b> those responsibilities are separated into deterministic controls with a "
        "quality gate before approval.",
        56,
        157,
        244,
        size=9.2,
        leading=12,
        color=WARM_LIGHT,
    )

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(352, 449, "WHAT THE SYSTEM NOW CONTROLS")
    steps = [
        ("01", "Canonical measurements", "Body height, width, assembled height, and capacity are reconciled in millimeters."),
        ("02", "Geometry contract", "Each bottle receives a computed body box, center line, and shared baseline."),
        ("03", "Independent lanes", "Cap-on and cap-off run only from their own approved byte-locked references."),
        ("04", "Material-only improvement", "AI may improve glass, lighting, Bone background, highlights, and restrained shadow."),
        ("05", "Quality gate", "A visually attractive result is rejected when the physical product is wrong."),
    ]
    y = 412
    for number, heading, body in steps:
        rounded_box(c, 352, y - 45, 396, 56, fill=white, stroke=RULE, radius=10)
        rounded_box(c, 364, y - 34, 36, 36, fill=WARM, radius=8)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(382, y - 21, number)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(414, y - 10, heading)
        paragraph(c, body, 414, y - 18, 316, size=8.1, leading=10.4, color=MUTED)
        y -= 68

    rounded_box(c, 352, 47, 396, 33, fill=WARM_LIGHT, radius=10)
    paragraph(
        c,
        "<b>Result:</b> visual improvement without changing the product.",
        368,
        69,
        364,
        size=9.3,
        color=INK,
        alignment=TA_CENTER,
    )
    draw_footer(c, 3, "Image production system")


def figure_page(c, figure_path: Path, page_number: int, section: str):
    c.setFillColor(BONE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_image_contain(c, figure_path, 18, 28, PAGE_W - 36, PAGE_H - 46)
    c.setFillColor(Color(0, 0, 0, alpha=0.72))
    c.roundRect(PAGE_W - 58, 8, 40, 18, 8, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(PAGE_W - 38, 14, str(page_number))


def roadmap_page(c):
    c.setFillColor(BONE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_title(
        c,
        "A staged, measurable route to launch",
        "Website closure and premium image production advance as two coordinated tracks.",
    )

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(MARGIN, 436, "STATUS REPORTED IN THIS UPDATE")
    metrics = [
        ("60%", "Cylinder references fully verified", "Largest family moved from unverified to majority coverage in one day."),
        ("6 sizes", "Dual-lane validation set", "3, 5, 9, 25, 50, and 100 mL references available in both states."),
        ("~1,000", "Archive photos identity-matched", "Professional product photography recovered from descriptive filenames."),
    ]
    for i, (value, label, note) in enumerate(metrics):
        draw_metric(c, MARGIN + i * 244, 329, 226, 88, value, label, note)

    rounded_box(c, MARGIN, 70, 456, 239, fill=white, stroke=RULE, radius=13)
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN + 16, 288, "TRACK 1 - WEBSITE LAUNCH")
    timeline = [
        ("Week 1", "Decisions, access, and launch SKU list"),
        ("Weeks 1-3", "Product/inventory sync and production checkout"),
        ("Weeks 2-4", "Tax-exempt and FedEx integrations"),
        ("Weeks 3-4", "Grace alignment, analytics, and monitoring"),
        ("Weeks 5-6", "Testing, training, ownership transfer, approval"),
    ]
    y = 264
    for when, milestone in timeline:
        c.setFillColor(WARM)
        c.setFont("Helvetica-Bold", 8.2)
        c.drawString(MARGIN + 16, y, when)
        paragraph(c, milestone, MARGIN + 91, y + 2, 330, size=8.2, color=INK)
        y -= 31

    rounded_box(c, 512, 70, 244, 239, fill=INK, radius=13)
    c.setFillColor(WARM)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(528, 288, "TRACK 2 - IMAGE CATALOG")
    bullet_list(
        c,
        [
            "<b>Days 1-3:</b> six-size Cylinder validation",
            "<b>Days 1-10:</b> Cylinder, Elegant, Diva - 899 SKUs",
            "<b>Days 10-17:</b> Circle, Sleek, Round, Slim - 725 SKUs",
            "<b>Days 17-24:</b> remaining families - approximately 620 SKUs",
        ],
        528,
        263,
        212,
        size=8.3,
        gap=8,
        color=white,
    )

    draw_footer(c, 7, "Delivery roadmap")


def build():
    for source in [
        FIGURES / "two-lanes-diagram.png",
        FIGURES / "identity-vs-material.png",
        FIGURES / "quality-gate.png",
        CAP_ON,
        CAP_OFF,
    ]:
        if not source.exists():
            raise FileNotFoundError(source)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT_PATH), pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Best Bottles Project and Image Production Update")
    c.setAuthor("ASALA / Madison Studio")
    c.setSubject("Website launch readiness and controlled product-image production system")

    cover_page(c)
    c.showPage()
    platform_page(c)
    c.showPage()
    system_page(c)
    c.showPage()
    figure_page(c, FIGURES / "two-lanes-diagram.png", 4, "Two lanes")
    c.showPage()
    figure_page(c, FIGURES / "identity-vs-material.png", 5, "Identity vs material")
    c.showPage()
    figure_page(c, FIGURES / "quality-gate.png", 6, "Quality gate")
    c.showPage()
    roadmap_page(c)
    c.showPage()
    c.save()
    print(OUTPUT_PATH)


if __name__ == "__main__":
    build()
