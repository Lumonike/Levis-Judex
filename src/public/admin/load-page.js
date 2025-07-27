async function loadAdminHTML() {
    const token = localStorage.getItem("authToken");
    if (!token) {
        window.location.href = '/login';
        return;
    }

    const url = window.location.pathname.split("/");
    if (url.at(-1) == "") url.pop();
    const folder = url.at(-1);
    console.log(folder);

    const response = await fetch(`/admin/get-admin-page`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ folder })
    });
    const content = document.getElementById("admin-content");
    console.log(response);
    if (!response.ok) {
        content.textContent = "Error: You do not have access to this page";
        return;
    }
    const html = await response.text();
    // content.innerHTML = html;
    document.open();
    document.write(html);
    document.close();
}
loadAdminHTML();