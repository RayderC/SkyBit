const dropArea = document.getElementById('drop-area'); // The div where drag-and-drop will happen

// Handle drag over event
dropArea.addEventListener('dragover', (event) => {
    event.preventDefault();  // Prevent default behavior to allow dropping
    event.stopPropagation();
    dropArea.classList.add('dragover');  // Add a class for visual feedback
});

// Handle drag leave event
dropArea.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.remove('dragover');  // Remove visual feedback
});

// Handle drop event
dropArea.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.remove('dragover');  // Remove visual feedback after drop

    // Get files from the drop event
    const files = event.dataTransfer.files;
    handleFiles(files);  // Handle the dropped files
});

// Function to handle dropped files
function handleFiles(files) {
    const form = document.getElementById('uploadForm');
    const formData = new FormData(form);

    // Clear any previous files in formData before appending new ones
    formData.delete('files');  // Ensure no previous 'files' entries exist

    // Append dropped files to the form data (only append files with a valid name)
    let validFiles = [];
    Array.from(files).forEach(file => {
        if (file.name.trim() && file.size > 0) {  // Ensure valid file name and size > 0
            formData.append('files', file);
            validFiles.push(file);  // Collect valid files for logging or further debugging
        }
    });
    // Upload the files via AJAX (reuse your existing handleUpload function)
    if (validFiles.length > 0) {
        handleUpload({ files: validFiles }, form, formData);
    }
}
