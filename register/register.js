document.addEventListener('DOMContentLoaded', function () {
    const registerForm = document.getElementById('registerForm');
    const registerButton = document.getElementById('registerButton');

    registerForm.addEventListener('submit', function (event) {
        event.preventDefault();  // Prevent form submission

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const registerData = {
            name: name,
            email: email,
            password: password,
        };

        // Send POST request to the backend register route
        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registerData),
        })
        .then(response => response.json())
        .then(data => {
            console.log(data);
            if (!data.message){
                alert(data.error);
                
            }
            else{
                alert(data.message);
                window.location.href = '/login';  // Redirect to login page on successful registration
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred. Please try again later.');
        });
    });
});
