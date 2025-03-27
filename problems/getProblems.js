import { server } from "/problems/getServer.js";

async function loadProblems() {
    try {
        const response = await fetch(`${server}/problems/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const folders = await response.json();
        
        const list = document.getElementById("problem-list");
        folders.forEach(folder => {
            let p = document.createElement("p");
            let a = document.createElement("a");
            a.href = folder; // Link to the problem's index.html
            a.textContent = folder.split("_").join(" "); // Display folder name
            p.appendChild(a);
            a.className = "hoverUnderline";
            list.appendChild(p);
        });
    } catch (error) {
        console.error("Error fetching problem list:", error);
    }
}

// Call the function asynchronously
loadProblems();
