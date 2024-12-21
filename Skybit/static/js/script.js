// Handle file item clicks
document.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', () => {
        const href = item.getAttribute('data-href');
        if (href) {
            window.location.href = href;
        }
    });
});

// Toggle the menu visibility
function toggleMenu(event, trigger) {
    event.stopPropagation();
    const menuContainer = trigger.closest('.menu-container');
    document.querySelectorAll('.menu-container').forEach(container => {
        if (container !== menuContainer) container.classList.remove('active');
    });
    menuContainer.classList.toggle('active');
}

// Close menus when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.menu-container.active').forEach(container => {
        container.classList.remove('active');
    });
});

// Function to select a file to move
function selectFileToMove(event) {
    event.stopPropagation();
    const filePath = event.target.getAttribute('data-filepath');
    const currentUrl = new URL(window.location.href);

    // Append selected file info as query parameters
    currentUrl.searchParams.set('selected_file', filePath);

    // Navigate to the same page but with the query parameter
    window.location.href = currentUrl.href;
}

// Function to show the progress bar
function showProgressBar() {
    document.getElementById('progress-bar-container').style.display = 'block';
}

// Function to hide the progress bar
function hideProgressBar() {
    document.getElementById('progress-bar-container').style.display = 'none';
}

// Function to update the progress bar
function updateProgressBar(percent) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = percent + '%';
}

// Common function for handling file/folder uploads
function handleUpload(inputElement, form, formData) {
    if (inputElement.files.length > 0) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', form.action, true);

        // Show the progress bar when the upload starts
        showProgressBar();

        // Listen for progress events to update the progress bar
        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                updateProgressBar(percentComplete);
            }
        });

        // When the upload is complete
        xhr.onload = function() {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);

                // Hide the progress bar after the upload
                hideProgressBar();

                // Optionally, redirect after upload if needed
                if (response.redirect_url) {
                    window.location.href = response.redirect_url;
                }
            } else {
                document.getElementById('upload-status').innerHTML = `<p>Upload failed: ${xhr.statusText}</p>`;
                hideProgressBar();  // Hide the progress bar in case of failure
            }
        };

        // On error
        xhr.onerror = function() {
            document.getElementById('upload-status').innerHTML = `<p>Upload failed. Please try again.</p>`;
            hideProgressBar();  // Hide the progress bar in case of error
        };

        // Send the form data (files/folder)
        xhr.send(formData);
    }
}

// Handle file upload via AJAX
document.getElementById('upload-files').addEventListener('change', function() {
    const form = document.getElementById('uploadForm');
    const formData = new FormData(form);  // Create a FormData object from the form
    handleUpload(this, form, formData);
});

// Handle folder upload via AJAX
document.getElementById('upload-folder').addEventListener('change', function() {
    const form = this.closest('form');
    const formData = new FormData(form);  // Create a FormData object from the form
    handleUpload(this, form, formData);
});