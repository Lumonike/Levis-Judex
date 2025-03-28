export function apply(elem, startTime, endTime) {
    const now = new Date();

    if (now < startTime) {
        const timeRemaining = startTime - now; // Time remaining in milliseconds
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        elem.innerHTML = `Starts in ${hours} hours, ${minutes} minutes, and ${seconds} seconds`;
    } else if (now >= startTime && now <= endTime) {
        const timeRemaining = endTime - now; // Time remaining in milliseconds
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        elem.innerHTML = `Contest is running! ${hours} hours, ${minutes} minutes, and ${seconds} seconds left`;
    } else {
        elem.innerHTML = `Contest ended at ${endTime.toLocaleString()}`;
    }
}