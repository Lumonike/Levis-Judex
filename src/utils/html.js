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

/**
 * Easily create html stuff
 * @module utils/html
 */

const fs = require('fs');
const jsdom = require('jsdom');
const path = require('path');
/**
 * @private
 * @memberof module:utils/html
 * Dummy document so we can create elements
 */
const { document } = new jsdom.JSDOM("<!DOCTYPE html>").window;

/**
 * Creates a base html document
 * @name baseDocument
 * @function
 * @memberof module:utils/html
 * @returns {Document} html document
 */
module.exports.baseDocument = () => {
    return new jsdom.JSDOM(fs.readFileSync(path.join(__dirname, "..", "templates", "base.html"))).window.document;
}

/**
 * Creates heading title
 * @name title
 * @function
 * @memberof module:utils/html
 * @param {string} text Title text
 * @param {string} [color="text-white"] Tailwind color. {@link https://tailwindcss.com/docs/colors Reference}
 * @returns {HTMLHeadingElement} Html heading
 */
module.exports.title = (text, color="text-white") => {
    const element = document.createElement('h1');
    element.className = `text-4xl font-bold text-center mb-6 ${color}`;
    element.innerHTML = text;
    return element;
};

/**
 * Creates home button
 * @name homeButton
 * @function
 * @memberof module:utils/html
 * @returns {HTMLDivElement}
 */
module.exports.homeButton = () => {
    const element = document.createElement('div');
    element.innerHTML = fs.readFileSync(path.join(__dirname, "..", "templates", "partials", "home-button.html"));
    return element;
};

/**
 * Creates a back arrow
 * @name backArrow
 * @function
 * @memberof module:utils/html
 * @param {string} href Where it links to
 * @param {string} text Text (arrow will automatically be added to text)
 * @returns {HTMLDivElement} Back arrow element
 */
module.exports.backArrow = (href, text) => {
    const element = this.link(href, `← ${text}`);
    element.className = 'p-4';
    return element;
};

/**
 * Creates a paragraph element for text
 * @name text
 * @function
 * @memberof module:utils/html
 * @param {string} text What's the text
 * @param {boolean} [centered=false] Text centered 
 * @param {boolean} [bold=false] Text bold 
 * @param {string} [color="text-white"] Text color {@link https://tailwindcss.com/docs/colors Reference}
 * @param {string} [size="text-2xl"] Text size {@link https://tailwindcss.com/docs/font-size Reference}
 * @param {boolean} [spacing=true] Should there be spacing
 * @returns {HTMLParagraphElement} element
 */
module.exports.text = (text, centered=false, bold=false, color="text-white", size="text-2xl", spacing=true) => {
    const element = document.createElement('p');
    element.className = `${size} ${spacing ? "space-y-4 mb-4" : ""} ${color} ${bold ? "font-bold" : ""} ${centered ? "text-center" : ""}`;
    element.innerHTML = text;
    return element;
}

/**
 * Creates a link
 * @name link
 * @function
 * @memberof module:utils/html
 * @param {string} href the link
 * @param {string} text what text to display 
 * @param {boolean} [centered=false] should the text be centered
 * @param {string} [size="text-2xl"] Text size {@link https://tailwindcss.com/docs/font-size Reference}
 * @returns {HTMLParagraphElement} the link element
 */
module.exports.link = (href, text, centered=false, size="text-2xl") => {
    const element = this.text("", centered, false, "", size);
    const a = document.createElement('a');
    a.className = "hover:underline text-blue-400";
    a.href = href;
    a.textContent = text;
    element.append(a);
    return element;
}

/**
 * Creates an input
 * @name input
 * @function
 * @memberof module:utils/html
 * @param {string} label Text that goes above input
 * @param {string} type What type of input (i.e. "password", "email", etc.)
 * @param {string} id What the ID of the input should be
 * @param {string} placeholder What text is inside the input
 * @param {boolean} [required=true] Is the input is required
 * @returns {HTMLDivElement} The div element
 */
module.exports.input = (label, type, id, placeholder, required=true) => {
    const element = document.createElement('div');

    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    labelElement.className = "text-lg";
    labelElement.innerHTML = label;
    element.appendChild(labelElement);

    const inputElement = document.createElement('input');
    inputElement.id = id;
    inputElement.type = type;
    inputElement.className = "w-full text-lg p-2 rounded-lg bg-gray-700 text-gray-100 focus:outline-none focus:bg-gray-600";
    inputElement.required = required;
    inputElement.placeholder = placeholder;
    element.appendChild(inputElement);

    return element;
}

/**
 * Creates a button
 * @name button
 * @function
 * @memberof module:utils/html
 * @param {string} text Text on button 
 * @param {string} id ID of button
 * @returns {HTMLDivElement} Button
 */
module.exports.button = (text, id) => {
    const element = document.createElement('div');
    const button = document.createElement('button');
    button.id = id;
    button.innerHTML = text;
    button.className = "w-full text-lg p-2 mt-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 focus:outline-none";
    button.type = "submit";
    element.appendChild(button);
    return element;
}

/**
 * Easily create form element
 * @name form
 * @function
 * @memberof module:utils/html
 * @param {string} id Form id
 * @returns {HTMLFormElement} Form element
 */
module.exports.form = (id) => {
    const element = document.createElement('form');
    element.id = id;
    element.className = "space-y-4 mb-0";
    return element;
}
