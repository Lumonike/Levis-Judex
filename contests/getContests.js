import { server } from "/problems/getServer.js";

async function loadContests() {
    try {
        const response = await fetch(`${server}/contests/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const contests = await response.json();
        
        const list = document.getElementById("contest-list");
        contests.forEach(contest => {
            let p = document.createElement("p");
            let a = document.createElement("a");
            a.href = `../contests/${contest.id}`; 
            a.textContent = `${contest.id}. ${contest.name}`;
            p.appendChild(a);
            a.className = "hoverUnderline";
            list.appendChild(p);
        });
    } catch (error) {
        console.error("Error fetching contest list:", error);
    }
}

loadContests();
