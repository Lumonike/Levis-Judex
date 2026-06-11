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
