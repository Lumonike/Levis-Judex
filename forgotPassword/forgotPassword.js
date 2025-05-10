document.addEventListener('DOMContentLoaded', function () {
    const resetForm = document.getElementById('resetForm');

    resetForm.addEventListener('submit', function (event) {
        event.preventDefault();  // Prevent form submission

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const resetData = {
            email: email,
            password: password
        };

        // Send POST request to the backend login route
        fetch('/resetPassword', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(resetData),
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
