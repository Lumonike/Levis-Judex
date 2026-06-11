/* Levis Judex - Self-hosted platform for contests/problems
 * Copyright (C) 2025 Vincent Li and Robin Wang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import sanitizeHtml from "sanitize-html";

export function sanitizeProblemHtml(html: string): string {
    return sanitizeHtml(html, {
        allowedAttributes: {
            "*": ["class"],
            a: ["href", "name", "target", "rel"],
            img: ["alt", "height", "src", "width"],
            span: ["class", "contenteditable", "data-exp", "data-font-size", "style"],
        },
        allowedSchemes: ["http", "https", "mailto", "data"],
        allowedStyles: {
            span: {
                "font-size": [/^\d+(?:\.\d+)?(?:em|ex|px|%)$/],
                height: [/^-?\d+(?:\.\d+)?(?:em|ex|px|%)$/],
                "margin-left": [/^-?\d+(?:\.\d+)?(?:em|ex|px|%)$/],
                "margin-right": [/^-?\d+(?:\.\d+)?(?:em|ex|px|%)$/],
                top: [/^-?\d+(?:\.\d+)?(?:em|ex|px|%)$/],
                "vertical-align": [/^-?\d+(?:\.\d+)?(?:em|ex|px|%)$/],
            },
        },
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "h3", "img", "span", "table", "tbody", "td", "th", "thead", "tr"]),
        transformTags: {
            a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
        },
    });
}
