import { server } from "/problems/getServer.js";

async function loadProblems() {
    try {
        const response = await fetch(`${server}/problems/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const problems = await response.json();
        
        const list = document.getElementById("problem-list");
        problems.forEach(problem => {
            let p = document.createElement("p");
            let a = document.createElement("a");
            a.href = `../problem?id=${problem.id}`; 
            a.textContent = `${problem.id}. ${problem.name}`;
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
