

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const WWW_DIR = path.join(PROJECT_ROOT, 'public', 'hudlab');
const PLAYER_HEAD_OPTIONS_PATH = path.join(WWW_DIR, 'resources', 'data', 'playerheads.json');
const QC_HUDS_DIR = path.join(PROJECT_ROOT, 'public', 'huds');
const QC_HUDS_PREVIEWS_DIR = path.join(QC_HUDS_DIR, 'previews');
const QC_HUDS_METADATA_PATH = path.join(QC_HUDS_DIR, 'metadata.json');
const SESSIONS_FILE = path.join(PROJECT_ROOT, 'data', 'sessions.json');

// HUD Lab download/upload service (port 3002)
// Proxied by nginx for /hudlab/download.php and /hudlab/upload_hud.php

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const name = (parts[0] || '').trim();
        const value = (parts[1] || '').trim();
        if (name) cookies[name] = value;
    });
    return cookies;
}

function getSessionUser(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies.session;
    if (!sessionId) return null;

    try {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
        const sessions = JSON.parse(raw);

        // sessions.json is an array of [key, sessionData] pairs
        let session = null;
        if (Array.isArray(sessions)) {
            for (const entry of sessions) {
                if (Array.isArray(entry) && entry[0] === sessionId) {
                    session = entry[1];
                    break;
                }
            }
        } else if (sessions && typeof sessions === 'object') {
            session = sessions[sessionId];
        }

        if (!session) return null;
        if (session.expiresAt < Date.now()) return null;
        return session.user || null;
    } catch (e) {
        return null;
    }
}

function decodeColor(colorString) {
    if (!colorString) return false;
    const match = colorString.replace(/^#/, '').match(/^(\w{1,2})(\w{1,2})(\w{1,2})$/);
    if (!match) return false;
    const rgb = [];
    for (let i = 1; i <= 3; i++) {
        const hex = match[i].length === 1 ? match[i] + match[i] : match[i];
        rgb.push(Math.round(parseInt(hex, 16) / 255 * 10) / 10);
    }
    return rgb.join(' ');
}

function escapeMenuText(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, ' ');
}





function getWidescreen(m, rectOverride) {
    const mode = String(m && m.widescreen != null ? m.widescreen : '2');

    if (mode === '0') return '\twidescreen WIDESCREEN_STRETCH\n';
    if (mode === '1') return '\twidescreen WIDESCREEN_LEFT\n';
    if (mode === '3') return '\twidescreen WIDESCREEN_RIGHT\n';

    const coords = (rectOverride && typeof rectOverride === 'object') ? rectOverride : ((m && m.coordinates) || {});
    const left = parseFloat(coords.left || 0) || 0;
    const width = Math.max(0, parseFloat(coords.width || 0) || 0);
    const right = 640 - (left + width);

    // Auto mirrors Quake Live's 4:3 canvas expectations: edge items stay attached
    // to the edge in 16:9, center compositions remain centered, full-width blocks stretch.
    if (left <= 16 && right <= 16) return '\twidescreen WIDESCREEN_STRETCH\n';
    if (left <= 80 && left <= Math.max(16, right * 0.33)) return '\twidescreen WIDESCREEN_LEFT\n';
    if (right <= 80 && right <= Math.max(16, left * 0.33)) return '\twidescreen WIDESCREEN_RIGHT\n';

    return '\twidescreen WIDESCREEN_CENTER\n';
}


const FONT_MAP = { '0': 'FONT_DEFAULT', '1': 'FONT_SANS', '2': 'FONT_MONO' };
function getFont(m) {
    return FONT_MAP[String(m.font || '0')] || 'FONT_DEFAULT';
}


function getTextStyleName(val) {
    const styles = ['0', '1', '2', '3', '4', '5', '6'];
    return styles.includes(String(val)) ? String(val) : '3';
}

function getSkillRange(start, stop) {
    const arr = [];
    for (let i = start; i <= stop; i++) arr.push(i);
    return arr.join(',');
}

function getRangeColor(ranges, idx, end) {
    const i1 = idx * 2;
    const i2 = (end === undefined || end === null) ? i1 + 1 : end;
    for (const r of ranges) {
        if (r.range[0] <= i1 && r.range[1] >= i2) return r.color;
        if (r.range[1] === i1) return r.color;
    }
    return null;
}

const BAR_STEPS = 50;
const STATIC_PLAYER_HEAD_OPTIONS = loadPlayerHeadOptions();

