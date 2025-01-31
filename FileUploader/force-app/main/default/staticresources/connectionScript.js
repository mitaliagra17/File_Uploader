if (typeof window !== 'undefined') {
    const loadHandler = () => {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = '/soap/ajax/62.0/connection.js';
        document.head.appendChild(script);

        // Remove the event listener after the script is loaded
        window.removeEventListener('DOMContentLoaded', loadHandler);
    };

    window.addEventListener('DOMContentLoaded', loadHandler);
}
