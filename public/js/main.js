// public/js/main.js

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Cache DOM elements with error checking
    const modal = document.getElementById('carModal');
    const iframeContainer = document.getElementById('iframeContainer');
    const vehicleInfoContainer = document.getElementById('vehicleInfoContainer');
    const modalTitle = document.getElementById('modalTitle');

    // Check if all required elements exist
    if (!modal || !iframeContainer || !vehicleInfoContainer || !modalTitle) {
        console.error('Required DOM elements not found:', {
            modal: !!modal,
            iframeContainer: !!iframeContainer,
            vehicleInfoContainer: !!vehicleInfoContainer,
            modalTitle: !!modalTitle
        });
        return;
    }

    // Vehicle info configuration
    const infoFields = [
        { key: 'location', icon: '🔍', label: 'Location' },
        { key: 'car_type', icon: '🚗', label: 'Car Type' },
        { key: 'condition', icon: '📍', label: 'Condition' },
        { key: 'mileage', icon: '⚡', label: 'Mileage' },
        { key: 'transmission', icon: '⚙️', label: 'Transmission' },
        { key: 'exterior_color', icon: '🎨', label: 'Exterior Color' },
        { key: 'fuel_type', icon: '⛽', label: 'Fuel Type' },
        { key: 'engine', icon: '🔧', label: 'Engine' },
        { key: 'doors', icon: '🚪', label: 'Doors' },
        { key: 'seating', icon: '💺', label: 'Seating' },
        { key: 'drive_type', icon: '🔄', label: 'Drive Train' },
        { key: 'interior_color', icon: '🎨', label: 'Interior Color' },
        { key: 'vin', icon: '🔢', label: 'VIN' },
        { key: 'stock_number', icon: '📋', label: 'Stock Number' }
    ];

    // Handler for car detail button clicks
    window.handleCarDetails = function (button) {
        try {
            const src = button.dataset.src;
            const fields = JSON.parse(button.dataset.fields);

            if (!src || !fields) {
                throw new Error('Missing required data attributes');
            }

            showCarDetails(src, fields);
        } catch (error) {
            console.error('Error in handleCarDetails:', error);
            alert('Error loading car details. Please try again.');
        }
    };

    function showCarDetails(src, fields) {
        try {
            // Set modal title
            modalTitle.textContent = `${fields.year} ${fields.make} ${fields.model}`;

            // Set iframe content
            iframeContainer.innerHTML = `
                <iframe 
                    src="${src}"
                    allow="fullscreen" 
                    allowfullscreen="true" 
                    loading="lazy"
                    width="100%" 
                    height="100%" 
                    frameborder="0" 
                    scrolling="no"
                ></iframe>
            `;

            // Update vehicle info
            updateVehicleInfo(fields);

            // Update Carfax link
            const carfaxContainer = document.getElementById('carfaxContainer');
            const carfaxLink = document.getElementById('carfaxLink');

            carfaxLink.classList.remove('opacity-50', 'cursor-not-allowed');
            carfaxLink.textContent = 'View Carfax Report';

            if (fields['1729543266746']) {
                carfaxContainer.classList.remove('hidden');
                carfaxLink.href = fields['1729543266746'];
            } else {
                carfaxContainer.classList.remove('hidden');
                carfaxLink.href = '#';
                carfaxLink.classList.add('opacity-50', 'cursor-not-allowed');
                carfaxLink.textContent = 'Carfax N/A';
            }

            // Update Inspection Status
            const inspectionContainer = document.getElementById('inspectionContainer');
            const inspectionLink = document.getElementById('inspectionLink');

            if (inspectionContainer && inspectionLink) {
                const inspectionStatus = fields['1729543306380'] || 'Unknown';
                inspectionContainer.classList.remove('hidden');
                
                // Reset classes first
                inspectionLink.className = 'inline-block text-white px-4 py-2 rounded text-center w-full';
                
                if (inspectionStatus) {
                    inspectionLink.href = fields['1729543306380'];
                    inspectionLink.textContent = `Inspection Report`;
                    
                    inspectionLink.classList.add('bg-green-600', 'hover:bg-green-700');
                } else {
                    inspectionLink.href = '#';
                    inspectionLink.textContent = 'Inspection Status: Unknown';
                    inspectionLink.classList.add('bg-gray-600', 'hover:bg-gray-700', 'opacity-50', 'cursor-not-allowed');
                }
            }

            // Update Features
            updateFeatures(fields.features);

            // Show modal
            modal.classList.remove('hidden');
            modal.classList.add('flex');

        } catch (error) {
            console.error('Error showing car details:', error);
            alert('There was an error displaying the car details. Please try again.');
        }
    }

    function updateFeatures(features) {
        const featureTypes = {
            luxury: document.getElementById('luxuryFeatures'),
            safety: document.getElementById('safetyFeatures'),
            entertainment: document.getElementById('entertainmentFeatures')
        };

        // Clear existing features
        Object.values(featureTypes).forEach(container => {
            container.innerHTML = '';
        });

        // Helper function to create feature item
        const createFeatureItem = (text) => {
            const li = document.createElement('li');
            li.className = 'flex items-center space-x-2';
            li.innerHTML = `
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span>${text}</span>
            `;
            return li;
        };

        // Add luxury features
        if (features?.luxury_features) {
            features.luxury_features.forEach(feature => {
                featureTypes.luxury.appendChild(createFeatureItem(feature));
            });
        }

        // Add safety features
        if (features?.safety_features) {
            features.safety_features.forEach(feature => {
                featureTypes.safety.appendChild(createFeatureItem(feature));
            });
        }

        // Add entertainment features
        if (features?.entertainment_features) {
            features.entertainment_features.forEach(feature => {
                featureTypes.entertainment.appendChild(createFeatureItem(feature));
            });
        }
    }

    function closeModal() {
        const modal = document.getElementById('carModal');
        const carfaxLink = document.getElementById('carfaxLink');

        // Reset modal
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // Clear containers
        iframeContainer.innerHTML = '';
        vehicleInfoContainer.innerHTML = '';

        // Reset Carfax button
        carfaxLink.classList.remove('opacity-50', 'cursor-not-allowed');
        carfaxLink.textContent = 'View Carfax Report';
        carfaxLink.href = '#';

        inspectionLink.classList.remove('opacity-50', 'cursor-not-allowed');
        inspectionLink.textContent = 'View Inspection Report';
        inspectionLink.href = '#';
    }

    function updateVehicleInfo(fields) {
        // Clear previous info
        vehicleInfoContainer.innerHTML = '';

        // Create info rows
        infoFields.forEach(field => {
            const value = fields[field.key];
            if (value) {
                const row = document.createElement('div');
                row.className = 'flex items-center space-x-3 py-2 border-b border-gray-100';
                row.innerHTML = `
                    <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span class="text-lg">${field.icon}</span>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm text-gray-600">${field.label}</div>
                        <div class="font-medium">${value}</div>
                    </div>
                `;
                vehicleInfoContainer.appendChild(row);
            }
        });
    }

    // Close modal function
    window.closeModal = function () {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        iframeContainer.innerHTML = '';
        vehicleInfoContainer.innerHTML = '';
    };

    // Close modal when clicking outside
    modal.addEventListener('click', function (e) {
        if (e.target === this) {
            closeModal();
        }
    });

    // Filter form handling
    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
        filterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const params = new URLSearchParams(formData);
            window.location.href = `/?${params.toString()}`;
        });
    }

    // Add this script to your page or a separate .js file
    document.addEventListener('DOMContentLoaded', function () {
        const makeSelect = document.querySelector('select[name="make"]');
        const modelSelect = document.querySelector('select[name="model"]');
        const yearSelect = document.querySelector('select[name="year"]');
        const locationSelect = document.querySelector('select[name="location"]');

        // Store all initial options
        const allModels = Array.from(modelSelect.options).map(opt => ({
            value: opt.value,
            text: opt.text,
            make: opt.dataset.make
        }));

        // Update models when make changes
        makeSelect.addEventListener('change', function () {
            const selectedMake = this.value;

            // Clear current model options
            modelSelect.innerHTML = '<option value="">All Models</option>';

            // If no make is selected, show all models
            if (!selectedMake) {
                allModels.forEach(model => {
                    if (model.value) {
                        const option = new Option(model.text, model.value);
                        modelSelect.add(option);
                    }
                });
                return;
            }

            // Filter models for selected make
            const filteredModels = allModels.filter(model =>
                model.make === selectedMake
            );

            // Add filtered models to select
            filteredModels.forEach(model => {
                if (model.value) {
                    const option = new Option(model.text, model.value);
                    modelSelect.add(option);
                }
            });
        });

        // Form submit handler for analytics or additional processing
        document.getElementById('filterForm').addEventListener('submit', function (e) {
            e.preventDefault();

            // Get all filter values
            const filters = {
                make: makeSelect.value,
                model: modelSelect.value,
                year: yearSelect.value,
                location: locationSelect.value
            };

            // Update URL with filter parameters
            const searchParams = new URLSearchParams(filters);
            window.location.href = `${window.location.pathname}?${searchParams.toString()}`;
        });
    });
});