function loadPlayerHeadOptions() {
    try {
        if (!fs.existsSync(PLAYER_HEAD_OPTIONS_PATH)) return [];
        const raw = fs.readFileSync(PLAYER_HEAD_OPTIONS_PATH, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Could not load player head options:', error.message);
        return [];
    }
}

function getBarOwnerdraw(item) {
    if (item.name === 'armorBar') return 'CG_PLAYER_ARMOR_VALUE';
    if (item.name === 'healthBar') return 'CG_PLAYER_HEALTH';
    return '';
}

function getBarLeftOffset(itm, idx) {
    const w = itm.coordinates.width - itm.padding * 2;
    const mw = w / BAR_STEPS;
    let offs = itm.padding;
    if (itm.barDirection === '1') {
        offs = w - Math.round(mw * idx) + itm.padding;
    }
    return offs;
}

function getBarTopOffset(itm, idx) {
    const h = itm.coordinates.height - itm.padding * 2;
    const mh = h / BAR_STEPS;
    let offs = itm.padding;
    if (itm.barDirection === '0' || itm.barDirection === '1') {
        const height = itm.coordinates.height - 0 * 2; // offset=0
        const barHeight = getBarHeight(itm, idx);
        offs = Math.round((offs - (barHeight - height) / 2) * 100) / 100;
    } else if (itm.barDirection === '3') {
        offs = h - Math.round(mh * idx) + itm.padding;
    }
    return offs;
}

function getBarWidth(itm, idx) {
    if (itm.barDirection === '0' || itm.barDirection === '1') {
        const offset = itm.padding;
        const width = itm.coordinates.width - offset * 2;
        const w = width / BAR_STEPS;
        return Math.round(w * idx * 100) / 100;
    } else {
        const w = itm.coordinates.width - 0 * 2;
        return Math.round(w * 1 * 100) / 100;
    }
}

function getBarHeight(itm, idx) {
    const height = itm.coordinates.height - 0 * 2;
    let barHeight;
    if (itm.barDirection === '0' || itm.barDirection === '1') {
        barHeight = Math.round((height * 8) / 7 * 100) / 100;
        return Math.round(barHeight * 1 * 100) / 100;
    } else {
        barHeight = Math.round(((height / BAR_STEPS) * 8) / 7 * 100) / 100;
        return Math.round(barHeight * idx * 100) / 100;
    }
}


function genHeader() {
    return '#include "ui/menudef.h"\n\n';
}

function genFooter() {
    return '\n';
}




const QL_FONT_BASE = 48;
const QL_OWNERDRAW_ASCENT = 46;
// All coordinate offsets set to 0 - canvas coordinates map directly to QL coordinates.
// Modern HUDs (forest.menu, radexql.menu) use direct rect positioning + textalign.
const INDICATOR_VALUE_OFFSET_X = 0;
const INDICATOR_VALUE_OFFSET_Y = 0;
const HEALTH_VALUE_EXTRA_OFFSET_Y = 0;
const ARMOR_VALUE_EXTRA_OFFSET_X = 0;
const HEAD_ICON_EXTRA_OFFSET_X = 0;
const TIMER_VALUE_OFFSET_X = 0;
const TIMER_VALUE_OFFSET_Y = 0;

function getQLTextHeight(textSize) {
    const textscale = (parseInt(textSize, 10) || 100) / 100;
    return Math.round(QL_FONT_BASE * textscale);
}

function getStaticPlayerHeadBackgroundByIndex(index) {
    const option = STATIC_PLAYER_HEAD_OPTIONS[index];
    if (!option) return null;
    return option.gamePath || null;
}

function getQLOwnerdrawAscent(textSize) {
    const textscale = (parseFloat(textSize, 10) || 100) / 100;
    return QL_OWNERDRAW_ASCENT * textscale;
}

function getQLOwnerdrawTextAlignY(textSize) {
    return round3(getQLOwnerdrawAscent(textSize));
}

function getOwnerdrawAnchor(rect, align) {
    const anchorRect = rect || { left: 0, top: 0, width: 0, height: 0 };
    let textAlignX;

    if (align === 'ITEM_ALIGN_LEFT') {
        textAlignX = anchorRect.left;
    } else if (align === 'ITEM_ALIGN_RIGHT') {
        textAlignX = anchorRect.left + anchorRect.width;
    } else {
        textAlignX = anchorRect.left + (anchorRect.width / 2);
    }

    return {
        textAlignX: round3(textAlignX),
        textAlignY: round3(anchorRect.top + anchorRect.height)
    };
}

function getOwnerdrawTextLayout(textSize, align, anchorRect) {
    const anchor = getOwnerdrawAnchor(anchorRect, align);
    const safeRect = anchorRect || { top: 0, height: 0 };
    const baseline = round3(safeRect.top + ((safeRect.height + getQLOwnerdrawAscent(textSize)) / 2));
    let out = `\t\talign ${align}\n`;
    out += `\t\ttextalignx ${anchor.textAlignX}\n`;
    out += `\t\ttextaligny ${baseline || getQLOwnerdrawTextAlignY(textSize)}\n`;
    return out;
}

function getQLOwnerdrawTop(textSize, visibleTop) {
    return Math.round((visibleTop + getQLOwnerdrawAscent(textSize)) * 1000) / 1000;
}

function getQLVisibleTextRectRect(visibleRect, options = {}) {
    const safeRect = visibleRect || { left: 0, top: 0, width: 0, height: 0 };
    const translatedHeight = round3(options.height !== undefined ? options.height : safeRect.height);
    const translatedWidth = round3(options.width !== undefined ? options.width : safeRect.width);
    const translatedLeft = round3(options.left !== undefined ? options.left : safeRect.left);
    const translatedTop = round3((safeRect.top || 0) + (safeRect.height || 0) + (options.topOffset || 0));

    return {
        left: translatedLeft,
        top: translatedTop,
        width: translatedWidth,
        height: translatedHeight
    };
}

function getIndicatorTextLift(rect) {
    const height = parseFloat(rect && rect.height || 0);
    return round3(Math.min(4, Math.max(3, height * 0.16)));
}

function getExpandedMenuSize(m, rects) {
    let width = Math.ceil(m.coordinates.width || 0);
    let height = Math.ceil(m.coordinates.height || 0);

    (rects || []).forEach((rect) => {
        if (!rect) return;

        const left = parseFloat(rect.left || 0);
        const top = parseFloat(rect.top || 0);
        const rectWidth = parseFloat(rect.width || 0);
        const rectHeight = parseFloat(rect.height || 0);

        width = Math.max(width, Math.ceil(left + rectWidth));
        height = Math.max(height, Math.ceil(top + rectHeight));
    });

    return { width, height };
}

function getVisibleMenuRect(m, rects) {
    const validRects = (rects || []).filter(Boolean);
    if (!validRects.length) {
        return {
            left: m.coordinates.left,
            top: m.coordinates.top,
            width: m.coordinates.width,
            height: m.coordinates.height,
            originLeft: 0,
            originTop: 0
        };
    }

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    validRects.forEach((rect) => {
        const left = parseFloat(rect.left || 0);
        const top = parseFloat(rect.top || 0);
        const width = parseFloat(rect.width || 0);
        const height = parseFloat(rect.height || 0);

        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
    });

    return {
        left: Math.round((m.coordinates.left + minLeft) * 1000) / 1000,
        top: Math.round((m.coordinates.top + minTop) * 1000) / 1000,
        width: Math.round((maxRight - minLeft) * 1000) / 1000,
        height: Math.round((maxBottom - minTop) * 1000) / 1000,
        originLeft: minLeft,
        originTop: minTop
    };
}

function toMenuRelativeRect(menuRect, rect, offsetLeft = 0, offsetTop = 0) {
    return {
        left: round3((rect.left || 0) - (menuRect.originLeft || 0) + offsetLeft),
        top: round3((rect.top || 0) - (menuRect.originTop || 0) + offsetTop),
        width: round3(rect.width || 0),
        height: round3(rect.height || 0)
    };
}

function hasVisibleRect(rect) {
    return !!(rect && (round3(rect.width) > 0 || round3(rect.height) > 0));
}

function getMenuGeometry(m, rectMap) {
    const sourceMap = rectMap || {};
    const keys = Object.keys(sourceMap);
    const rects = keys.map((key) => sourceMap[key]).filter(Boolean);
    const menuRect = getVisibleMenuRect(m, rects);
    const localRects = {};

    keys.forEach((key) => {
        localRects[key] = sourceMap[key] ? toMenuRelativeRect(menuRect, sourceMap[key]) : null;
    });

    return {
        menuRect,
        rects: localRects
    };
}

function getTextItemRects(m) {
    const fallbackRect = {
        left: 0,
        top: 0,
        width: round3(m.coordinates.width || 0),
        height: round3(m.coordinates.height || 0)
    };
    const prefixRect = normalizeSerializedRect(m.textCoordinates, null);
    const counterRect = normalizeSerializedRect(m.counterCoordinates, prefixRect || fallbackRect) || fallbackRect;

    return {
        prefixRect,
        counterRect
    };
}

function round3(value) {
    return Math.round((parseFloat(value || 0) || 0) * 1000) / 1000;
}

function menuDefRect(coords) {
    return `\trect ${Math.round(coords.left)} ${Math.round(coords.top)} ${Math.round(coords.width)} ${Math.round(coords.height)}\n`;
}

function hasSerializedRect(rect) {
    if (!rect) {
        return false;
    }

    return ['left', 'top', 'width', 'height'].some((key) => {
        const value = rect[key];
        return value !== undefined && value !== null && value !== '';
    });
}

function normalizeSerializedRect(rect, fallback) {
    if (!hasSerializedRect(rect)) {
        return fallback || null;
    }

    const safeFallback = fallback || { left: 0, top: 0, width: 0, height: 0 };

    return {
        left: round3(rect.left !== undefined && rect.left !== null ? rect.left : safeFallback.left),
        top: round3(rect.top !== undefined && rect.top !== null ? rect.top : safeFallback.top),
        width: round3(rect.width !== undefined && rect.width !== null ? rect.width : safeFallback.width),
        height: round3(rect.height !== undefined && rect.height !== null ? rect.height : safeFallback.height)
    };
}

function getRenderedTextRect(m) {
    const W = Math.round(m.coordinates.width || 0);
    const H = Math.round(m.coordinates.height || 0);
    const directRect = normalizeSerializedRect(
        m.counterCoordinates,
        normalizeSerializedRect(m.textCoordinates, { left: 0, top: 0, width: W, height: H })
    );

    // Prefer the exact geometry captured from the canvas so export matches the editor.
    if (directRect) {
        return directRect;
    }

    // Modern QL HUD pattern: text rect uses clean integer positions
    const iconSize = Math.round(parseFloat(m.iconSize) || 0);
    const iconRect = getRenderedIconRect(m);

    if (iconRect && iconSize > 0) {
        // Use serialized text position (accounts for iconSpacing) but round to integers
        const counterCoords = m.counterCoordinates || m.textCoordinates || {};
        const textLeft = Math.round(counterCoords.left || iconSize);
        const iconLeft = Math.round(iconRect.left);

        if (iconLeft < W / 2) {
            // Icon on left → text fills right portion from serialized position
            return { left: textLeft, top: 0, width: Math.max(W - textLeft, 0), height: H };
        }
        // Icon on right → text fills left portion
        return { left: 0, top: 0, width: Math.max(iconLeft, 0), height: H };
    }
    // No icon → text fills entire menuDef
    return { left: 0, top: 0, width: W, height: H };
}

function getRenderedIconRect(m) {
    const iconSize = Math.round(parseFloat(m.iconSize) || 0);
    if (iconSize <= 0) {
        return null;
    }

    const directRect = normalizeSerializedRect(m.iconCoordinates, null);
    if (directRect) {
        return {
            left: directRect.left,
            top: directRect.top,
            width: round3(directRect.width || iconSize),
            height: round3(directRect.height || iconSize)
        };
    }

    if (!m.iconCoordinates) {
        return null;
    }

    const H = Math.round(m.coordinates.height || 0);
    // Legacy fallback when older HUD data has only partial icon geometry.
    const iconLeft = Math.round(m.iconCoordinates.left || 0);
    const iconTop = Math.round(Math.max(0, (H - iconSize) / 2));

    return {
        left: iconLeft,
        top: iconTop,
        width: iconSize,
        height: iconSize
    };
}

function toAbsoluteRect(m, rect) {
    return {
        left: round3((m.coordinates.left || 0) + (rect.left || 0)),
        top: round3((m.coordinates.top || 0) + (rect.top || 0)),
        width: round3(rect.width || 0),
        height: round3(rect.height || 0)
    };
}

function findContainingRectangleBox(m, allItems) {
    if (!Array.isArray(allItems)) {
        return null;
    }

    const absTextRect = toAbsoluteRect(m, getRenderedTextRect(m));

    const matches = allItems.filter((candidate) => {
        if (!candidate || candidate.name !== 'rectangleBox' || !candidate.coordinates) {
            return false;
        }

        const box = candidate.coordinates;
        const epsilon = 1;

        return (
            absTextRect.left >= (box.left - epsilon) &&
            absTextRect.top >= (box.top - epsilon) &&
            (absTextRect.left + absTextRect.width) <= (box.left + box.width + epsilon) &&
            (absTextRect.top + absTextRect.height) <= (box.top + box.height + epsilon)
        );
    });

    if (!matches.length) {
        return null;
    }

    matches.sort((a, b) => {
        const areaA = (a.coordinates.width || 0) * (a.coordinates.height || 0);
        const areaB = (b.coordinates.width || 0) * (b.coordinates.height || 0);
        return areaA - areaB;
    });

    return matches[0] || null;
}





function getOwnerDrawFlag(m) {
    const flag = String(m.ownerDrawFlag || '0');
    return flag === '0' ? '' : `\townerdrawflag ${flag}\n`;
}

function genConfig(configName) {
    return `// Config file\n{\n  loadMenu { "ui/${configName}.menu" }\n}\n`;
}





function genHealthIndicator(m) {
    const iconOpacity = m.iconOpacity / 100;
    const textStyle = m.textStyle || '3';
    const rawTextRect = getRenderedTextRect(m);
    const textLift = getIndicatorTextLift(rawTextRect);
    const geometry = getMenuGeometry(m, {
        icon: getRenderedIconRect(m),
        text: {
            left: rawTextRect.left,
            top: round3(rawTextRect.top - textLift),
            width: rawTextRect.width,
            height: rawTextRect.height
        }
    });
    const menuRect = geometry.menuRect;
    const textRect = geometry.rects.text;
    const iconRect = geometry.rects.icon;
    const iconSize = round3(parseFloat(m.iconSize, 10) || 0);
    const needsCritical = m.iconStyle == 0 && iconRect && iconSize > 0 && iconOpacity > 0;
    const staticHeadBackground = getStaticPlayerHeadBackgroundByIndex(parseInt(m.iconStyle, 10) - 6);
    const criticalRect = needsCritical ? {
        left: round3(iconRect.left - 3),
        top: round3(iconRect.top - 3),
        width: round3(iconSize + 6),
        height: round3(iconSize + 6)
    } : null;
    const shadowRect = {
        left: round3(textRect.left + 1),
        top: round3(textRect.top + 1),
        width: textRect.width,
        height: textRect.height
    };

    let out = `\nmenuDef {\n\tname "healthIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m, menuRect);
    out += `\n`;
    out += `\titemDef {\n\t\tname "healthValueShadow"\n\t\trect ${shadowRect.left} ${shadowRect.top} ${shadowRect.width} ${shadowRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor 0 0 0 1\n`;
    out += `\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_PLAYER_HEALTH\n\t}\n\n`;

    out += `\titemDef {\n\t\tname "healthIndicatorCounter"\n\t\trect ${textRect.left} ${textRect.top} ${textRect.width} ${textRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n`;
    out += `\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_PLAYER_HEALTH\n`;
    for (const r of (m.colorRanges || [])) {
        out += `\t\taddColorRange ${r.range[0]} ${r.range[1]} ${decodeColor(r.color)} ${m.textOpacity / 100}\n`;
    }
    out += `\t}\n`;

    if (iconRect && iconSize > 0 && iconOpacity > 0) {
        if (criticalRect) {
            out += `\n\titemDef {\n\t\tname "healthIndicatorCritical"\n\t\trect ${criticalRect.left} ${criticalRect.top} ${criticalRect.width} ${criticalRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_SHADER\n\t\townerdrawflag CG_SHOW_HEALTHCRITICAL\n\t\tbackground "ui/assets/hud/healthalert"\n\t}\n`;
        }

        out += `\n\titemDef {\n\t\tname "healthIndicatorIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n`;
        if (m.iconStyle == 0) {
            out += `\t\tbackcolor 1 1 1 ${iconOpacity}\n\t\tbackground "ui/assets/hud/health.tga"\n`;
            if (m.teamColors) out += `\t\townerdraw CG_TEAM_COLORIZED\n`;
        } else if (m.iconStyle == 1) {
            out += `\t\townerdraw CG_PLAYER_HEAD\n`;
        } else if (m.iconStyle == 2) {
            out += `\t\tbackground "icons/iconh_green"\n`;
        } else if (m.iconStyle == 3) {
            out += `\t\tbackground "icons/iconh_yellow"\n`;
        } else if (m.iconStyle == 4) {
            out += `\t\tbackground "icons/iconh_red"\n`;
        } else if (m.iconStyle == 5) {
            out += `\t\tbackground "icons/iconh_mega"\n`;
        } else if (staticHeadBackground) {
            out += `\t\tbackcolor 1 1 1 ${iconOpacity}\n\t\tbackground "${staticHeadBackground}"\n`;
        }
        out += `\t}\n`;
    }

    out += `}\n`;
    return out;
}

function genArmorIndicator(m) {
    const iconOpacity = m.iconOpacity / 100;
    const textStyle = m.textStyle || '3';
    function getArmorIconBg(style) {
        if (style == 0) return 'ui/assets/hud/armor.tga';
        if (style == 2) return 'icons/iconr_green';
        if (style == 3) return 'icons/iconr_yellow';
        if (style == 4) return 'icons/iconr_shard';
        return null;
    }

    const rawTextRect = getRenderedTextRect(m);
    const textLift = getIndicatorTextLift(rawTextRect);
    const geometry = getMenuGeometry(m, {
        icon: getRenderedIconRect(m),
        text: {
            left: rawTextRect.left,
            top: round3(rawTextRect.top - textLift),
            width: rawTextRect.width,
            height: rawTextRect.height
        }
    });
    const menuRect = geometry.menuRect;
    const textRect = geometry.rects.text;
    const iconRect = geometry.rects.icon;
    const iconSize = round3(parseFloat(m.iconSize, 10) || 0);
    const shadowRect = {
        left: round3(textRect.left + 1),
        top: round3(textRect.top + 1),
        width: textRect.width,
        height: textRect.height
    };

    let out = `\nmenuDef {\n\tname "armorIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m, menuRect);
    out += `\n`;
    out += `\titemDef {\n\t\tname "armorValueShadow"\n\t\trect ${shadowRect.left} ${shadowRect.top} ${shadowRect.width} ${shadowRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor 0 0 0 1\n`;
    out += `\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_PLAYER_ARMOR_VALUE\n\t}\n\n`;

    out += `\titemDef {\n\t\tname "armorIndicatorCounter"\n\t\trect ${textRect.left} ${textRect.top} ${textRect.width} ${textRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n`;
    out += `\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_PLAYER_ARMOR_VALUE\n`;
    for (const r of (m.colorRanges || [])) {
        out += `\t\taddColorRange ${r.range[0]} ${r.range[1]} ${decodeColor(r.color)} ${m.textOpacity / 100}\n`;
    }
    out += `\t}\n`;

    if (iconRect && iconSize > 0 && iconOpacity > 0) {
        if (m.iconStyle == 0) {
            out += `\n\titemDef {\n\t\tname "armorIndicatorIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackcolor 1 1 1 ${iconOpacity}\n\t\tbackground "ui/assets/hud/armor.tga"\n`;
            if (m.teamColors) out += `\t\townerdraw CG_TEAM_COLORIZED\n`;
            out += `\t\tcvarTest "cg_armorTiered"\n\t\thideCvar { "1" }\n`;
            out += `\t}\n\n`;

            out += `\titemDef {\n\t\tname "armorIndicatorIconTiered"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackground "ui/assets/hud/armor.tga"\n`;
            out += `\t\townerdraw CG_ARMORTIERED_COLORIZED\n`;
            out += `\t\tcvarTest "cg_armorTiered"\n\t\tshowCvar { "1" }\n`;
            out += `\t}\n`;
        } else if (m.iconStyle == 1) {
            out += `\n\titemDef {\n\t\tname "armorIndicatorIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackcolor 1 1 1 ${iconOpacity}\n\t\tbackground "icons/iconr_red"\n\t}\n`;
        } else {
            const armorBg = getArmorIconBg(m.iconStyle);
            out += `\n\titemDef {\n\t\tname "armorIndicatorIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackcolor 1 1 1 ${iconOpacity}\n\t\tbackground "${armorBg}"\n\t}\n`;
        }
    }

    out += `}\n`;
    return out;
}
function genAmmoIndicator(m) {
    const textStyle = m.textStyle || '3';
    const rawTextRect = getRenderedTextRect(m);
    const textLift = getIndicatorTextLift(rawTextRect);
    const geometry = getMenuGeometry(m, {
        icon: getRenderedIconRect(m),
        text: {
            left: rawTextRect.left,
            top: round3(rawTextRect.top - textLift),
            width: rawTextRect.width,
            height: rawTextRect.height
        }
    });
    const menuRect = geometry.menuRect;
    const textRect = geometry.rects.text;
    const iconRect = geometry.rects.icon;
    const iconSize = round3(parseFloat(m.iconSize, 10) || 0);
    const shadowRect = {
        left: round3(textRect.left + 1),
        top: round3(textRect.top + 1),
        width: textRect.width,
        height: textRect.height
    };

    let out = `\nmenuDef {\n\tname "ammoIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m, menuRect);
    out += `\n`;
    out += `\titemDef {\n\t\tname "ammoValueShadow"\n\t\trect ${shadowRect.left} ${shadowRect.top} ${shadowRect.width} ${shadowRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\tforecolor 0 0 0 1\n\t\townerdraw CG_PLAYER_AMMO_VALUE\n\t}\n\n`;
    out += `\titemDef {\n\t\tname "ammoIndicatorCounter"\n\t\trect ${textRect.left} ${textRect.top} ${textRect.width} ${textRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\townerdraw CG_PLAYER_AMMO_VALUE\n`;
    for (const r of (m.colorRanges || [])) {
        out += `\t\taddColorRange ${r.range[0]} ${r.range[1]} ${decodeColor(r.color)} ${m.textOpacity / 100}\n`;
    }
    out += `\t}\n`;

    if (iconRect && iconSize > 0) {
        out += `\n\titemDef {\n\t\tname "ammoIndicatorIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\townerdraw CG_PLAYER_AMMO_ICON2D\n\t\tbackcolor 1 1 1 1\n\t}\n`;
    }

    out += `}\n`;
    return out;
}
function genTimer(m, allItems) {
    const textStyle = m.textStyle || '0';
    const geometry = getMenuGeometry(m, {
        icon: getRenderedIconRect(m),
        text: getRenderedTextRect(m)
    });
    const menuRect = geometry.menuRect;
    const iconRect = geometry.rects.icon;
    const textRect = geometry.rects.text;
    const ownerdrawRect = getQLVisibleTextRectRect(textRect);
    const shadowRect = getQLVisibleTextRectRect({
        left: round3(textRect.left + 1),
        top: round3(textRect.top + 1),
        width: textRect.width,
        height: textRect.height
    });

    let out = `\nmenuDef {\n\tname "timer"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m);
    out += `\n`;

    // Shadow
    out += `\titemDef {\n\t\tname "timerShadow"\n\t\trect ${shadowRect.left} ${shadowRect.top} ${shadowRect.width} ${shadowRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor 0 0 0 0.8\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_LEVELTIMER\n\t}\n\n`;

    // Main text
    out += `\titemDef {\n\t\tname "timerCounter"\n\t\trect ${ownerdrawRect.left} ${ownerdrawRect.top} ${ownerdrawRect.width} ${ownerdrawRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_LEVELTIMER\n\t}\n`;

    if (iconRect && m.iconOpacity > 0) {
        out += `\n\titemDef {\n\t\tname "timerIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackcolor 1 1 1 ${m.iconOpacity / 100}\n\t\tbackground "icons/icon_time.tga"\n\t}\n`;
    }
    out += `}\n`;
    return out;
}
function genRectangleBox(m) {
    const bgArray = ['', 'ui/assets/verticalgradient', 'ui/assets/hud/chatm.tga', 'ui/assets/halfgradright', 'ui/assets/halfgradleft'];
    let width = m.coordinates.width;
    let height = m.coordinates.height;
    if (width === 1 && m.hairLine) width = 0.5;
    if (height === 1 && m.hairLine) height = 0.5;

    let out = `\nmenuDef {\n\tname "box"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;

    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;

    if (m.borderRadius > 0 && m.rbox) {
        for (const box of m.rbox) {
            out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect ${box.left} ${box.top} ${box.width} ${box.height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n`;
            if (m.teamColors == 1) out += `\t\townerdrawflag CG_SHOW_ANYNONTEAMGAME\n`;
            out += `\t\tbackcolor ${decodeColor(m.color)} ${box.opacity / 100}\n\t}\n\n`;
            if (m.teamColors == 1) {
                out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect ${box.left} ${box.top} ${box.width} ${box.height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdrawflag CG_SHOW_IF_PLYR_IS_ON_RED\n\t\tbackcolor 0.4 0 0 ${box.opacity / 100}\n\t}\n`;
                out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect ${box.left} ${box.top} ${box.width} ${box.height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdrawflag CG_SHOW_IF_PLYR_IS_ON_BLUE\n\t\tbackcolor 0 0 0.4 ${box.opacity / 100}\n\t}\n`;
            }
        }
    }

    if (m.borderRadius == 0 || !m.borderRadius) {
        out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect 0 0 ${width} ${height}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n`;
        if (m.teamColors == 1) out += `\t\townerdrawflag CG_SHOW_ANYNONTEAMGAME\n`;
        out += `\t\tbackcolor ${decodeColor(m.color)} ${m.opacity / 100}\n`;
        if (m.boxStyle > 0) out += `\t\tbackground "${bgArray[m.boxStyle]}"\n`;
        out += `\t}\n`;

        if (m.teamColors == 1) {
            out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect 0 0 ${width} ${height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdrawflag CG_SHOW_IF_PLYR_IS_ON_RED\n\t\tbackcolor 0.4 0 0 ${m.opacity / 100}\n`;
            if (m.boxStyle > 0) out += `\t\tbackground "${bgArray[m.boxStyle]}"\n`;
            out += `\t}\n`;
            out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect 0 0 ${width} ${height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdrawflag CG_SHOW_IF_PLYR_IS_ON_BLUE\n\t\tbackcolor 0 0 0.4 ${m.opacity / 100}\n`;
            if (m.boxStyle > 0) out += `\t\tbackground "${bgArray[m.boxStyle]}"\n`;
            out += `\t}\n`;
        }
    }
    out += `}\n`;
    return out;
}

function genChatArea(m) {
    const bgArray = ['', 'ui/assets/hud/chatm.tga', 'ui/assets/hud/chatm.tga', 'ui/assets/halfgradright', 'ui/assets/halfgradleft'];
    let width = m.coordinates.width;
    let height = m.coordinates.height;
    let chatHeight = m.coordinates.height - 2 * m.padding;
    chatHeight = chatHeight < 120 ? 120 : chatHeight;
    const chatWidth = m.coordinates.width - 2 * m.padding;
    let chatTop = (chatHeight === 120) ? m.coordinates.height - chatHeight - m.padding : m.padding;
    chatTop -= 2;
    const chatLeft = m.padding;

    let out = `\nmenuDef {\n\tname "chatArea"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;

    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;

    if (m.borderRadius > 0 && m.rbox) {
        for (const box of m.rbox) {
            out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect ${box.left} ${box.top} ${box.width} ${box.height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdrawflag CG_SHOW_IF_CHAT_VISIBLE\n\t\tbackcolor ${decodeColor(m.color)} ${box.opacity / 100}\n\t}\n`;
        }
    }

    if (m.borderRadius == 0 || !m.borderRadius) {
        out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect 0 0 ${width} ${height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdrawflag CG_SHOW_IF_CHAT_VISIBLE\n\t\tbackcolor ${decodeColor(m.color)} ${m.opacity / 100}\n`;
        if (m.boxStyle > 0) out += `\t\tbackground "${bgArray[m.boxStyle]}"\n`;
        out += `\t}\n`;
    }

    out += `\titemdef {\n\t\tname chatWindow\n\t\townerdraw CG_AREA_NEW_CHAT\n\t\trect ${chatLeft} ${chatTop} ${chatWidth} ${chatHeight}\n\t\tvisible 1\n\t\tdecoration\n\t}\n}\n`;
    return out;
}


function genPowerupIndicator(m) {
    const position = m.iconPosition || 'left';
    const textStyle = m.textStyle || '3';
    let align = 'HUD_HORIZONTAL';
    let offset = (m.textCoordinates ? m.textCoordinates.width : 0) + (parseInt(m.iconSpacing, 10) || 0);
    if (position === 'right') {
        offset = -1 * (m.iconSize + m.coordinates.width + (parseInt(m.iconSpacing, 10) || 0));
    } else if (position === 'top') {
        align = 'HUD_VERTICAL';
        offset = parseInt(m.iconSpacing, 10) || 0;
    } else if (position === 'bottom') {
        align = 'HUD_VERTICAL';
        offset = -1 * (2 * m.iconSize + (parseInt(m.iconSpacing, 10) || 0));
    }

    let out = `\nmenuDef {\n\tname "powerupIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "powerupIndicatorArea"\n\t\trect ${m.iconCoordinates ? m.iconCoordinates.left : 0} ${m.iconCoordinates ? m.iconCoordinates.top : 0} ${m.iconSize} ${m.iconSize}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextscale ${m.textSize / 100}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextstyle ${textStyle}\n\t\townerdraw CG_AREA_POWERUP\n\t\tspecial ${offset}\n\t\talign ${align}\n\t}\n}\n`;
    return out;
}

function genCTFPowerupIndicator(m) {
    let out = `\nmenuDef {\n\tname "CTFPowerupIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;

    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "CTFPOWERUP"\n\t\trect 0 0 ${m.iconSize} ${m.iconSize}\n\t\tvisible 1\n\t\tdecoration\n\t\townerdraw CG_CTF_POWERUP\n\t}\n}\n`;
    return out;
}

function genFlagIndicator(m) {

    let out = `\nmenuDef {\n\tname "flagIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;

    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "flag"\n\t\trect 0 0 ${m.iconSize} ${m.iconSize}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n\t\townerdraw CG_PLAYER_HASFLAG\n\t}\n}\n`;
    return out;
}

function genObits(m) {
    const geometry = getMenuGeometry(m, {
        text: {
            left: 0,
            top: 0,
            width: round3(m.coordinates.width || 65),
            height: round3(m.coordinates.height || 15)
        }
    });
    const menuRect = geometry.menuRect;
    const itemRect = getQLVisibleTextRectRect(geometry.rects.text);
    let out = `\nmenuDef {\n\tname "obits"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getWidescreen(m, menuRect);
    out += `\n`;
    out += `\titemDef {\n\t\tname "obituaries"\n\t\trect ${itemRect.left} ${itemRect.top} ${itemRect.width} ${itemRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextscale .22\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_PLAYER_OBIT\n\t}\n}\n`;
    return out;
}

function genPlayerItem(m) {
    let out = `\nmenuDef {\n\tname "playerItem"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;

    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "playerItemIcon"\n\t\trect 0 0 ${m.iconSize} ${m.iconSize}\n\t\tvisible 1\n\t\tdecoration\n\t\townerdraw CG_PLAYER_ITEM\n\t}\n}\n`;
    return out;
}

function genMedal(m) {
    const icons = [
        'ui/assets/medal_accuracy.png', 'ui/assets/medal_gauntlet.png', 'ui/assets/medal_excellent.png',
        'ui/assets/medal_impressive.png', 'ui/assets/medal_capture.png', 'ui/assets/medal_assist.png',
        'ui/assets/medal_defend.png', 'menu/medals/medal_combokill.png', 'menu/medals/medal_damage.png',
        'menu/medals/medal_firstfrag.png', 'menu/medals/medal_headshot.png', 'menu/medals/medal_midair.png',
        'menu/medals/medal_perfect.png', 'menu/medals/medal_perforated.png', 'menu/medals/medal_quadgod.png',
        'menu/medals/medal_rampage.png', 'menu/medals/medal_revenge.png', 'menu/medals/medal_timing.png'
    ];
    const textStyle = m.textStyle || '3';
    const textRect = getRenderedTextRect(m);
    const iconRect = getRenderedIconRect(m);
    let out = `\nmenuDef {\n\tname "MedalValue"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "medalValue"\n\t\trect ${textRect.left} ${textRect.top} ${textRect.width} ${textRect.height}\n\t\tdecoration\n\t\tvisible 1\n\t\ttextalign 2\n\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t}\n`;

    if (iconRect && iconRect.width > 0 && m.iconOpacity > 0) {
        out += `\n\titemDef {\n\t\tname "medalIcon"\n\t\trect ${iconRect.left} ${iconRect.top} ${iconRect.width} ${iconRect.height}\n\t\tdecoration\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackcolor 1 1 1 ${m.iconOpacity / 100}\n`;
        out += `\t\tbackground "${icons[m.iconStyle] || icons[0]}"\n\t}\n`;
    }

    out += `}\n`;
    return out;
}

function genBarsHelper(m) {
    let out = `menuDef {\n\tname "box"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;

    out += menuDefRect(m.coordinates);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "boxBackground"\n\t\trect 0 0 ${m.coordinates.width} ${m.coordinates.height}\n\t\tvisible 1\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackcolor ${decodeColor(m.color)} ${m.opacity / 100}\n\t}\n\n`;

    for (let i = 0; i < BAR_STEPS; i++) {
        out += `\titemDef {\n\t\tname "bar_100_${i}"\n\t\tvisible 1\n`;
        out += `\t\trect ${getBarLeftOffset(m, i)} ${getBarTopOffset(m, i)} ${getBarWidth(m, i)} ${getBarHeight(m, i)}\n\n`;
        out += `\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackground "ui/assets/score/statsfillm"\n\t\tforecolor 0 0 0 0\n\t\townerdraw ${getBarOwnerdraw(m)}\n\n`;
        const rangeColor = getRangeColor(m.colorRanges || [], i);
        out += `\t\taddColorRange ${i * 2} ${i * 2 + 1} ${decodeColor(rangeColor)} ${m.barsOpacity / 100}\n\n\t}\n`;
    }

    out += `\titemDef {\n\t\tname "bar_100"\n\t\tvisible 1\n\t\trect 0 0 ${m.coordinates.width} ${getBarHeight(m, 1)}\n\n\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackground "ui/assets/score/statsfillm"\n\t\tforecolor 0 0 0 0\n\t\townerdraw CG_PLAYER_ARMOR_VALUE\n`;
    const rangeColor100 = getRangeColor(m.colorRanges || [], 100, 200);
    out += `\t\taddColorRange 100 200 ${decodeColor(rangeColor100)} ${m.barsOpacity / 100}\n\n\t}\n\n`;

    for (let i = 1; i <= BAR_STEPS; i++) {
        out += `\titemDef {\n\t\tname "bar_200_${i}"\n\t\tvisible 1\n`;
        out += `\t\trect ${getBarLeftOffset(m, i)} 0 ${Math.round((m.coordinates.width / BAR_STEPS) * i)} ${getBarHeight(m, i)}\n\n`;
        out += `\t\tstyle WINDOW_STYLE_FILLED\n\t\tbackground "ui/assets/score/statsfillm"\n\t\tforecolor 0 0 0 0\n\t\townerdraw CG_PLAYER_ARMOR_VALUE\n`;
        const c2 = (m.colorRanges && m.colorRanges[2]) ? decodeColor(m.colorRanges[2].color) : '1 1 1';
        out += `\t\taddColorRange ${100 + i * 2} ${101 + i * 2} ${c2} ${m.barsOpacity / 100}\n\n\t}\n`;
    }
    out += `}\n`;
    return out;
}

function readScoreBoxTemplate(style, m) {
    const filename = path.join(WWW_DIR, 'templates', `scoreBox_${style}.php`);
    try {
        let content = fs.readFileSync(filename, 'utf-8');
        const layout = m.scoreboxLayout || m.layout || 'vertical';
        const spacing = parseFloat(m.iconSpacing) || 0;
        let tailLeft = m.coordinates.left;
        let tailTop = m.coordinates.top + 16;

        if (layout === 'horizontal') {
            tailLeft = m.coordinates.left + 50 + spacing;
            tailTop = m.coordinates.top;
        } else if (layout === 'vertical') {
            tailLeft = m.coordinates.left;
            tailTop = m.coordinates.top + 16 + spacing;
        }

        content = content.replace(/<\?=\s*\$menuItem->coordinates->left\s*\?>/g, String(m.coordinates.left));
        content = content.replace(/<\?=\s*\$menuItem->coordinates->top\s*\?>/g, String(m.coordinates.top));
        content = content.replace(/<\?=\s*\$menuItem->coordinates->width\s*\?>/g, String(m.coordinates.width));
        content = content.replace(/<\?=\s*\$menuItem->coordinates->height\s*\?>/g, String(m.coordinates.height));
        content = content.replace(/<\?=\s*\$baseTop\s*\?>/g, String(m.coordinates.top));
        content = content.replace(/<\?=\s*\$baseLeft\s*\?>/g, String(m.coordinates.left));
        content = content.replace(/<\?=\s*\$tailLeft\s*\?>/g, String(tailLeft));
        content = content.replace(/<\?=\s*\$tailTop\s*\?>/g, String(tailTop));

        content = content.replace(/<\?[\s\S]*?\?>/g, '');


        const ws = getWidescreen(m);
        content = content.replace(/(menuDef\s*\{[^\n]*\n(?:\s*name\s+"[^"]+"\s*\n)?(?:\s*fullScreen\s+MENU_FALSE\s*\n)?(?:\s*visible\s+MENU_TRUE\s*\n)?(?:\s*rect\s+[^\n]+\n))/g, '$1' + ws);

        return content;
    } catch (e) {
        return `\n`;
    }
}

function genScoreBox(m) {
    const normalized = Object.assign({}, m, {
        scoreboxLayout: m.scoreboxLayout || m.layout || 'vertical',
        scoreboxMode: m.scoreboxMode || m.mode || 'ffa',
        iconSpacing: m.iconSpacing !== undefined && m.iconSpacing !== null ? m.iconSpacing : (m.spacing || 0),
        iconStyle: m.iconStyle !== undefined && m.iconStyle !== null ? m.iconStyle : (m.scoreboxStyle || 0)
    });
    const style = parseInt(normalized.iconStyle, 10);
    const safeStyle = [0, 1, 2].includes(style) ? style : 0;

    return readScoreBoxTemplate(safeStyle, normalized);
}

function genFlagWarning(m) {
    const textStyle = m.textStyle || '3';
    const menuWidth = round3(m.coordinates.width || 0);
    const menuHeight = round3(m.coordinates.height || 0);
    const halfH = round3(menuHeight / 2);
    const teamHasFlagRect = getQLVisibleTextRectRect({
        left: 0,
        top: 0,
        width: menuWidth,
        height: halfH
    });
    const enemyHasFlagRect = getQLVisibleTextRectRect({
        left: 0,
        top: halfH,
        width: menuWidth,
        height: halfH
    });

    let out = `\nmenuDef {\n\tname "flagWarning"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;

    out += `\titemDef {\n\t\tname "teamHasFlag"\n\t\trect ${teamHasFlagRect.left} ${teamHasFlagRect.top} ${teamHasFlagRect.width} ${teamHasFlagRect.height}\n\t\tvisible 1\n\t\ttextalign 1\n\t\tdecoration\n`;
    out += `\t\ttextstyle ${textStyle}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\tforecolor ${decodeColor(m.teamHasFlagColor)} ${(m.textOpacity || 100) / 100}\n`;
    out += `\t\ttextscale ${(m.textSize || 35) / 100}\n`;
    out += `\t\ttext "${m.teamHasFlag || 'WE HAVE THEIR FLAG!'}"\n`;
    out += `\t\townerdrawflag CG_SHOW_YOURTEAMHASENEMYFLAG\n\t}\n\n`;

    out += `\titemDef {\n\t\tname "enemyHasFlag"\n\t\trect ${enemyHasFlagRect.left} ${enemyHasFlagRect.top} ${enemyHasFlagRect.width} ${enemyHasFlagRect.height}\n\t\tvisible 1\n\t\ttextalign 1\n\t\tdecoration\n`;
    out += `\t\ttextstyle ${textStyle}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\tforecolor ${decodeColor(m.enemyHasFlagColor)} ${(m.textOpacity || 100) / 100}\n`;
    out += `\t\ttextscale ${(m.textSize || 35) / 100}\n`;
    out += `\t\ttext "${m.enemyHasFlag || 'ENEMY HAS OUR FLAG!'}"\n`;
    out += `\t\townerdrawflag CG_SHOW_OTHERTEAMHASFLAG\n\t}\n}\n`;
    return out;
}

function genOwnerdrawTextItem(m, menuName, itemName, ownerdraw, options = {}) {
    const textStyle = m.textStyle || '3';
    const hasPrefix = (m.template || '').length > 0;
    const fallbackHeight = round3(m.coordinates.height || 0);
    const anchorBox = !hasPrefix && options.anchorBox && options.anchorBox.coordinates ? options.anchorBox.coordinates : null;
    let { prefixRect, counterRect } = getTextItemRects(m);
    const rawCounterRect = counterRect ? Object.assign({}, counterRect) : null;

    if (!hasVisibleRect(counterRect)) {
        counterRect = {
            left: 0,
            top: 0,
            width: round3(m.coordinates.width || 0),
            height: fallbackHeight
        };
    }

    if (!hasPrefix) {
        prefixRect = null;
    } else if (!hasVisibleRect(prefixRect)) {
        const gap = round3(options.gap !== undefined ? options.gap : 4);
        const fallbackCounterWidth = round3(Math.max(24, Math.min(48, getQLTextHeight(m.textSize || 42) * 1.4)));
        const counterWidth = round3(Math.max(counterRect.width || 0, fallbackCounterWidth));
        const prefixWidth = round3(Math.max((m.coordinates.width || 0) - counterWidth - gap, 0));

        prefixRect = {
            left: 0,
            top: 0,
            width: prefixWidth,
            height: fallbackHeight
        };
        counterRect = {
            left: round3(prefixWidth + gap),
            top: 0,
            width: counterWidth,
            height: fallbackHeight
        };
    }

    let menuRect;

    if (anchorBox) {
        menuRect = {
            left: round3(anchorBox.left),
            top: round3(anchorBox.top),
            width: round3(anchorBox.width),
            height: round3(anchorBox.height),
            originLeft: 0,
            originTop: 0
        };
        prefixRect = null;
        counterRect = {
            left: round3((m.coordinates.left || 0) + (rawCounterRect ? rawCounterRect.left : 0) - anchorBox.left),
            top: round3((m.coordinates.top || 0) + (rawCounterRect ? rawCounterRect.top : 0) - anchorBox.top),
            width: round3(rawCounterRect ? rawCounterRect.width : anchorBox.width),
            height: round3(rawCounterRect ? rawCounterRect.height : anchorBox.height)
        };
    } else {
        const geometry = getMenuGeometry(m, {
            prefix: hasVisibleRect(prefixRect) ? prefixRect : null,
            counter: counterRect
        });
        menuRect = geometry.menuRect;
        prefixRect = geometry.rects.prefix;
        counterRect = geometry.rects.counter;
    }

    const valueAlign = options.valueAlign || 'ITEM_ALIGN_LEFT';
    const valueTextAlign = valueAlign === 'ITEM_ALIGN_CENTER' ? 1 : (valueAlign === 'ITEM_ALIGN_RIGHT' ? 2 : 0);
    const translatedPrefixRect = hasVisibleRect(prefixRect) ? getQLVisibleTextRectRect(prefixRect) : null;
    const translatedCounterRect = getQLVisibleTextRectRect(counterRect);

    let out = `\nmenuDef {\n\tname "${menuName}"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m, menuRect);
    out += `\n`;

    if (translatedPrefixRect) {
        out += `\titemDef {\n\t\tname "${itemName}Prefix"\n\t\trect ${translatedPrefixRect.left} ${translatedPrefixRect.top} ${translatedPrefixRect.width} ${translatedPrefixRect.height}\n`;
        out += `\t\tvisible 1\n\t\ttextalign 0\n\t\tdecoration\n\t\ttextstyle ${textStyle}\n`;
        out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
        out += `\t\ttext "${escapeMenuText(m.template)}"\n\t}\n\n`;
    }

    out += `\titemDef {\n\t\tname "${itemName}Counter"\n\t\trect ${translatedCounterRect.left} ${translatedCounterRect.top} ${translatedCounterRect.width} ${translatedCounterRect.height}\n`;
    out += `\t\tvisible 1\n\t\tdecoration\n\t\ttextalign ${valueTextAlign}\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\townerdraw ${ownerdraw}\n\t}\n}\n`;
    return out;
}

function genStaticTextItem(m, menuName, itemName, options = {}) {
    const textStyle = m.textStyle || '3';
    const hasPrefix = (m.template || '').length > 0;
    const fallbackHeight = round3(m.coordinates.height || 0);
    let { prefixRect, counterRect } = getTextItemRects(m);

    if (!hasVisibleRect(counterRect)) {
        counterRect = {
            left: 0,
            top: 0,
            width: round3(m.coordinates.width || 0),
            height: fallbackHeight
        };
    }

    if (!hasPrefix) {
        prefixRect = null;
    } else if (!hasVisibleRect(prefixRect)) {
        const gap = round3(options.gap !== undefined ? options.gap : 4);
        const counterWidth = round3(Math.max(counterRect.width || 0, Math.max(48, (m.coordinates.width || 0) / 2)));
        const prefixWidth = round3(Math.max((m.coordinates.width || 0) - counterWidth - gap, 0));

        prefixRect = {
            left: 0,
            top: 0,
            width: prefixWidth,
            height: fallbackHeight
        };
        counterRect = {
            left: round3(prefixWidth + gap),
            top: 0,
            width: counterWidth,
            height: fallbackHeight
        };
    }

    let menuRect;

    if (options.preserveMenuCoordinates) {
        menuRect = {
            left: round3(m.coordinates.left || 0),
            top: round3(m.coordinates.top || 0),
            width: round3(m.coordinates.width || 0),
            height: round3(m.coordinates.height || 0),
            originLeft: 0,
            originTop: 0
        };
    } else {
        const geometry = getMenuGeometry(m, {
            prefix: hasVisibleRect(prefixRect) ? prefixRect : null,
            counter: counterRect
        });
        menuRect = geometry.menuRect;
        prefixRect = geometry.rects.prefix;
        counterRect = geometry.rects.counter;
    }

    if (options.preserveMenuCoordinates) {
        prefixRect = hasVisibleRect(prefixRect) ? prefixRect : null;
        counterRect = counterRect || {
            left: 0,
            top: 0,
            width: round3(m.coordinates.width || 0),
            height: round3(m.coordinates.height || 0)
        };
    }
    const valueTextAlign = options.valueTextAlign !== undefined ? options.valueTextAlign : 0;
    const translatedPrefixRect = hasVisibleRect(prefixRect) ? getQLVisibleTextRectRect(prefixRect) : null;
    const translatedCounterRect = getQLVisibleTextRectRect(counterRect);

    let out = `\nmenuDef {\n\tname "${menuName}"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m, menuRect);
    out += `\n`;

    if (translatedPrefixRect) {
        out += `\titemDef {\n\t\tname "${itemName}Prefix"\n\t\trect ${translatedPrefixRect.left} ${translatedPrefixRect.top} ${translatedPrefixRect.width} ${translatedPrefixRect.height}\n`;
        out += `\t\tvisible 1\n\t\ttextalign 0\n\t\tdecoration\n\t\ttextstyle ${textStyle}\n`;
        out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
        out += `\t\ttext "${escapeMenuText(m.template)}"\n\t}\n\n`;
    }

    out += `\titemDef {\n\t\tname "${itemName}Value"\n\t\trect ${translatedCounterRect.left} ${translatedCounterRect.top} ${translatedCounterRect.width} ${translatedCounterRect.height}\n`;
    out += `\t\tvisible 1\n\t\tdecoration\n\t\ttextalign ${valueTextAlign}\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\ttext "${escapeMenuText(m.text)}"\n\t}\n}\n`;
    return out;
}

function genCanvasOwnerdrawTextItem(m, menuName, itemName, ownerdraw, options = {}) {
    const textStyle = m.textStyle || '3';
    const { counterRect } = getTextItemRects(m);
    const visibleRect = hasVisibleRect(counterRect) ? counterRect : {
        left: 0,
        top: 0,
        width: round3(m.coordinates.width || 0),
        height: round3(m.coordinates.height || 0)
    };
    const itemRect = getQLVisibleTextRectRect(visibleRect);
    const textAlign = options.valueTextAlign !== undefined ? options.valueTextAlign : 0;

    let out = `\nmenuDef {\n\tname "${menuName}"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "${itemName}Counter"\n\t\trect ${itemRect.left} ${itemRect.top} ${itemRect.width} ${itemRect.height}\n`;
    out += `\t\tvisible 1\n\t\tdecoration\n\t\ttextalign ${textAlign}\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\townerdraw ${ownerdraw}\n\t}\n}\n`;
    return out;
}

function genTeamScoreItem(m, menuName, itemName, ownerdraw, allItems) {
    const textStyle = m.textStyle || '0';
    const rawCounterRect = normalizeSerializedRect(m.counterCoordinates, {
        left: 0,
        top: 0,
        width: round3(m.coordinates.width || 0),
        height: round3(m.coordinates.height || 0)
    }) || {
        left: 0,
        top: 0,
        width: round3(m.coordinates.width || 0),
        height: round3(m.coordinates.height || 0)
    };
    const anchorBox = findContainingRectangleBox(m, allItems);
    let menuRect;
    let visibleRect;

    if (anchorBox && anchorBox.coordinates) {
        menuRect = {
            left: round3(anchorBox.coordinates.left),
            top: round3(anchorBox.coordinates.top),
            width: round3(anchorBox.coordinates.width),
            height: round3(anchorBox.coordinates.height),
            originLeft: 0,
            originTop: 0
        };
        visibleRect = {
            left: round3((m.coordinates.left || 0) + (rawCounterRect.left || 0) - anchorBox.coordinates.left),
            top: round3((m.coordinates.top || 0) + (rawCounterRect.top || 0) - anchorBox.coordinates.top),
            width: round3(rawCounterRect.width || anchorBox.coordinates.width),
            height: round3(rawCounterRect.height || anchorBox.coordinates.height)
        };
    } else {
        const geometry = getMenuGeometry(m, {
            counter: rawCounterRect
        });
        menuRect = geometry.menuRect;
        visibleRect = geometry.rects.counter || {
            left: 0,
            top: 0,
            width: round3(menuRect.width),
            height: round3(menuRect.height)
        };
    }

    const valueRect = getQLVisibleTextRectRect(visibleRect);

    let out = `\nmenuDef {\n\tname "${menuName}"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m, menuRect);
    out += `\n`;
    out += `\titemDef {\n\t\tname "${itemName}Counter"\n\t\trect ${valueRect.left} ${valueRect.top} ${valueRect.width} ${valueRect.height}\n`;
    out += `\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\townerdraw ${ownerdraw}\n\t}\n}\n`;
    return out;
}

function genCanvasStaticTextItem(m, menuName, itemName, options = {}) {
    const textStyle = m.textStyle || '3';
    const { counterRect } = getTextItemRects(m);
    const visibleRect = hasVisibleRect(counterRect) ? counterRect : {
        left: 0,
        top: 0,
        width: round3(m.coordinates.width || 0),
        height: round3(m.coordinates.height || 0)
    };
    const itemRect = getQLVisibleTextRectRect(visibleRect);
    const textAlign = options.valueTextAlign !== undefined ? options.valueTextAlign : 0;

    let out = `\nmenuDef {\n\tname "${menuName}"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "${itemName}Value"\n\t\trect ${itemRect.left} ${itemRect.top} ${itemRect.width} ${itemRect.height}\n`;
    out += `\t\tvisible 1\n\t\tdecoration\n\t\ttextalign ${textAlign}\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n`;
    out += `\t\ttext "${escapeMenuText(m.text)}"\n\t}\n}\n`;
    return out;
}

function genLocalTime(m) {
    return genCanvasOwnerdrawTextItem(m, 'localTime', 'localTime', 'CG_LOCALTIME', {
        valueTextAlign: 0
    });
}

function genTeamPlayerCount(m) {
    return genCanvasOwnerdrawTextItem(m, 'teamPlayerCount', 'teamPlayerCount', 'CG_TEAM_PLYR_COUNT', {
        valueTextAlign: 1
    });
}

function genEnemyPlayerCount(m) {
    return genCanvasOwnerdrawTextItem(m, 'enemyPlayerCount', 'enemyPlayerCount', 'CG_ENEMY_PLYR_COUNT', {
        valueTextAlign: 1
    });
}

function genRedTeamScore(m, allItems) {
    return genTeamScoreItem(m, 'redTeamScore', 'redTeamScore', 'CG_RED_SCORE', allItems);
}

function genBlueTeamScore(m, allItems) {
    return genTeamScoreItem(m, 'blueTeamScore', 'blueTeamScore', 'CG_BLUE_SCORE', allItems);
}

function genTextLabel(m) {
    return genCanvasStaticTextItem(m, 'textLabel', 'textLabel', {
        valueTextAlign: 0
    });
}


function genRoundTimer(m, allItems) {
    const textStyle = m.textStyle || '3';
    const geometry = getMenuGeometry(m, {
        text: getRenderedTextRect(m)
    });
    const menuRect = geometry.menuRect;
    const textRect = geometry.rects.text;
    const ownerdrawRect = getQLVisibleTextRectRect(textRect);
    const shadowRect = getQLVisibleTextRectRect({
        left: round3(textRect.left + 1),
        top: round3(textRect.top + 1),
        width: textRect.width,
        height: textRect.height
    });

    let out = `\nmenuDef {\n\tname "roundTimer"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(menuRect);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "roundTimerShadow"\n\t\trect ${shadowRect.left} ${shadowRect.top} ${shadowRect.width} ${shadowRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor 0 0 0 0.8\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_ROUNDTIMER\n\t}\n\n`;
    out += `\titemDef {\n\t\tname "roundTimerCounter"\n\t\trect ${ownerdrawRect.left} ${ownerdrawRect.top} ${ownerdrawRect.width} ${ownerdrawRect.height}\n\t\tvisible 1\n\t\tdecoration\n\t\ttextalign 1\n`;
    out += `\t\ttextstyle ${textStyle}\n`;
    out += `\t\tforecolor ${decodeColor(m.textColor)} ${m.textOpacity / 100}\n\t\ttextscale ${m.textSize / 100}\n\t\tfont ${getFont(m)}\n\t\townerdraw CG_ROUNDTIMER\n\t}\n}\n`;
    return out;
}


function genKeyIndicator(m) {
    let out = `\nmenuDef {\n\tname "keyIndicator"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "keyIcon"\n\t\trect 0 0 ${m.iconSize} ${m.iconSize}\n\t\tvisible 1\n\t\tdecoration\n\t\townerdraw CG_PLAYER_HASKEY\n\t}\n}\n`;
    return out;
}

function genPlayerHead(m) {
    const iconSize = round3(parseFloat(m.iconSize, 10) || 24);
    const iconOpacity = m.iconOpacity / 100;
    const staticHeadBackground = getStaticPlayerHeadBackgroundByIndex(parseInt(m.iconStyle, 10) - 1);
    let out = `\nmenuDef {\n\tname "playerHead"\n\tfullScreen MENU_FALSE\n\tvisible MENU_TRUE\n`;
    out += menuDefRect(m.coordinates);
    out += getOwnerDrawFlag(m);
    out += getWidescreen(m);
    out += `\n`;
    out += `\titemDef {\n\t\tname "playerHeadIcon"\n\t\trect 0 0 ${iconSize} ${iconSize}\n\t\tvisible 1\n\t\tdecoration\n\t\tstyle WINDOW_STYLE_FILLED\n`;
    if (parseInt(m.iconStyle, 10) === 0) {
        out += `\t\townerdraw CG_PLAYER_HEAD\n`;
    } else if (staticHeadBackground) {
        out += `\t\tbackcolor 1 1 1 ${iconOpacity}\n\t\tbackground "${staticHeadBackground}"\n`;
    }
    out += `\t}\n}\n`;
    return out;
}

function generateMenuForItem(menuItem, allItems) {
    const name = menuItem.name;
    switch (name) {
        case 'healthIndicator': return genHealthIndicator(menuItem);
        case 'armorIndicator': return genArmorIndicator(menuItem);
        case 'ammoIndicator': return genAmmoIndicator(menuItem);
        case 'timer': return genTimer(menuItem, allItems);
        case 'rectangleBox': return genRectangleBox(menuItem);
        case 'chatArea': return genChatArea(menuItem);
        case 'powerupIndicator': return genPowerupIndicator(menuItem);
        case 'CTFPowerupIndicator': return genCTFPowerupIndicator(menuItem);
        case 'flagIndicator': return genFlagIndicator(menuItem);
        case 'obits': return genObits(menuItem);
        case 'playerItem': return genPlayerItem(menuItem);
        case 'medal': return genMedal(menuItem);
        case 'flagWarning': return genFlagWarning(menuItem);
        case 'healthBar': return `\n` + genBarsHelper(menuItem);
        case 'armorBar': return `\n` + genBarsHelper(menuItem);
        case 'scoreBox': return genScoreBox(menuItem);
        case 'localTime': return genLocalTime(menuItem);
        case 'redTeamScore': return genRedTeamScore(menuItem, allItems);
        case 'blueTeamScore': return genBlueTeamScore(menuItem, allItems);
        case 'textLabel': return genTextLabel(menuItem);
        case 'teamPlayerCount': return genTeamPlayerCount(menuItem);
        case 'enemyPlayerCount': return genEnemyPlayerCount(menuItem);
        case 'roundTimer': return genRoundTimer(menuItem, allItems);
        case 'keyIndicator': return genKeyIndicator(menuItem);
        case 'playerHead': return genPlayerHead(menuItem);
        default: return `\n`;
    }
}


function createZip(files) {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    for (const file of files) {
        const nameBuffer = Buffer.from(file.name, 'utf-8');
        const dataBuffer = Buffer.from(file.data, 'utf-8');
        const crc = crc32(dataBuffer);

        const local = Buffer.alloc(30 + nameBuffer.length + dataBuffer.length);
        local.writeUInt32LE(0x04034b50, 0); // signature
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0, 6); // flags
        local.writeUInt16LE(0, 8); // compression (none)
        local.writeUInt16LE(0, 10); // mod time
        local.writeUInt16LE(0, 12); // mod date
        local.writeUInt32LE(crc, 14); // crc32
        local.writeUInt32LE(dataBuffer.length, 18); // compressed size
        local.writeUInt32LE(dataBuffer.length, 22); // uncompressed size
        local.writeUInt16LE(nameBuffer.length, 26); // filename length
        local.writeUInt16LE(0, 28); // extra field length
        nameBuffer.copy(local, 30);
        dataBuffer.copy(local, 30 + nameBuffer.length);

        const central = Buffer.alloc(46 + nameBuffer.length);
        central.writeUInt32LE(0x02014b50, 0); // signature
        central.writeUInt16LE(20, 4); // version made by
        central.writeUInt16LE(20, 6); // version needed
        central.writeUInt16LE(0, 8); // flags
        central.writeUInt16LE(0, 10); // compression
        central.writeUInt16LE(0, 12); // mod time
        central.writeUInt16LE(0, 14); // mod date
        central.writeUInt32LE(crc, 16); // crc32
        central.writeUInt32LE(dataBuffer.length, 20); // compressed size
        central.writeUInt32LE(dataBuffer.length, 24); // uncompressed size
        central.writeUInt16LE(nameBuffer.length, 28); // filename length
        central.writeUInt16LE(0, 30); // extra field length
        central.writeUInt16LE(0, 32); // file comment length
        central.writeUInt16LE(0, 34); // disk number start
        central.writeUInt16LE(0, 36); // internal file attributes
        central.writeUInt32LE(0, 38); // external file attributes
        central.writeUInt32LE(offset, 42); // offset of local header
        nameBuffer.copy(central, 46);

        localHeaders.push(local);
        centralHeaders.push(central);
        offset += local.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const ch of centralHeaders) centralDirSize += ch.length;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // disk with central dir
    eocd.writeUInt16LE(files.length, 8); // entries on this disk
    eocd.writeUInt16LE(files.length, 10); // total entries
    eocd.writeUInt32LE(centralDirSize, 12); // central dir size
    eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
    eocd.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function parseBody(body) {
    const params = {};
    body.split('&').forEach(pair => {
        const [key, val] = pair.split('=').map(s => decodeURIComponent((s || '').replace(/\+/g, ' ')));
        params[key] = val;
    });
    return params;
}

function sanitizeHUDName(value) {
    return String(value || '')
        .trim()
        .replace(/[^A-Za-z0-9_.-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function buildHUDArchive(source, requestedName) {
    const parsed = typeof source === 'string' ? JSON.parse(source) : source;
    const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.items) ? parsed.items : []);
    const configName = sanitizeHUDName(requestedName) || sanitizeHUDName(parsed && parsed.name) || 'custom_hud';
    const jsonData = Array.isArray(parsed) ? {
        name: configName,
        items
    } : Object.assign({}, parsed || {}, {
        name: configName,
        items
    });
    const jsonText = JSON.stringify(jsonData);

    let menuText = genHeader();
    for (const item of items) {
        menuText += generateMenuForItem(item, items) + '\n\n';
    }
    menuText += genFooter();

    const configText = genConfig(configName);
    const zipBuffer = createZip([
        { name: `${configName}.menu`, data: menuText },
        { name: `${configName}.cfg`, data: configText },
        { name: `${configName}.hlab`, data: jsonText }
    ]);

    return {
        configName,
        items,
        jsonData,
        jsonText,
        menuText,
        configText,
        zipBuffer
    };
}

function decodeDataUrl(dataUrl) {
    const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
    if (!match) {
        return null;
    }

    const mimeType = match[1];
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';

    return {
        mimeType,
        ext,
        buffer: Buffer.from(match[2], 'base64')
    };
}

function readHudMetadata() {
    if (!fs.existsSync(QC_HUDS_METADATA_PATH)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(QC_HUDS_METADATA_PATH, 'utf8');
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        if (parsed && typeof parsed === 'object') {
            return Object.keys(parsed).map((name) => Object.assign({ name }, parsed[name]));
        }
    } catch (error) {
        console.warn('Could not parse QuakeClub HUD metadata:', error.message);
    }

    return [];
}

function writeHudMetadata(metadata) {
    fs.writeFileSync(QC_HUDS_METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

const server = http.createServer((req, res) => {

    if (req.method === 'POST' && req.url === '/download.php') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const params = parseBody(body);
                const archive = buildHUDArchive(params.hud_data || '', params.hud_name);

                res.writeHead(200, {
                    'Content-Type': 'application/octet-stream',
                    'Content-Disposition': `attachment; filename=${archive.configName}.zip`,
                    'Content-Length': archive.zipBuffer.length
                });
                res.end(archive.zipBuffer);
            } catch (e) {
                console.error('Download error:', e);
                res.writeHead(500);
                res.end('Oops :(');
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/upload_hud.php') {
        const user = getSessionUser(req);
        if (!user) {
            sendJson(res, 401, { error: 'Debes iniciar sesión para subir HUDs.' });
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body || '{}');
                const archive = buildHUDArchive(payload.hud_data || {}, payload.hud_name || payload.name);
                const zipName = `${archive.configName}.zip`;
                const zipPath = path.join(QC_HUDS_DIR, zipName);
                const previewData = decodeDataUrl(payload.preview_data || '');

                ensureDir(QC_HUDS_DIR);
                ensureDir(QC_HUDS_PREVIEWS_DIR);

                fs.writeFileSync(zipPath, archive.zipBuffer);

                let previewImage = '';
                if (previewData && previewData.buffer.length) {
                    const previewFileName = `${archive.configName}.${previewData.ext}`;
                    const previewPath = path.join(QC_HUDS_PREVIEWS_DIR, previewFileName);
                    fs.writeFileSync(previewPath, previewData.buffer);
                    previewImage = `/huds/previews/${previewFileName}`;
                }

                const metadata = readHudMetadata();
                const metadataIndex = metadata.findIndex((entry) => entry.name === zipName);
                const previousEntry = metadataIndex >= 0 ? metadata[metadataIndex] : null;
                const entry = {
                    name: zipName,
                    username: user.username,
                    userId: user.id,
                    author: user.username,
                    description: String(payload.description || '').trim(),
                    uploadDate: new Date().toISOString(),
                    size: archive.zipBuffer.length,
                    downloads: previousEntry ? (previousEntry.downloads || 0) : 0,
                    previewImage: previewImage || (previousEntry ? previousEntry.previewImage || '' : '')
                };

                if (metadataIndex >= 0) {
                    metadata[metadataIndex] = entry;
                } else {
                    metadata.push(entry);
                }

                writeHudMetadata(metadata);

                sendJson(res, 200, {
                    success: true,
                    fileName: zipName,
                    previewImage: entry.previewImage
                });
            } catch (e) {
                console.error('Upload HUD error:', e);
                sendJson(res, 500, {
                    error: 'No se pudo subir la HUD al repositorio local de QuakeClub.'
                });
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`HUD Lab download service running on port ${PORT}`);
});








