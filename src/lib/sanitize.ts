import sanitizeHtml from "sanitize-html";

export function sanitizeProblemHtml(html: string): string {
    return sanitizeHtml(html, {
        allowedAttributes: {
            "*": ["class"],
            a: ["href", "name", "target", "rel"],
            img: ["alt", "height", "src", "width"],
            span: ["class"],
        },
        allowedSchemes: ["http", "https", "mailto", "data"],
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "h3", "img", "span", "table", "tbody", "td", "th", "thead", "tr"]),
        transformTags: {
            a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
        },
    });
}
