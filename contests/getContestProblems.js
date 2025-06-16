import { server } from "/problems/getServer.js";

export async function loadProblems(contestID) {
    try {
        const response = await fetch(`${server}/contestProblems/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contestID })
        });
        const problems = await response.json();
        
        const list = document.getElementById("problem-list");
        problems.forEach(problem => {
            let p = document.createElement("p");
            let a = document.createElement("a");
            a.href = `/contests/${contestID}/${problem.id}`; 
            a.textContent = `${problem.id}. ${problem.name}`;
            p.appendChild(a);
            a.className = "hoverUnderline";
            list.appendChild(p);
        });
    } catch (error) {
        console.error("Error fetching problem list:", error);
    }
}
