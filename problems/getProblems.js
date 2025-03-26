import { server } from "/problems/getServer.js";

fetch(`${server}/problems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
})
.then(response => response.json())
.then(folders => {
    const list = document.getElementById("problem-list");
    folders.forEach(folder => {
        let p = document.createElement("p");
        let a = document.createElement("a");
        a.href = folder; // Link to the problem's index.html
        a.textContent = folder; // Display folder name
        p.appendChild(a);
        list.appendChild(p);
    });
})
.catch(error => console.error("Error fetching problem list:", error));
