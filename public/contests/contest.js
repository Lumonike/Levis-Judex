const container = document.querySelector("[data-contest-id]");
const startButton = document.getElementById("start-contest-button");

if (container && startButton) {
    startButton.addEventListener("click", async () => {
        const contestID = container.dataset.contestId;
        const query = container.dataset.contestClubId ? `?club=${encodeURIComponent(container.dataset.contestClubId)}` : "";
        startButton.disabled = true;

        try {
            const res = await fetch(`/api/contests/${contestID}/start${query}`, {
                body: JSON.stringify({}),
                headers: { "Content-Type": "application/json" },
                method: "POST",
            });
            const parsed = await res.json();
            if (!res.ok) {
                throw new Error(parsed.error ?? "Failed to start contest");
            }
            window.location.reload();
        } catch (err) {
            alert(err.message);
            startButton.disabled = false;
        }
    });
}
