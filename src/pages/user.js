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
 * @module pages/user
 */

const html = require("../utils/html.js");

/**
 * Shrinks main-section
 * @private
 * @memberof module:pages/user
 * @param {HTMLElement} mainSection 
 */
function shrinkMainSection(mainSection) {
    for (const cls of mainSection.classList) {
        if (cls.startsWith("max-w")) {
            mainSection.classList.replace(cls, "max-w-md");
            break;
        }
    }
}

/**
 * Creates html page for /forgot-password
 * @name createForgotPasswordHtml
 * @function
 * @memberof module:pages/user
 * @returns {string} Html string
 */
module.exports.createForgotPasswordHtml = () => {
    const document = html.baseDocument();
    document.head.insertAdjacentHTML('afterbegin', `<script type="module" src="/forgot-password/forgot-password.js" defer=""></script>`);
    document.title = "Reset Password";
    document.body.insertAdjacentElement('afterbegin', html.backArrow("/", "Back to Home"));

    const mainSection = document.getElementById("main-section");
    shrinkMainSection(mainSection);
    mainSection.appendChild(html.title("Reset Password"));
    
    const form = html.form("reset-form");
    form.appendChild(html.input("Email", "email", "email", "Enter your email"));
    form.appendChild(html.input("New Password", "password", "password", "Enter your new password"));
    form.appendChild(html.button("Get Reset Link", "reset-button"));
    mainSection.appendChild(form);

    return document.documentElement.outerHTML;
}

/**
 * Creates html page for /login
 * @name createLoginHtml
 * @function
 * @memberof module:pages/user
 * @returns {string} Html string
 */
module.exports.createLoginHtml = () => {
    const document = html.baseDocument();
    document.head.insertAdjacentHTML('afterbegin', `<script type="module" src="/login/login.js" defer=""></script>`);
    document.title = "Login";
    document.body.insertAdjacentElement('afterbegin', html.backArrow("/", "Back to Home"));

    const mainSection = document.getElementById("main-section");
    shrinkMainSection(mainSection);
    mainSection.appendChild(html.title("Login"));
    
    const form = html.form("login-form");
    form.appendChild(html.input("Email", "email", "email", "Enter your email"));
    form.appendChild(html.input("Password", "password", "password", "Enter your password"));
    // .firstchild to retrieve the anchor element because we don't want a paragraph
    form.appendChild(html.link("/forgot-password", "Forgot password?", false, "text-lg").firstChild);
    form.appendChild(html.button("Login", "login-button"));
    mainSection.appendChild(form);

    const registerText = html.text("Don't have an account? ", true, false, "text-white", "", false);
    // .firstchild to retrieve the anchor element because we don't want a paragraph
    registerText.appendChild(html.link("/register", "Register", false, "").firstChild);
    mainSection.appendChild(registerText);

    return document.documentElement.outerHTML;
}

/**
 * Creates html page for /register
 * @name createRegisterHtml
 * @function
 * @memberof module:pages/user
 * @returns {string} Html string
 */
module.exports.createRegisterHtml = () => {
    const document = html.baseDocument();
    document.head.insertAdjacentHTML('afterbegin', `<script type="module" src="/register/register.js" defer=""></script>`);
    document.title = "Register";
    document.body.insertAdjacentElement('afterbegin', html.backArrow("/", "Back to Home"));

    const mainSection = document.getElementById("main-section");
    shrinkMainSection(mainSection);
    mainSection.appendChild(html.title("Register"));
    
    const form = html.form("register-form");
    form.appendChild(html.input("Full Name", "text", "name", "Enter your full name"));
    form.appendChild(html.input("Email", "email", "email", "Enter your email"));
    form.appendChild(html.input("Password", "password", "password", "Enter your password"));
    // .firstchild to retrieve the anchor element because we don't want a paragraph
    form.appendChild(html.button("Register", "register-button"));
    mainSection.appendChild(form);

    const loginText = html.text("Already have an account? ", true, false, "text-white", "", false);
    // .firstchild to retrieve the anchor element because we don't want a paragraph
    loginText.appendChild(html.link("/login", "Login", false, "").firstChild);
    mainSection.appendChild(loginText);

    return document.documentElement.outerHTML;
}
