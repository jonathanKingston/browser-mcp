// Saves options to chrome.storage
function saveOptions(e) {
    e.preventDefault();
    const port = document.getElementById('port').value;
    chrome.storage.local.set({ wsPort: port }, function() {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => { status.textContent = ''; }, 1500);
    });
}

// Restores the port value from chrome.storage
async function restoreOptions() {
    const items = await browser.storage.local.get(['wsPort']) || 8080;
    document.getElementById('port').value = items.wsPort;
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('options-form').addEventListener('submit', saveOptions); 