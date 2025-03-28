document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');

    loginForm.addEventListener('submit', function (event) {
        event.preventDefault();  // Prevent form submission

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const loginData = {
            email: email,
            password: password,
        };

        // Send POST request to the backend login route
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Assuming the token is in data.token
                const token = data.token;

                // Store token in localStorage
                localStorage.setItem('authToken', token);

                // Redirect to dashboard on success
                window.location.href = '/';
            } else {
                alert('Invalid credentials. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred. Please try again later.');
        });
    });
});
