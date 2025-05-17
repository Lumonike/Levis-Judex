function setAdmin(email, status, token) {
    fetch('/setAdminStatus', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({email, status})
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error("Failed to add admin");
        } else {
            alert("Changed admin status!");
        }
    })
    .catch(error => {
        alert("Failed: ", error);
    })
}

function setupButtons() {
    const addButton = document.getElementById('addButton');
    const removeButton = document.getElementById('removeButton');

    addButton.addEventListener('click', (event) => {
        console.log("attempting to add admin");
        event.preventDefault();

        const email = document.getElementById("userToAdd").value;
        const status = true;
        const token = localStorage.getItem("authToken");
        setAdmin(email, status, token);
    });

    removeButton.addEventListener('click', (event) => {
        event.preventDefault();

        const email = document.getElementById("userToRemove").value;
        const status = false;
        const token = localStorage.getItem("authToken");
        setAdmin(email, status, token);
    });
}