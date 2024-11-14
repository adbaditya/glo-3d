// public/js/main.js

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {

    if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Cache DOM elements with error checking
    const modal = document.getElementById('carModal');
    const iframeContainer = document.getElementById('iframeContainer');
    const vehicleInfoContainer = document.getElementById('vehicleInfoContainer');
    const modalTitle = document.getElementById('modalTitle');

    const makeSelect = document.querySelector('select[name="make"]');
    const modelSelect = document.querySelector('select[name="model"]');
    const yearSelect = document.querySelector('select[name="year"]');
    const locationSelect = document.querySelector('select[name="location"]');
    const priceSortSelect = document.querySelector('select[name="price_sort"]');
    const priceRangeSelect = document.querySelector('select[name="price_range"]');

    // Store all initial options
    const allModels = modelSelect ? Array.from(modelSelect.options).map(opt => ({
        value: opt.value,
        text: opt.text,
        make: opt.dataset.make
    })) : [];

    // 2. HELPER FUNCTIONS
    // Price related functions
    // Function to get price from element
    function getCarPrice(carElement) {
        const fields = JSON.parse(carElement.dataset.fields);
        return parseFloat(fields.price) || 0;
    }

    // Function to filter cars by price range
    function isInPriceRange(price, range) {
        if (!range) return true;

        switch (range) {
            case '0-15000':
                return price <= 15000;
            case '15000-30000':
                return price > 15000 && price <= 30000;
            case '30000-50000':
                return price > 30000 && price <= 50000;
            case '50000+':
                return price > 50000;
            default:
                return true;
        }
    }

    function filterByPrice(cars, priceRange) {
        if (!priceRange) return cars;

        return cars.filter(car => {
            const price = parseFloat(car.fields.price);
            switch (priceRange) {
                case '0-15000':
                    return price <= 15000;
                case '15000-30000':
                    return price > 15000 && price <= 30000;
                case '30000-50000':
                    return price > 30000 && price <= 50000;
                case '50000+':
                    return price > 50000;
                default:
                    return true;
            }
        });
    }

    function sortByPrice(cars, sortDirection) {
        if (!sortDirection) return cars;

        return [...cars].sort((a, b) => {
            const priceA = parseFloat(a.fields.price);
            const priceB = parseFloat(b.fields.price);

            return sortDirection === 'asc'
                ? priceA - priceB
                : priceB - priceA;
        });
    }

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
            console.log('There was an error displaying the car details. Please try again.');
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

    // 3. EVENT HANDLERS
    function handleMakeChange() {
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
    }

    function handleFilterSubmit(e) {
        e.preventDefault(); // Prevent the default form submission

        const formData = new FormData(e.target); // Get form data
        const params = new URLSearchParams(formData); // Convert to URL parameters

        // Send an AJAX request to the server
        fetch(`/api/inventory?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        })
            .then(response => response.json())
            .then(data => {
                // Update the car grid with the new data
                updateCarGrid(data);
            })
            .catch(error => {
                console.error('Error fetching inventory:', error);
            });
    }

    function handleFilterReset() {
        // Reset all select elements
        makeSelect.value = '';
        modelSelect.value = '';
        yearSelect.value = '';
        locationSelect.value = '';
        priceSortSelect.value = '';
        priceRangeSelect.value = '';

        // Reset model options
        modelSelect.innerHTML = '<option value="">All Models</option>';
        allModels.forEach(model => {
            if (model.value) {
                const option = new Option(model.text, model.value);
                modelSelect.add(option);
            }
        });

        // Show all cars
        const carGrid = document.querySelector('.car-grid');
        if (carGrid) {
            const carElements = Array.from(carGrid.children);
            carElements.forEach(car => car.style.display = '');
        }

        // Clear URL parameters
        window.history.pushState({}, '', window.location.pathname);
    }

    function updateNoResultsMessage(visibleCars) {
        // Remove existing message if it exists
        const existingMessage = document.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // If no visible cars, show message
        if (visibleCars === 0) {
            const carGrid = document.querySelector('.car-grid');
            const message = document.createElement('div');
            message.className = 'no-results-message col-span-full py-8 text-center text-gray-500';
            message.innerHTML = `
                <div class="text-xl font-semibold mb-2">No cars match your filters</div>
                <div class="text-sm">Try adjusting your filters or <button class="text-blue-500 hover:underline" onclick="document.getElementById('resetFilters').click()">reset all filters</button></div>
            `;
            carGrid.appendChild(message);
        }
    }

    // 4. INITIALIZATION & EVENT LISTENERS
    // Check required elements
    if (!modal || !iframeContainer || !vehicleInfoContainer || !modalTitle) {
        console.error('Required DOM elements not found:', {
            modal: !!modal,
            iframeContainer: !!iframeContainer,
            vehicleInfoContainer: !!vehicleInfoContainer,
            modalTitle: !!modalTitle
        });
        return;
    }

    const resetButton = document.getElementById('resetFilters');
    if (resetButton) {
        resetButton.addEventListener('click', handleFilterReset);
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

    // Set up global handlers
    window.handleCarDetails = function (button) {
        try {
            const src = button.dataset.src;
            const fields = JSON.parse(button.dataset.fields);
            console.log('Fields String:', fields); // Log the JSON string


            if (!src || !fields) {
                throw new Error('Missing required data attributes');
            }

            showCarDetails(src, fields);
        } catch (error) {
            console.error('Error in handleCarDetails:', error);
            console.log('Error loading car details. Please try again.');
        }
    };

    window.closeModal = function () {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        iframeContainer.innerHTML = '';
        vehicleInfoContainer.innerHTML = '';
    };

    // Add event listeners
    modal.addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });

    if (makeSelect) {
        makeSelect.addEventListener('change', handleMakeChange);
    }

    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
        filterForm.addEventListener('submit', handleFilterSubmit);
    }

    function updateCarGrid(data) {
        const carGrid = document.querySelector('.car-grid');
        carGrid.innerHTML = ''; // Clear existing cars

        if (data && data.length > 0) {
            data.forEach(car => {
                const carElement = document.createElement('div');
                carElement.className = 'bg-white rounded-lg shadow-md overflow-hidden';

                carElement.innerHTML = `
                    <div class="relative">
                        <img src="${car.thumb || ''}" alt="${car.fields?.year || ''} ${car.fields?.make || ''} ${car.fields?.model || ''}" class="w-full h-48 object-cover">
                    </div>
                    <div class="p-4">
                        <h3 class="text-xl font-bold car-name text-center">${car.fields?.year || ''} ${car.fields?.make ? car.fields.make.toUpperCase() : ''} ${car.fields?.model || ''}</h3>
                        <p class="text-lg font-bold mb-2 text-center">${car.fields?.mileage ? parseInt(car.fields.mileage).toLocaleString() : '0'} Km. $${car.fields?.price ? parseInt(car.fields.price).toLocaleString() : '0'}</p>
                        <p class="text-lg font-bold mb-2 text-center">Location: ${car.fields?.location}</p>
                        <div class="bg-gray-100 p-2 rounded mb-2">
                            <p class="text-sm">VIN: ${car.vin || 'N/A'}</p>
                            <p class="text-sm">Stock No: ${car.stock_number || 'N/A'}</p>
                        </div>
                        <div class="flex flex-col gap-2 pt-4">
                            <button data-src="${car.src}" data-fields='${JSON.stringify({ ...car.fields, features: car.features })}' onclick="handleCarDetails(this)" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-center">View Details</button>
                        </div>
                    </div>
                `;

                carGrid.appendChild(carElement);
            });
        } else {
            const message = document.createElement('div');
            message.className = 'no-results-message col-span-full py-8 text-center text-gray-500';
            message.innerHTML = `
                <div class="text-xl font-semibold mb-2">No cars match your filters</div>
                <div class="text-sm">Try adjusting your filters or <button class="text-blue-500 hover:underline" onclick="document.getElementById('resetFilters').click()">reset all filters</button></div>
            `;
            carGrid.appendChild(message);
        }
    }
});

// Add CORS headers to your fetch requests
function fetchWithCors(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Access-Control-Allow-Origin': '*'
        }
    });
}